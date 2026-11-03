export type WaterRect = { x: number; y: number; width: number; height: number };

/** Conservative raster bounds of every head/tail, including the shader's billboard and both blur axes. */
export function waterScreenRect(
  bounds: ArrayLike<number>, matrix: ArrayLike<number>, width: number, height: number,
  radius: number, projScale: number, smooth: number, near: number,
): WaterRect {
  const full = { x: 0, y: 0, width, height };
  if (bounds[0] > bounds[3]) return { x: 0, y: 0, width: 0, height: 0 };
  let loX = Infinity, loY = Infinity, hiX = -Infinity, hiY = -Infinity, minW = Infinity;
  for (let corner = 0; corner < 8; corner++) {
    const x = bounds[corner & 1 ? 3 : 0], y = bounds[corner & 2 ? 4 : 1], z = bounds[corner & 4 ? 5 : 2];
    const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
    // Near-plane crossings can create unbounded projected segments: use the safe full pass.
    if (!Number.isFinite(w) || w <= near) return full;
    const sx = (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w;
    const sy = (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w;
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return full;
    loX = Math.min(loX, sx); hiX = Math.max(hiX, sx); loY = Math.min(loY, sy); hiY = Math.max(hiY, sy); minW = Math.min(minW, w);
  }
  // A quad corner can extend sqrt(2)*w beyond an endpoint. Blur reaches 2*smooth pixels;
  // allow bilinear footprints, the normal's ±1px taps and float32 shader rounding as well.
  const pad = Math.SQRT2 * Math.max(.8, radius * projScale / minW) + 2 * Math.max(.5, smooth) + 4;
  const x = Math.max(0, Math.min(width, Math.floor((loX * .5 + .5) * width - pad)));
  const y = Math.max(0, Math.min(height, Math.floor((loY * .5 + .5) * height - pad)));
  const right = Math.max(0, Math.min(width, Math.ceil((hiX * .5 + .5) * width + pad)));
  const top = Math.max(0, Math.min(height, Math.ceil((hiY * .5 + .5) * height + pad)));
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, top - y) };
}
