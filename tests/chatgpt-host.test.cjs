const test = require("node:test");
const assert = require("node:assert/strict");
const { parseIntegratedPackage, queryIntegratedChatGptPackage } = require("../src/lib/chatgpt-host.cjs");

test("recognizes the integrated ChatGPT app and selects its newest package", () => {
  const value = parseIntegratedPackage([
    "Microsoft.WindowsCalculator_1.0.0.0_x64__abc",
    "OpenAI.Codex_26.600.1.0_x64__2p2nqsd0c76g0",
    "OpenAI.Codex_26.707.3748.0_x64__2p2nqsd0c76g0",
  ]);
  assert.equal(value.version, "26.707.3748.0");
});

test("reads the integrated ChatGPT package version through PowerShell", async () => {
  const value = await queryIntegratedChatGptPackage((_file, _args, _options, callback) => callback(null, "26.707.3748.0\r\n"));
  assert.equal(value.appName, "ChatGPT");
  assert.equal(value.version, "26.707.3748.0");
  assert.deepEqual(value.surfaces, ["codex", "work", "chat"]);
});
