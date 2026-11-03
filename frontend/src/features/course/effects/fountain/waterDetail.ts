/** Periodic microstructure baked once, not evaluated as hash noise on every water pixel.
 * RG: slope, B: foam breakup, A: light focusing. 128² RGBA8 + mipmaps is about 85 KiB. */
export function bakeWaterDetail(size = 128) {
  if (!Number.isInteger(size) || size < 8 || size > 512 || (size & (size - 1))) throw new RangeError('Water detail size must be a power of two from 8 to 512');
  const wrap = (value: number, n: number) => ((value % n) + n) % n;
  const hash = (x: number, y: number) => {
    let n = Math.imul(x + 101, 374761393) ^ Math.imul(y + 73, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x: number, y: number, frequency: number) => {
    const u = x * frequency, v = y * frequency, ix = Math.floor(u), iy = Math.floor(v);
    const sx = u - ix, sy = v - iy;
    const fx = sx * sx * (3 - 2 * sx), fy = sy * sy * (3 - 2 * sy);
    const at = (dx: number, dy: number) => hash(wrap(ix + dx, frequency), wrap(iy + dy, frequency));
    return (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fy) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fy;
  };
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size, v = (y + .5) / size;
    height[y * size + x] = noise(u, v, 8) * .55 + noise(u, v, 19) * .3 + noise(u, v, 43) * .15;
  }
  const data = new Uint8Array(size * size * 4);
  const encode = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, out = i * 4;
    const gx = (height[y * size + wrap(x + 1, size)] - height[y * size + wrap(x - 1, size)]) * size / 36;
    const gy = (height[wrap(y + 1, size) * size + x] - height[wrap(y - 1, size) * size + x]) * size / 36;
    data[out] = encode(.5 + gx);
    data[out + 1] = encode(.5 + gy);
    data[out + 2] = encode(height[i]);
    const px = (x + .5) * 8 / size, py = (y + .5) * 8 / size;
    const cx = Math.floor(px), cy = Math.floor(py);
    let nearest = Infinity, next = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const ix = cx + dx, iy = cy + dy;
      const a = wrap(ix, 8), b = wrap(iy, 8);
      const sx = ix + .15 + hash(a, b) * .7 - px;
      const sy = iy + .15 + hash(a + 31, b + 17) * .7 - py;
      const distance = sx * sx + sy * sy;
      if (distance < nearest) { next = nearest; nearest = distance; }
      else if (distance < next) next = distance;
    }
    data[out + 3] = encode(Math.exp(-(Math.sqrt(next) - Math.sqrt(nearest)) * 16) * (.65 + height[i] * .35));
  }
  return { data, size };
}
