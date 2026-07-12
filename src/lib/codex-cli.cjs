const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function appendVersionedCandidates(candidates, directory, executableName, pathApi) {
  try {
    const versions = fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => pathApi.join(directory, entry.name, executableName));
    candidates.push(...versions.reverse());
  } catch {
    // The corresponding desktop app may not be installed.
  }
}

function appendMacNpmCandidates(candidates, prefix, pathApi) {
  const packageRoot = pathApi.join(prefix, "lib", "node_modules", "@openai", "codex", "node_modules", "@openai");
  candidates.push(
    pathApi.join(packageRoot, "codex-darwin-arm64", "vendor", "aarch64-apple-darwin", "codex", "codex"),
    pathApi.join(packageRoot, "codex-darwin-x64", "vendor", "x86_64-apple-darwin", "codex", "codex"),
  );
}

function executableCandidates(env = process.env, homeDir = os.homedir(), platform = process.platform) {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const delimiter = platform === "win32" ? ";" : ":";
  const candidates = [];
  if (env.CODEX_CLI_PATH) candidates.push(env.CODEX_CLI_PATH);

  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA || pathApi.join(homeDir, "AppData", "Local");
    appendVersionedCandidates(candidates, pathApi.join(localAppData, "OpenAI", "Codex", "bin"), "codex.exe", pathApi);

    const appData = env.APPDATA || pathApi.join(homeDir, "AppData", "Roaming");
    candidates.push(
      pathApi.join(
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
  } else {
    candidates.push(
      "/Applications/Codex.app/Contents/Resources/codex",
      pathApi.join(homeDir, "Applications", "Codex.app", "Contents", "Resources", "codex"),
      "/Applications/ChatGPT.app/Contents/Resources/codex",
      pathApi.join(homeDir, "Applications", "ChatGPT.app", "Contents", "Resources", "codex"),
      pathApi.join(homeDir, ".local", "bin", "codex"),
      pathApi.join(homeDir, ".cargo", "bin", "codex"),
      "/opt/homebrew/bin/codex",
      "/usr/local/bin/codex",
    );
    appendVersionedCandidates(
      candidates,
      pathApi.join(homeDir, "Library", "Application Support", "Codex", "bin"),
      "codex",
      pathApi,
    );
    appendVersionedCandidates(
      candidates,
      pathApi.join(homeDir, "Library", "Application Support", "OpenAI", "Codex", "bin"),
      "codex",
      pathApi,
    );
    for (const prefix of [env.npm_config_prefix, pathApi.join(homeDir, ".npm-global"), "/opt/homebrew", "/usr/local"].filter(Boolean)) {
      appendMacNpmCandidates(candidates, prefix, pathApi);
    }
  }

  const executableName = platform === "win32" ? "codex.exe" : "codex";
  for (const directory of (env.PATH || "").split(delimiter)) {
    if (directory) candidates.push(pathApi.join(directory, executableName));
  }

  return [...new Set(candidates.map((candidate) => pathApi.resolve(candidate)))];
}

function findCodexExecutable(options = {}) {
  const exists = options.exists || fs.existsSync;
  const candidate = executableCandidates(options.env, options.homeDir, options.platform).find((item) => exists(item));
  if (!candidate) {
    throw new Error("未找到 Codex 桌面版或 Codex CLI。请先安装并登录 Codex。");
  }
  return candidate;
}

module.exports = { executableCandidates, findCodexExecutable };
