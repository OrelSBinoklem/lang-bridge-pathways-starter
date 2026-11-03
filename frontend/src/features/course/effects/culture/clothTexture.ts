import { hash1, type Rgb } from './threadDraw';

/** Value noise on an integer lattice, smooth. */
function noise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const h = (a: number, b: number) => hash1(Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ seed);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export type ClothOptions = {
  width: number;
  height: number;
  dpr: number;
  base: Rgb;
  /** Brightness of the whole cloth, 1 = as it is. */
  brightness: number;
  /** Centres (px, in card space) of gold woven stripes, e.g. the selvedge of every belt. */
  stripes: number[];
};

const GOLD: Rgb = [214, 168, 72];

/**
 * A plain-weave cloth: every thread of warp and weft is a little cylinder, lit from its middle, that goes over and
 * under its neighbours; threads differ slightly in thickness and colour, slubs and folds make it uneven.
 * Returns pixel data for a canvas of `width * dpr` by `height * dpr`.
 */
export function paintCloth(canvas: HTMLCanvasElement, o: ClothOptions) {
  const W = Math.round(o.width * o.dpr);
  const H = Math.round(o.height * o.dpr);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const image = ctx.createImageData(W, H);
  const data = image.data;
  const pitch = 2.6 * o.dpr; // one thread
  const stripeHalf = 2.4 * o.dpr;
  for (let y = 0; y < H; y += 1) {
    const yPitch = y / pitch;
    const j = Math.floor(yPitch);
    const fy = yPitch - j;
    // Gold stripe strength at this row.
    let stripe = 0;
    for (const s of o.stripes) {
      const dy = Math.abs(y - s * o.dpr);
      if (dy < stripeHalf) stripe = Math.max(stripe, 1 - (dy / stripeHalf) ** 2);
    }
    for (let x = 0; x < W; x += 1) {
      const xPitch = x / pitch;
      const i = Math.floor(xPitch);
      const fx = xPitch - i;
      const weftOver = ((i + j) & 1) === 0;
      // Distance across the visible thread (0 edge, 1 middle) and along it (ends dip under the crossing thread).
      const across = Math.sin(Math.PI * (weftOver ? fy : fx));
      const along = 0.68 + 0.32 * Math.sin(Math.PI * (weftOver ? fx : fy));
      let shade = 0.5 + 0.62 * across * along;
      // Thread to thread variation (each weft row and warp column has its own tone), slubs, folds, fibre noise.
      const thread = weftOver ? hash1(j * 7919 + 13) : hash1(i * 6271 + 29);
      shade *= 0.9 + 0.2 * thread;
      shade *= 0.93 + 0.14 * noise(x / (pitch * 9) + (weftOver ? 0 : 17), y / (pitch * 1.4) + 3, 7);
      shade *= 0.94 + 0.12 * noise(x / (pitch * 45), y / (pitch * 60), 3);
      shade *= 0.96 + 0.08 * hash1(x * 31 + y * 17);
      shade *= o.brightness;
      const mixStripe = stripe * (0.8 + 0.2 * thread);
      const r = (o.base[0] + (GOLD[0] - o.base[0]) * mixStripe) * shade;
      const g = (o.base[1] + (GOLD[1] - o.base[1]) * mixStripe) * shade;
      const b = (o.base[2] + (GOLD[2] - o.base[2]) * mixStripe) * shade;
      const k = (y * W + x) * 4;
      data[k] = r > 255 ? 255 : r;
      data[k + 1] = g > 255 ? 255 : g;
      data[k + 2] = b > 255 ? 255 : b;
      data[k + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  // A soft vignette, so the belt looks laid on a table and lit from above.
  const vignette = ctx.createRadialGradient(W / 2, H * 0.4, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(20,0,4,0.34)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}
