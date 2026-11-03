/**
 * Draws a piece of thread so that it looks like thread and not like a line: a soft shadow on the cloth, a darker rim,
 * the body, the twist of the plies (short slanted light and dark dashes along the thread), a highlight on the side
 * that faces the light, and a few stray fibres. The same routine draws a finished stitch and the live thread that
 * hangs from the needle.
 */
export type Rgb = [number, number, number];

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const rgba = (c: Rgb, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

/** A repeatable random number in [0, 1) for an integer. */
export function hash1(seed: number) {
  let n = Math.imul(seed | 0, 2246822519);
  n = Math.imul(n ^ (n >>> 15), 3266489917);
  n = Math.imul(n ^ (n >>> 13), 668265263);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export type ThreadStyle = {
  color: Rgb;
  /** Thickness in px. */
  width: number;
  /** Contrast of the twist, 0 = none. */
  twist: number;
  /** Amount of stray fibres, 0 = none. */
  fuzz: number;
  /** Seed for the fibres, so that a stitch looks the same every time it is drawn. */
  seed: number;
  /** Strength of the shadow on the cloth, 0 = none. */
  shadow: number;
};

/** Where the light comes from (a unit vector, pointing at the light): the top left. */
const LIGHT = { x: -0.55, y: -0.835 };
const WHITE: Rgb = [255, 250, 238];
const DARK: Rgb = [18, 5, 9];

function strokePolyline(ctx: CanvasRenderingContext2D, pts: ArrayLike<number>, count: number, style: string, width: number) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 1; i < count; i += 1) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** `pts` is x0, y0, x1, y1, ...; `count` points are used. */
export function drawThread(ctx: CanvasRenderingContext2D, pts: ArrayLike<number>, count: number, s: ThreadStyle) {
  if (count < 2) return;
  const w = s.width;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (s.shadow > 0) {
    ctx.save();
    ctx.translate(-LIGHT.x * w * 0.55, -LIGHT.y * w * 0.55);
    strokePolyline(ctx, pts, count, rgba(DARK, 0.34 * s.shadow), w * 1.2);
    ctx.restore();
  }
  strokePolyline(ctx, pts, count, rgba(mix(s.color, DARK, 0.5)), w);
  strokePolyline(ctx, pts, count, rgba(s.color), w * 0.8);

  // Twist: slanted dashes across the thread, one light and one dark per turn.
  const step = Math.max(1.5, w * 0.78);
  const half = w * 0.44;
  const light = new Path2D();
  const dark = new Path2D();
  const hairs = new Path2D();
  const rim = new Path2D();
  let carry = 0;
  let along = 0;
  let firstRim = true;
  for (let i = 0; i < count - 1; i += 1) {
    const x0 = pts[i * 2];
    const y0 = pts[i * 2 + 1];
    const x1 = pts[i * 2 + 2];
    const y1 = pts[i * 2 + 3];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1e-4) continue;
    const tx = (x1 - x0) / len;
    const ty = (y1 - y0) / len;
    const nx = -ty;
    const ny = tx;
    // The side of the thread that faces the light gets a thin highlight.
    const side = nx * LIGHT.x + ny * LIGHT.y >= 0 ? 1 : -1;
    const ox = nx * side * w * 0.2;
    const oy = ny * side * w * 0.2;
    if (firstRim) {
      rim.moveTo(x0 + ox, y0 + oy);
      firstRim = false;
    }
    rim.lineTo(x1 + ox, y1 + oy);
    let d = carry;
    while (d < len) {
      const px = x0 + tx * d;
      const py = y0 + ty * d;
      const dx = nx + tx * 0.95;
      const dy = ny + ty * 0.95;
      const inv = half / Math.hypot(dx, dy);
      light.moveTo(px - dx * inv, py - dy * inv);
      light.lineTo(px + dx * inv, py + dy * inv);
      const dd = d + step * 0.5;
      if (dd < len) {
        const qx = x0 + tx * dd;
        const qy = y0 + ty * dd;
        dark.moveTo(qx - dx * inv, qy - dy * inv);
        dark.lineTo(qx + dx * inv, qy + dy * inv);
      }
      // A stray fibre now and then, leaving the thread at a shallow angle.
      if (s.fuzz > 0) {
        const k = Math.floor((along + d) / (step * 2.4));
        const r = hash1(s.seed * 131 + k);
        if (r < 0.45 * s.fuzz && Math.floor((along + d) / step) % 2 === 0) {
          const sgn = hash1(s.seed * 17 + k * 7) > 0.5 ? 1 : -1;
          const lenHair = w * (0.6 + hash1(s.seed + k * 3) * 1.1);
          const slant = (hash1(s.seed * 5 + k) - 0.3) * 1.3;
          const sx = px + nx * sgn * w * 0.34;
          const sy = py + ny * sgn * w * 0.34;
          hairs.moveTo(sx, sy);
          hairs.lineTo(sx + (nx * sgn + tx * slant) * lenHair, sy + (ny * sgn + ty * slant) * lenHair);
        }
      }
      d += step;
    }
    carry = d - len;
    along += len;
  }
  ctx.lineWidth = step * 0.44;
  ctx.strokeStyle = rgba(mix(s.color, WHITE, 0.55), 0.55 * s.twist);
  ctx.stroke(light);
  ctx.lineWidth = step * 0.4;
  ctx.strokeStyle = rgba(mix(s.color, DARK, 0.55), 0.42 * s.twist);
  ctx.stroke(dark);
  ctx.lineWidth = Math.max(0.6, w * 0.2);
  ctx.strokeStyle = rgba(mix(s.color, WHITE, 0.7), 0.34);
  ctx.stroke(rim);
  if (s.fuzz > 0) {
    ctx.lineWidth = 0.55;
    ctx.strokeStyle = rgba(mix(s.color, WHITE, 0.35), 0.4);
    ctx.stroke(hairs);
  }
  ctx.restore();
}
