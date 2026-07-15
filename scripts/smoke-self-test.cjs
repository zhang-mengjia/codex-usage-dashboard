const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const executable = process.env.DASHBOARD_EXE || path.join(projectRoot, "release", "win-unpacked", "Codex 使用量.exe");
const resultsDirectory = path.join(projectRoot, "test-results");
const reportPath = path.join(resultsDirectory, "smoke-report.json");
const profilePath = path.join(resultsDirectory, "smoke-profile");

async function waitForReport(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(reportPath)) return JSON.parse(fs.readFileSync(reportPath, "utf8"));
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("桌面自测报告生成超时");
}

async function main() {
  assert.ok(fs.existsSync(executable), `找不到待测试程序: ${executable}`);
  fs.mkdirSync(resultsDirectory, { recursive: true });
  if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
  const settingsPath = path.join(profilePath, "settings.json");
  if (fs.existsSync(settingsPath)) fs.unlinkSync(settingsPath);

  const args = [`--user-data-dir=${profilePath}`, "--test-mode", `--self-test-output=${reportPath}`];
  const launchArgs = path.basename(executable).toLowerCase() === "electron.exe"
    ? [projectRoot, ...args]
    : args;
  const child = spawn(executable, launchArgs, {
    cwd: projectRoot,
    windowsHide: false,
    stdio: "ignore",
  });

  try {
    const report = await waitForReport();
    for (const check of report.checks || []) process.stdout.write(`PASS ${check.name}\n`);
    assert.equal(report.passed, true, report.error || "桌面自测失败");
    assert.ok(report.checks.length >= 10, "桌面自测覆盖不足");
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    child.kill();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
