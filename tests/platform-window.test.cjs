const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setMacFloatingLayer,
} = require("../src/lib/platform-window.cjs");

function fakeWindow() {
  const calls = [];
  let visibleOnAllWorkspaces = false;
  return {
    calls,
    setVisibleOnAllWorkspaces(value, options) {
      visibleOnAllWorkspaces = value;
      calls.push(["workspaces", value, options]);
    },
    isVisibleOnAllWorkspaces: () => visibleOnAllWorkspaces,
    setHiddenInMissionControl: (value) => calls.push(["mission-control", value]),
    setAlwaysOnTop: (value) => calls.push(["always-on-top", value]),
    setSkipTaskbar: (value) => calls.push(["skip-taskbar", value]),
  };
}

test("keeps the floating ball on every macOS Space including fullscreen", () => {
  const window = fakeWindow();
  assert.equal(setMacFloatingLayer(window, true, "darwin"), true);
  assert.deepEqual(window.calls[0], ["workspaces", true, { visibleOnFullScreen: true }]);
});
