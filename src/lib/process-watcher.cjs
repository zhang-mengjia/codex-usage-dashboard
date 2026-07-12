const { EventEmitter } = require("node:events");
const { execFile } = require("node:child_process");
const path = require("node:path");

const HOST_PROCESSES = Object.freeze({
  win32: ["chatgpt.exe", "codex.exe"],
  darwin: ["chatgpt", "codex"],
});

function defaultHostProcesses(platform = process.platform) {
  return HOST_PROCESSES[platform] || HOST_PROCESSES.darwin;
}

const DEFAULT_HOST_PROCESSES = defaultHostProcesses();

function parseTasklistCsv(output) {
  const names = [];
  for (const line of String(output).split(/\r?\n/)) {
    const match = line.match(/^"((?:[^"]|"")+)"/);
    if (match) names.push(match[1].replaceAll('""', '"').toLowerCase());
  }
  return names;
}

function listWindowsProcesses(exec = execFile) {
  return new Promise((resolve, reject) => {
    exec(
      "tasklist.exe",
      ["/fo", "csv", "/nh"],
      { windowsHide: true, encoding: "utf8" },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(parseTasklistCsv(stdout));
      },
    );
  });
}

function parsePsCommands(output) {
  return String(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((command) => path.posix.basename(command).toLowerCase());
}

function listMacProcesses(exec = execFile) {
  return new Promise((resolve, reject) => {
    exec(
      "/bin/ps",
      ["-axo", "comm="],
      { encoding: "utf8" },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(parsePsCommands(stdout));
      },
    );
  });
}

function listHostProcesses(platform = process.platform, exec = execFile) {
  return platform === "win32" ? listWindowsProcesses(exec) : listMacProcesses(exec);
}

class HostProcessWatcher extends EventEmitter {
  constructor(options = {}) {
    super();
    this.platform = options.platform || process.platform;
    this.names = (options.names || defaultHostProcesses(this.platform)).map((name) => name.toLowerCase());
    this.intervalMs = options.intervalMs || 4_000;
    this.listProcesses = options.listProcesses || (() => listHostProcesses(this.platform, options.exec));
    this.timer = null;
    this.running = false;
    this.lastDetected = null;
  }

  start() {
    if (this.timer) return;
    this.check();
    this.timer = setInterval(() => this.check(), this.intervalMs);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  async check() {
    if (this.running) return;
    this.running = true;
    try {
      const processes = await this.listProcesses();
      const detectedName = this.names.find((name) => processes.includes(name)) || null;
      const detected = Boolean(detectedName);
      if (detected !== this.lastDetected) {
        this.lastDetected = detected;
        this.emit("change", { detected, processName: detectedName });
      }
      if (detected) this.emit("detected", { processName: detectedName });
    } catch (error) {
      this.emit("error", error);
    } finally {
      this.running = false;
    }
  }
}

module.exports = {
  DEFAULT_HOST_PROCESSES,
  HostProcessWatcher,
  defaultHostProcesses,
  listHostProcesses,
  listMacProcesses,
  listWindowsProcesses,
  parsePsCommands,
  parseTasklistCsv,
};
