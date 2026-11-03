/**
 * Fallback for browsers without WebGL2 float render targets — the real lighting is the GPU path tracer in
 * stringLightsPathTracer.ts. This one is a CPU raytracer for direct light only: for every bulb it walks each
 * pixel of the relief (0 = the wall, 1 = as high as the bulbs), works out the surface normal from
 * the height gradient, how much of the bulb the pixel actually faces, and — by marching a ray towards the bulb
 * through the same height map — whether something stands in the way. The result is that bulb's light as an
 * RGB texture, baked once and blended in at runtime; nothing here runs per frame.
 */

export type BakeSetup = {
  w: number;
  h: number;
  /** CSS px covered by one cell of the grid. */
  step: number;
  /** CSS px that a height of 1.0 stands for. */
  heightUnit: number;
  /** Heights that catch light (decor plus the bulbs' own glass domes), smoothed so the normals aren't banded. */
  receive: Float32Array;
  /** Heights that stop light (decor only — glass doesn't cast a real shadow). */
  block: Float32Array;
};

export type BakeLight = {
  x: number;
  y: number;
  z: number;
  /** The bulb's own glass: it is lit by its glow sprite, not by itself. */
  skipX: number;
  skipY: number;
  skipRx: number;
  skipRy: number;
  color: [number, number, number];
  /** Distance at which the light has fallen to half. */
  reach: number;
  gain: number;
};

const MAX_SHADOW_STEPS = 36;

/** A 3×3 box blur, `passes` times over (edges clamp). */
export function blurHeights(src: Float32Array, w: number, h: number, passes: number): Float32Array {
  const a = new Float32Array(src);
  const b = new Float32Array(src.length);
  for (let pass = 0; pass < passes; pass += 1) {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const xl = x > 0 ? x - 1 : x;
        const xr = x < w - 1 ? x + 1 : x;
        b[y * w + x] = (a[y * w + xl] + a[y * w + x] + a[y * w + xr]) / 3;
      }
    }
    for (let y = 0; y < h; y += 1) {
      const yu = y > 0 ? y - 1 : y;
      const yd = y < h - 1 ? y + 1 : y;
      for (let x = 0; x < w; x += 1) {
        a[y * w + x] = (b[yu * w + x] + b[y * w + x] + b[yd * w + x]) / 3;
      }
    }
  }
  return a;
}

/** Bakes rows [rowStart, rowEnd) of one bulb's light into `out` (RGBA, w×h, opaque). */
export function bakeRows(s: BakeSetup, l: BakeLight, out: Uint8ClampedArray, rowStart: number, rowEnd: number): void {
  const { w, h, step, heightUnit: Z, receive, block } = s;
  const lightGx = l.x / step - 0.5;
  const lightGy = l.y / step - 0.5;
  const bias = Z * 0.02;
  const soft = Z * 0.07;
  const reach2 = l.reach * l.reach;
  for (let y = rowStart; y < rowEnd; y += 1) {
    const yu = y > 0 ? y - 1 : y;
    const yd = y < h - 1 ? y + 1 : y;
    const py = (y + 0.5) * step;
    for (let x = 0; x < w; x += 1) {
      const o = (y * w + x) * 4;
      out[o + 3] = 255;
      const px = (x + 0.5) * step;
      if (l.skipRx > 0) {
        const ex = (px - l.skipX) / l.skipRx;
        const ey = (py - l.skipY) / l.skipRy;
        if (ex * ex + ey * ey < 1) {
          out[o] = 0;
          out[o + 1] = 0;
          out[o + 2] = 0;
          continue;
        }
      }
      const xl = x > 0 ? x - 1 : x;
      const xr = x < w - 1 ? x + 1 : x;
      const dzdx = ((receive[y * w + xr] - receive[y * w + xl]) * Z) / ((xr - xl) * step);
      const dzdy = ((receive[yd * w + x] - receive[yu * w + x]) * Z) / ((yd - yu) * step);
      const nInv = 1 / Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1);
      const zc = receive[y * w + x] * Z;
      const dx = l.x - px;
      const dy = l.y - py;
      const dz = l.z - zc;
      const d2 = dx * dx + dy * dy + dz * dz;
      const ndl = ((-dzdx * dx - dzdy * dy + dz) * nInv) / Math.sqrt(d2);
      if (ndl <= 0) {
        out[o] = 0;
        out[o + 1] = 0;
        out[o + 2] = 0;
        continue;
      }
      const gx = lightGx - x;
      const gy = lightGy - y;
      const steps = Math.min(MAX_SHADOW_STEPS, Math.max(4, Math.ceil(Math.hypot(gx, gy) / 2)));
      let vis = 1;
      for (let k = 1; k < steps; k += 1) {
        const t = k / steps;
        const sx = Math.round(x + gx * t);
        const sy = Math.round(y + gy * t);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        const over = block[sy * w + sx] * Z - (zc + dz * t) - bias;
        if (over > 0) {
          const f = over > soft ? 0 : 1 - over / soft;
          if (f < vis) vis = f;
          if (vis < 0.02) break;
        }
      }
      const e = ndl * (1 / (1 + d2 / reach2)) * vis * l.gain;
      const tone = (1 - Math.exp(-e)) * 255;
      out[o] = tone * l.color[0];
      out[o + 1] = tone * l.color[1];
      out[o + 2] = tone * l.color[2];
    }
  }
}
