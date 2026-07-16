const test = require("node:test");
const assert = require("node:assert/strict");
const { WINDOW_MODES, clampFloatingBounds, isWindowMode, snapFloatingBounds } = require("../src/lib/window-modes.cjs");

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

test("keeps a dragged floating ball inside its active display", () => {
  const workArea = { x: 0, y: 0, width: 2048, height: 1152 };
  assert.deepEqual(
    clampFloatingBounds({ x: -233, y: -1245, width: 112, height: 113 }, workArea),
    { x: 0, y: 0, width: 112, height: 113 },
  );
  assert.deepEqual(
    clampFloatingBounds({ x: 3000, y: 1400, width: 112, height: 113 }, workArea),
    { x: 1936, y: 1039, width: 112, height: 113 },
  );
});
