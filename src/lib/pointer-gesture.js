(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.pointerGesture = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const BALL_DRAG_THRESHOLD_PX = 8;

  function hasExceededDragThreshold(startX, startY, currentX, currentY, threshold = BALL_DRAG_THRESHOLD_PX) {
    return Math.hypot(Number(currentX) - Number(startX), Number(currentY) - Number(startY)) >= threshold;
  }

  return { BALL_DRAG_THRESHOLD_PX, hasExceededDragThreshold };
});
