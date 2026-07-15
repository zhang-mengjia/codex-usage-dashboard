const test = require("node:test");
const assert = require("node:assert/strict");
const { WINDOW_MODES, isWindowMode, snapFloatingBounds } = require("../src/lib/window-modes.cjs");

test("keeps only regular-window and floating-ball modes", () => {
  assert.deepEqual(Object.values(WINDOW_MODES).sort(), ["floating", "window"]);
  assert.equal(isWindowMode("desktop"), false);
  assert.equal(isWindowMode("unknown"), false);
});

test("snaps a floating ball to the nearest edge and clamps its y position", () => {
  const workArea = { x: 0, y: 0, width: 1920, height: 1040 };
  assert.deepEqual(
    snapFloatingBounds({ x: 100, y: -20, width: 108, height: 108 }, workArea),
    { x: 8, y: 8, width: 108, height: 108 },
  );
  assert.deepEqual(
    snapFloatingBounds({ x: 1500, y: 1100, width: 108, height: 108 }, workArea),
    { x: 1804, y: 924, width: 108, height: 108 },
  );
});
