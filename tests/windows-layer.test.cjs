const test = require("node:test");
const assert = require("node:assert/strict");
const { invokeWindowsLayer } = require("../src/lib/windows-layer.cjs");

test("parses native window layer diagnostics", async () => {
  const fakeExec = (_file, args, _options, callback) => {
    assert.equal(args.at(-1), "desktop");
    callback(null, '{"handle":"10","parentHandle":"20","parentClass":"WorkerW","mode":"desktop"}\r\n', "");
  };
  const result = await invokeWindowsLayer("helper.ps1", 10, "desktop", fakeExec);
  assert.equal(result.parentClass, "WorkerW");
  assert.equal(result.parentHandle, "20");
});
