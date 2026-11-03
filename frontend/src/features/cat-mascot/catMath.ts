/**
 * Planar two-bone IK. Returns the absolute directions of the upper (`a1`) and lower (`a2`) segments; `bend` picks
 * the side of the joint: +1 = left of the line from the root to the target, -1 = right. Unreachable targets
 * stretch the limb straight toward them.
 */
export function solveTwoBone(sx: number, sy: number, tx: number, ty: number, l1: number, l2: number, bend: number) {
  const dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy);
  const lo = Math.abs(l1 - l2) + 1e-6, hi = l1 + l2 - 1e-6;
  const reach = d >= lo && d <= hi;
  const dc = Math.min(hi, Math.max(lo, d));
  const base = d > 1e-9 ? Math.atan2(dy, dx) : -Math.PI / 2;
  const cosA = Math.min(1, Math.max(-1, (l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc)));
  const a1 = base + Math.sign(bend || 1) * Math.acos(cosA);
  const ex = l1 * Math.cos(a1), ey = l1 * Math.sin(a1);
  const a2 = Math.atan2(dc * Math.sin(base) - ey, dc * Math.cos(base) - ex);
  return { a1, a2, reach };
}

/** Wraps an angle to (-π, π]. */
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Ballistic hop between two page points (y grows downward). The apex clears the higher perch; flight time grows
 * with distance and height like a real jump, within limits that keep it lively. `ceiling` is the highest page y
 * the apex may reach (near the top of the document the page cannot scroll further up), never below a small
 * clearance over the higher perch.
 */
export function jumpArc(ax: number, ay: number, bx: number, by: number, ceiling = -Infinity) {
  const dist = Math.hypot(bx - ax, by - ay);
  let height = Math.max(46 + 0.17 * dist, Math.abs(ay - by) / 2 + 58);
  // Lower the hop until its highest point fits under the ceiling.
  const apex = (h: number) => { let top = Infinity; for (let i = 0; i <= 40; i++) { const s = i / 40; top = Math.min(top, ay + (by - ay) * s - 4 * h * s * (1 - s)); } return top; };
  const clear = Math.min(ay, by) - 16;
  while (apex(height) < ceiling && apex(height * 0.92) <= clear) height *= 0.92;
  const duration = Math.min(1.2, Math.max(0.4, 0.36 + dist * 0.00042 + height * 0.00055));
  return {
    duration, height,
    at: (s: number): [number, number] => [ax + (bx - ax) * s, ay + (by - ay) * s - 4 * height * s * (1 - s)],
    /** Derivative with respect to s (multiply by 1/duration for px per second). */
    velocity: (s: number): [number, number] => [bx - ax, by - ay - 4 * height * (1 - 2 * s)],
  };
}

/**
 * Plans page scrolling for a whole motion in advance. `spans` are the cat's page-space top/bottom at evenly spaced
 * times; the result is a scroll position per sample that keeps every span inside [viewTop, viewBottom] of the
 * viewport, starts at `start`, moves as little as possible and has no kinks (a jump down that first hops up
 * scrolls a little up, then down). Where the cat is taller than the view, its top is kept visible.
 */
export function planScroll(spans: { top: number; bottom: number }[], start: number, maxScroll: number, viewTop: number, viewBottom: number) {
  const n = spans.length, lo = new Float64Array(n), hi = new Float64Array(n);
  spans.forEach(({ top, bottom }, i) => {
    hi[i] = clamp(top - viewTop, 0, maxScroll);
    lo[i] = Math.min(clamp(bottom - viewBottom, 0, maxScroll), hi[i]);
  });
  const end = clamp(start, lo[n - 1], hi[n - 1]);
  let path = Array.from({ length: n }, (_, i) => start + (end - start) * smooth(0, 1, n > 1 ? i / (n - 1) : 1));
  for (let pass = 0; pass < 60; pass++) {
    path = path.map((v, i) => (i === 0 ? start : clamp(v, lo[i], hi[i])));
    path = path.map((v, i) => (i === 0 || i === n - 1 ? v : (path[i - 1] + 2 * v + path[i + 1]) / 4));
  }
  return path.map((v, i) => (i === 0 ? start : clamp(v, lo[i], hi[i])));
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
