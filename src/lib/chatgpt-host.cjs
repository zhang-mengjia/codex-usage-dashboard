const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");

function parseIntegratedPackage(names) {
  const candidates = names.flatMap((name) => {
    const match = /^OpenAI\.Codex_([0-9.]+)_[^_]+__2p2nqsd0c76g0$/i.exec(name);
    return match ? [{ name, version: match[1] }] : [];
  });
  candidates.sort((left, right) => {
    const a = left.version.split(".").map(Number);
    const b = right.version.split(".").map(Number);
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      if ((a[index] || 0) !== (b[index] || 0)) return (b[index] || 0) - (a[index] || 0);
    }
    return 0;
  });
  return candidates[0] || null;
}

function macDesktopApps(homeDir) {
  return [
    {
      appName: "ChatGPT",
      packageName: "com.openai.chat",
      integratedChatGpt: true,
      surfaces: ["codex", "work", "chat"],
      paths: ["/Applications/ChatGPT.app", path.posix.join(homeDir, "Applications", "ChatGPT.app")],
    },
    {
      appName: "Codex",
      packageName: "com.openai.codex",
      integratedChatGpt: false,
      surfaces: ["codex"],
      paths: ["/Applications/Codex.app", path.posix.join(homeDir, "Applications", "Codex.app")],
    },
  ];
}

function detectMacDesktopHost(options = {}) {
  const exists = options.exists || fs.existsSync;
  const homeDir = options.homeDir || process.env.HOME || "";
  for (const app of macDesktopApps(homeDir)) {
    const installPath = app.paths.find((candidate) => exists(candidate));
    if (installPath) return { ...app, installPath, paths: undefined };
  }
  return { integratedChatGpt: false, appName: "Codex", surfaces: ["codex"] };
}

function detectWindowsIntegratedChatGpt(options = {}) {
  const windowsApps = options.windowsApps || path.join(process.env.ProgramFiles || "C:\\Program Files", "WindowsApps");
  try {
    const match = parseIntegratedPackage(fs.readdirSync(windowsApps));
    if (!match) return { integratedChatGpt: false, appName: "Codex", surfaces: ["codex"] };
    return {
      integratedChatGpt: true,
      appName: "ChatGPT",
      packageName: "OpenAI.Codex",
      version: match.version,
      surfaces: ["codex", "work", "chat"],
      installPath: path.join(windowsApps, match.name),
    };
  } catch {
    return { integratedChatGpt: false, appName: "Codex", surfaces: ["codex"] };
  }
}

function detectIntegratedChatGpt(options = {}) {
  const platform = options.platform || process.platform;
  if (platform === "darwin") return detectMacDesktopHost(options);
  if (platform === "win32") return detectWindowsIntegratedChatGpt(options);
  return { integratedChatGpt: false, appName: "Codex", surfaces: ["codex"] };
}

function queryIntegratedChatGptPackage(exec = execFile, options = {}) {
  const platform = options.platform || process.platform;
  if (platform === "darwin") {
    const host = detectMacDesktopHost(options);
    if (!host.installPath) return Promise.resolve(null);
    return new Promise((resolve) => {
      exec(
        "/usr/bin/defaults",
        ["read", path.posix.join(host.installPath, "Contents", "Info"), "CFBundleShortVersionString"],
        { encoding: "utf8" },
        (error, stdout) => {
          const version = String(stdout || "").trim();
          resolve(error || !/^\d+(?:\.\d+)+$/.test(version) ? host : { ...host, version });
        },
      );
    });
  }
  if (platform !== "win32") return Promise.resolve(null);
  return new Promise((resolve) => {
    exec(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", "$p=Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue; if($p){$p.Version.ToString()}"],
      { windowsHide: true, encoding: "utf8" },
      (error, stdout) => {
        const version = String(stdout || "").trim();
        if (error || !/^\d+(?:\.\d+)+$/.test(version)) {
          resolve(null);
          return;
        }
        resolve({
          integratedChatGpt: true,
          appName: "ChatGPT",
          packageName: "OpenAI.Codex",
          version,
          surfaces: ["codex", "work", "chat"],
        });
      },
    );
  });
}

module.exports = {
  detectIntegratedChatGpt,
  detectMacDesktopHost,
  macDesktopApps,
  parseIntegratedPackage,
  queryIntegratedChatGptPackage,
};
