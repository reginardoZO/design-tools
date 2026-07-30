// Rectangle resizing shared by foundations and labelled drawing rectangles.

export function resizeRectangle(rectangle, resizeDrag, dwx, dwy, minimum = 0) {
  const left = resizeDrag.startX;
  const top = resizeDrag.startY;
  const right = left + resizeDrag.startWidth;
  const bottom = top + resizeDrag.startHeight;
  const fromWest = resizeDrag.corner.includes('w');
  const fromNorth = resizeDrag.corner.includes('n');
  const fixedX = fromWest ? right : left;
  const fixedY = fromNorth ? bottom : top;
  const handleX = (fromWest ? left : right) + dwx;
  const handleY = (fromNorth ? top : bottom) + dwy;
  const adjustedX = keepMinimumDistance(handleX, fixedX, minimum, fromWest ? -1 : 1);
  const adjustedY = keepMinimumDistance(handleY, fixedY, minimum, fromNorth ? -1 : 1);

  rectangle.x = Math.min(fixedX, adjustedX);
  rectangle.y = Math.min(fixedY, adjustedY);
  rectangle.width = Math.abs(adjustedX - fixedX);
  rectangle.height = Math.abs(adjustedY - fixedY);
  return rectangle;
}

function keepMinimumDistance(value, fixed, minimum, fallbackDirection) {
  const delta = value - fixed;
  const direction = delta === 0 ? fallbackDirection : Math.sign(delta);
  return fixed + direction * Math.max(Math.abs(delta), minimum);
}
