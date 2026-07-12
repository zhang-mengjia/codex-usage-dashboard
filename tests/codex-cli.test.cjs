const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { executableCandidates, findCodexExecutable } = require("../src/lib/codex-cli.cjs");

test("prefers an explicitly supplied Codex desktop CLI path", () => {
  const env = { CODEX_CLI_PATH: "C:\\OpenAI\\codex.exe", PATH: "" };
  const candidates = executableCandidates(env, "C:\\Users\\test");
  assert.equal(candidates[0], path.resolve(env.CODEX_CLI_PATH));
  assert.equal(findCodexExecutable({ env, homeDir: "C:\\Users\\test", exists: (value) => value === candidates[0] }), candidates[0]);
});

test("reports a useful error when Codex is not installed", () => {
  assert.throws(
    () => findCodexExecutable({ env: { PATH: "" }, homeDir: "C:\\missing", exists: () => false }),
    /未找到 Codex/,
  );
});
