const test = require("node:test");
const assert = require("node:assert/strict");
const { WINDOW_MODES, isWindowMode, snapFloatingBounds } = require("../src/lib/window-modes.cjs");

test("exposes exactly the four requested window modes", () => {
  assert.deepEqual(Object.values(WINDOW_MODES).sort(), ["desktop", "floating", "top", "window"]);
  assert.equal(isWindowMode("desktop"), true);
  assert.equal(isWindowMode("unknown"), false);
});

test("snaps a floating ball to the nearest edge and clamps its y position", () => {
  const workArea = { x: 0, y: 0, width: 1920, height: 1040 };
  assert.deepEqual(
    snapFloatingBounds({ x: 100, y: -20, width: 78, height: 78 }, workArea),
    { x: 8, y: 8, width: 78, height: 78 },
  );
  assert.deepEqual(
    snapFloatingBounds({ x: 1500, y: 1100, width: 78, height: 78 }, workArea),
    { x: 1834, y: 954, width: 78, height: 78 },
  );
});
