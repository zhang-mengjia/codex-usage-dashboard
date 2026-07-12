const { EventEmitter } = require("node:events");
const { execFile } = require("node:child_process");

// The current integrated desktop app runs as ChatGPT.exe while still hosting
// Codex helper processes, so prefer the product process over its helper.
const DEFAULT_HOST_PROCESSES = ["chatgpt.exe", "codex.exe"];

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

class HostProcessWatcher extends EventEmitter {
  constructor(options = {}) {
    super();
    this.names = (options.names || DEFAULT_HOST_PROCESSES).map((name) => name.toLowerCase());
    this.intervalMs = options.intervalMs || 4_000;
    this.listProcesses = options.listProcesses || listWindowsProcesses;
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
  listWindowsProcesses,
  parseTasklistCsv,
};
