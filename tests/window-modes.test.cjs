const test = require("node:test");
const assert = require("node:assert/strict");
const { WINDOW_MODES, circleShapeRects, isWindowMode, snapFloatingBounds } = require("../src/lib/window-modes.cjs");

test("keeps only regular-window and floating-ball modes", () => {
  assert.deepEqual(Object.values(WINDOW_MODES).sort(), ["floating", "window"]);
  assert.equal(isWindowMode("desktop"), false);
  assert.equal(isWindowMode("unknown"), false);
});

test("builds a true circular hit region for the floating ball", () => {
  const rects = circleShapeRects(78);
  assert.equal(rects.length, 78);
  assert.ok(rects[0].width < rects[39].width);
  assert.equal(rects[39].width, 78);
  assert.ok(rects.every((rect) => rect.height === 1 && rect.width > 0));
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
