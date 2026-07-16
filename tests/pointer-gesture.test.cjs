const test = require("node:test");
const assert = require("node:assert/strict");
const { BALL_DRAG_THRESHOLD_PX, hasExceededDragThreshold } = require("../src/lib/pointer-gesture.js");

test("does not activate floating-ball dragging for a long press or small pointer jitter", () => {
  assert.equal(BALL_DRAG_THRESHOLD_PX, 8);
  assert.equal(hasExceededDragThreshold(100, 100, 100, 100), false);
  assert.equal(hasExceededDragThreshold(100, 100, 105, 105), false);
});

test("activates floating-ball dragging only after deliberate movement", () => {
  assert.equal(hasExceededDragThreshold(100, 100, 108, 100), true);
  assert.equal(hasExceededDragThreshold(100, 100, 112, 116), true);
});
