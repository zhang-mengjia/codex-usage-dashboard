const WINDOW_MODES = Object.freeze({
  WINDOW: "window",
  FLOATING: "floating",
});

const VALID_MODES = new Set(Object.values(WINDOW_MODES));

function isWindowMode(value) {
  return VALID_MODES.has(value);
}

function clampFloatingBounds(bounds, workArea, gap = 0) {
  const minX = workArea.x + gap;
  const minY = workArea.y + gap;
  const maxX = Math.max(minX, workArea.x + workArea.width - bounds.width - gap);
  const maxY = Math.max(minY, workArea.y + workArea.height - bounds.height - gap);
  return {
    x: Math.round(Math.min(maxX, Math.max(minX, bounds.x))),
    y: Math.round(Math.min(maxY, Math.max(minY, bounds.y))),
    width: bounds.width,
    height: bounds.height,
  };
}

function snapFloatingBounds(bounds, workArea, gap = 8) {
  const centerX = bounds.x + bounds.width / 2;
  const workCenterX = workArea.x + workArea.width / 2;
  const x = centerX < workCenterX
    ? workArea.x + gap
    : workArea.x + workArea.width - bounds.width - gap;
  const minY = workArea.y + gap;
  const maxY = workArea.y + workArea.height - bounds.height - gap;
  return {
    x: Math.round(x),
    y: Math.round(Math.min(maxY, Math.max(minY, bounds.y))),
    width: bounds.width,
    height: bounds.height,
  };
}

module.exports = { WINDOW_MODES, clampFloatingBounds, isWindowMode, snapFloatingBounds };
