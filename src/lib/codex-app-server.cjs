const { EventEmitter } = require("node:events");
const { spawn } = require("node:child_process");
const { findCodexExecutable } = require("./codex-cli.cjs");

class CodexAppServerClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.executable = options.executable || null;
    this.spawnProcess = options.spawnProcess || spawn;
    this.requestTimeoutMs = options.requestTimeoutMs || 15_000;
    this.env = options.env || process.env;
    this.process = null;
    this.nextId = 1;
    this.pending = new Map();
    this.stdoutBuffer = "";
    this.stopping = false;
  }

  async start() {
    if (this.process) return;
    this.stopping = false;
    const executable = this.executable || findCodexExecutable();
    const child = this.spawnProcess(executable, ["app-server", "--listen", "stdio://"], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: this.env,
    });
    this.process = child;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => this.#handleStdout(chunk));
    child.stderr.on("data", (chunk) => this.emit("server-log", chunk.trim()));
    child.once("error", (error) => this.#handleExit(error));
    child.once("exit", (code, signal) => {
      if (!this.stopping) this.#handleExit(new Error(`Codex 数据服务已退出 (${code ?? signal})`));
    });

    await this.request("initialize", {
      clientInfo: {
        name: "codex-usage-dashboard",
        title: "Codex 使用量",
        version: "1.3.0",
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
        optOutNotificationMethods: [],
      },
    });
    this.notify("initialized");
    this.emit("ready", { executable });
  }

  async readRateLimits() {
    if (!this.process) await this.start();
    return this.request("account/rateLimits/read");
  }

  async readAccount(refreshToken = false) {
    if (!this.process) await this.start();
    return this.request("account/read", { refreshToken });
  }

  async startChatGptLogin() {
    if (!this.process) await this.start();
    return this.request("account/login/start", { type: "chatgpt" });
  }

  request(method, params) {
    if (!this.process?.stdin?.writable) {
      return Promise.reject(new Error("Codex 数据服务尚未启动"));
    }
    const id = this.nextId++;
    const message = { method, id };
    if (params !== undefined) message.params = params;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} 请求超时`));
      }, this.requestTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.process.stdin.write(`${JSON.stringify(message)}\n`);
    });
  }

  notify(method, params) {
    if (!this.process?.stdin?.writable) return;
    const message = { method };
    if (params !== undefined) message.params = params;
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  stop() {
    this.stopping = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Codex 数据服务已停止"));
    }
    this.pending.clear();
    this.process?.kill();
    this.process = null;
  }

  #handleStdout(chunk) {
    this.stdoutBuffer += chunk;
    let newlineIndex = this.stdoutBuffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
      if (line) this.#handleMessage(line);
      newlineIndex = this.stdoutBuffer.indexOf("\n");
    }
  }

  #handleMessage(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.emit("server-log", `无法解析 Codex 数据: ${line.slice(0, 160)}`);
      return;
    }

    if (message.id !== undefined && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        pending.reject(new Error(message.error.message || "Codex 请求失败"));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.method === "account/rateLimits/updated") {
      this.emit("rate-limits-updated", message.params?.rateLimits || message.params);
    }
    this.emit("notification", message);
  }

  #handleExit(error) {
    const child = this.process;
    this.process = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    if (child) this.emit("disconnected", error);
  }
}

module.exports = { CodexAppServerClient };
