/** Geometry of the octopus' tentacles: tapered S-curves from a base under the body to a tip anywhere on screen. */
export type Pt = { x: number; y: number };

const bez = (a: number, b: number, c: number, d: number, u: number) => {
  const v = 1 - u;
  return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d;
};

/**
 * Outline path and sucker circles of one tentacle. It leaves the body downward, sags under its own weight and
 * sways with `time`; the width tapers from `wBase` to `wTip`. Suckers sit on the underside (the right of the
 * travel direction).
 */
export function tentacle(base: Pt, tip: Pt, time: number, seed: number, wBase = 16, wTip = 3) {
  const dx = tip.x - base.x, dy = tip.y - base.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const sway = Math.sin(time * 1.9 + seed * 2.3) * Math.min(38, len * 0.16);
  const drop = Math.min(110, len * 0.38);
  const c1 = { x: base.x + dx * 0.12 + nx * sway * 0.5, y: base.y + drop + dy * 0.1 };
  const c2 = { x: tip.x - dx * 0.32 - nx * sway, y: tip.y - dy * 0.32 - ny * sway + drop * 0.25 };
  const N = 30, left: Pt[] = [], right: Pt[] = [], suckers: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, e = Math.min(1, u + 0.001), s = Math.max(0, u - 0.001);
    const p = { x: bez(base.x, c1.x, c2.x, tip.x, u), y: bez(base.y, c1.y, c2.y, tip.y, u) };
    const tx = bez(base.x, c1.x, c2.x, tip.x, e) - bez(base.x, c1.x, c2.x, tip.x, s);
    const ty = bez(base.y, c1.y, c2.y, tip.y, e) - bez(base.y, c1.y, c2.y, tip.y, s);
    const tl = Math.hypot(tx, ty) || 1, ox = -ty / tl, oy = tx / tl;
    const w = (wBase + (wTip - wBase) * Math.pow(u, 0.75)) / 2;
    left.push({ x: p.x + ox * w, y: p.y + oy * w });
    right.push({ x: p.x - ox * w, y: p.y - oy * w });
    if (i > 2 && i < N - 1 && i % 2 === 0) suckers.push({ x: p.x - ox * w * 0.42, y: p.y - oy * w * 0.42, r: Math.max(1.2, w * 0.38) });
  }
  const f = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  const tipR = Math.max(1, wTip / 2);
  const d = `M${f(left[0])}${left.slice(1).map(p => `L${f(p)}`).join('')}A${tipR} ${tipR} 0 0 1 ${f(right[N])}${right.slice(0, N).reverse().map(p => `L${f(p)}`).join('')}Z`;
  const cups = suckers.map(c => `M${(c.x - c.r).toFixed(1)} ${c.y.toFixed(1)}a${c.r.toFixed(1)} ${c.r.toFixed(1)} 0 1 0 ${(2 * c.r).toFixed(1)} 0a${c.r.toFixed(1)} ${c.r.toFixed(1)} 0 1 0 ${(-2 * c.r).toFixed(1)} 0`).join('');
  return { d, cups };
}

/** The point of a rectangle closest to `p` (where a tentacle touches a highlighted area). */
export function touchPoint(r: { left: number; top: number; right: number; bottom: number }, p: Pt): Pt {
  return { x: Math.min(r.right, Math.max(r.left, p.x)), y: Math.min(r.bottom, Math.max(r.top, p.y)) };
}

/** Union of element rectangles (a column is many cells). */
export function unionRect(rects: { left: number; top: number; right: number; bottom: number }[]) {
  if (!rects.length) return null;
  return rects.reduce((a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
}
