export function cropGeometry(width: number, height: number, rotation: number, zoom: number, x: number, y: number, size = 256) {
  const sideways = rotation % 180 !== 0;
  const w = sideways ? height : width;
  const h = sideways ? width : height;
  const scale = Math.max(size / w, size / h) * zoom;
  return { scale, dx: x * Math.max(0, (w * scale - size) / 2), dy: y * Math.max(0, (h * scale - size) / 2) };
}
