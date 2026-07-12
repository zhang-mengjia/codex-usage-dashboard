const WINDOW_MODES = Object.freeze({
  WINDOW: "window",
  FLOATING: "floating",
});

const VALID_MODES = new Set(Object.values(WINDOW_MODES));

function isWindowMode(value) {
  return VALID_MODES.has(value);
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

function circleShapeRects(size) {
  const diameter = Math.max(1, Math.round(Number(size) || 1));
  const radius = diameter / 2;
  const center = (diameter - 1) / 2;
  const rects = [];
  for (let y = 0; y < diameter; y += 1) {
    const distance = Math.abs(y - center);
    const halfWidth = Math.sqrt(Math.max(0, radius * radius - distance * distance));
    const x = Math.max(0, Math.ceil(center - halfWidth));
    const right = Math.min(diameter, Math.floor(center + halfWidth) + 1);
    rects.push({ x, y, width: Math.max(1, right - x), height: 1 });
  }
  return rects;
}

module.exports = { WINDOW_MODES, circleShapeRects, isWindowMode, snapFloatingBounds };
