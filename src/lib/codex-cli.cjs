const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function executableCandidates(env = process.env, homeDir = os.homedir()) {
  const candidates = [];
  if (env.CODEX_CLI_PATH) candidates.push(env.CODEX_CLI_PATH);

  const localAppData = env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local");
  const bundledBin = path.join(localAppData, "OpenAI", "Codex", "bin");
  try {
    const versions = fs
      .readdirSync(bundledBin, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(bundledBin, entry.name, "codex.exe"));
    candidates.push(...versions.reverse());
  } catch {
    // Codex desktop may not be installed.
  }

  const appData = env.APPDATA || path.join(homeDir, "AppData", "Roaming");
  candidates.push(
    path.join(
      appData,
      "npm",
      "node_modules",
      "@openai",
      "codex",
      "node_modules",
      "@openai",
      "codex-win32-x64",
      "vendor",
      "x86_64-pc-windows-msvc",
      "codex",
      "codex.exe",
    ),
  );

  for (const directory of (env.PATH || "").split(path.delimiter)) {
    if (directory) candidates.push(path.join(directory, "codex.exe"));
  }

  return [...new Set(candidates.map((candidate) => path.resolve(candidate)))];
}

function findCodexExecutable(options = {}) {
  const exists = options.exists || fs.existsSync;
  const candidate = executableCandidates(options.env, options.homeDir).find((item) => exists(item));
  if (!candidate) {
    throw new Error("未找到 Codex 桌面版或 Codex CLI。请先安装并登录 Codex。");
  }
  return candidate;
}

module.exports = { executableCandidates, findCodexExecutable };
