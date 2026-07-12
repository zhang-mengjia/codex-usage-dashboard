const test = require("node:test");
const assert = require("node:assert/strict");
const {
  detectMacDesktopHost,
  parseIntegratedPackage,
  queryIntegratedChatGptPackage,
} = require("../src/lib/chatgpt-host.cjs");

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

test("recognizes ChatGPT and Codex application bundles on macOS", () => {
  const chatGpt = detectMacDesktopHost({
    homeDir: "/Users/test",
    exists: (value) => value === "/Applications/ChatGPT.app",
  });
  assert.equal(chatGpt.appName, "ChatGPT");
  assert.equal(chatGpt.integratedChatGpt, true);
  assert.deepEqual(chatGpt.surfaces, ["codex", "work", "chat"]);

  const codex = detectMacDesktopHost({
    homeDir: "/Users/test",
    exists: (value) => value === "/Users/test/Applications/Codex.app",
  });
  assert.equal(codex.appName, "Codex");
  assert.equal(codex.installPath, "/Users/test/Applications/Codex.app");
  assert.deepEqual(codex.surfaces, ["codex"]);
});

test("reads a macOS app bundle version through defaults", async () => {
  const calls = [];
  const value = await queryIntegratedChatGptPackage((file, args, options, callback) => {
    calls.push({ file, args, options });
    callback(null, "26.707.3748.0\n");
  }, {
    platform: "darwin",
    homeDir: "/Users/test",
    exists: (path) => path === "/Applications/Codex.app",
  });
  assert.equal(calls[0].file, "/usr/bin/defaults");
  assert.equal(value.appName, "Codex");
  assert.equal(value.version, "26.707.3748.0");
});
