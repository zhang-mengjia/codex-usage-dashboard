const test = require("node:test");
const assert = require("node:assert/strict");
const { HostProcessWatcher, parseTasklistCsv } = require("../src/lib/process-watcher.cjs");

test("parses localized tasklist CSV by executable name", () => {
  const output = '"explorer.exe","123","Console","1","45,000 K"\r\n"Codex.exe","456","Console","1","230,000 K"\r\n';
  assert.deepEqual(parseTasklistCsv(output), ["explorer.exe", "codex.exe"]);
});

test("emits a transition when Codex starts", async () => {
  let call = 0;
  const watcher = new HostProcessWatcher({
    names: ["Codex.exe"],
    listProcesses: async () => (call++ === 0 ? ["explorer.exe"] : ["explorer.exe", "codex.exe"]),
  });
  const transitions = [];
  watcher.on("change", (value) => transitions.push(value));
  await watcher.check();
  await watcher.check();
  assert.deepEqual(transitions, [
    { detected: false, processName: null },
    { detected: true, processName: "codex.exe" },
  ]);
});
