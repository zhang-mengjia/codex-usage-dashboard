const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyMacDesktopLayer,
  clearMacWindowLayer,
  isVisibleOnAllWorkspaces,
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

test("maps desktop mode to the native macOS all-Spaces layer", () => {
  const window = fakeWindow();
  assert.equal(applyMacDesktopLayer(window, "darwin"), true);
  assert.equal(isVisibleOnAllWorkspaces(window, "darwin"), true);
  assert.deepEqual(window.calls, [
    ["workspaces", true, { visibleOnFullScreen: false }],
    ["mission-control", true],
    ["always-on-top", false],
    ["skip-taskbar", true],
  ]);
  assert.equal(clearMacWindowLayer(window, "darwin"), true);
  assert.equal(isVisibleOnAllWorkspaces(window, "darwin"), false);
});

test("keeps the floating ball on every macOS Space including fullscreen", () => {
  const window = fakeWindow();
  assert.equal(setMacFloatingLayer(window, true, "darwin"), true);
  assert.deepEqual(window.calls[0], ["workspaces", true, { visibleOnFullScreen: true }]);
});

test("leaves Windows window layering to the native Windows helper", () => {
  const window = fakeWindow();
  assert.equal(applyMacDesktopLayer(window, "win32"), false);
  assert.deepEqual(window.calls, []);
});
