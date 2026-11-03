/**
 * The thread that hangs from the needle: a chain of points (Verlet integration) pinned at both ends, longer than the
 * distance between them, so that it sags under its own weight and swings when the needle moves. Pure, no DOM.
 */
export type Rope = {
  n: number;
  x: Float32Array;
  y: Float32Array;
  ox: Float32Array;
  oy: Float32Array;
};

export function createRope(n: number, ax: number, ay: number, bx: number, by: number): Rope {
  const rope: Rope = { n, x: new Float32Array(n), y: new Float32Array(n), ox: new Float32Array(n), oy: new Float32Array(n) };
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    rope.x[i] = rope.ox[i] = ax + (bx - ax) * t;
    rope.y[i] = rope.oy[i] = ay + (by - ay) * t + Math.sin(t * Math.PI) * 30;
  }
  return rope;
}

export type RopeOptions = {
  /** px/s². */
  gravity: number;
  /** Share of speed kept per step (1 = none lost). */
  damping: number;
  /** Extra length over the straight distance: the slack that makes it sag. */
  slack: number;
  /** A slow sideways breath of air, px per step. */
  breeze: number;
  time: number;
};

export const DEFAULT_ROPE: RopeOptions = { gravity: 1500, damping: 0.982, slack: 1.12, breeze: 0.05, time: 0 };

export function stepRope(rope: Rope, ax: number, ay: number, bx: number, by: number, dt: number, options: RopeOptions = DEFAULT_ROPE) {
  const { n, x, y, ox, oy } = rope;
  const step = Math.min(dt, 1 / 30);
  const total = Math.max(90, Math.hypot(bx - ax, by - ay) * options.slack + 28);
  const seg = total / (n - 1);
  for (let i = 1; i < n - 1; i += 1) {
    const vx = (x[i] - ox[i]) * options.damping;
    const vy = (y[i] - oy[i]) * options.damping;
    ox[i] = x[i];
    oy[i] = y[i];
    x[i] += vx + Math.sin(options.time * 0.9 + i * 0.45) * options.breeze;
    y[i] += vy + options.gravity * step * step;
  }
  x[0] = ax;
  y[0] = ay;
  x[n - 1] = bx;
  y[n - 1] = by;
  for (let iteration = 0; iteration < 16; iteration += 1) {
    for (let i = 0; i < n - 1; i += 1) {
      const dx = x[i + 1] - x[i];
      const dy = y[i + 1] - y[i];
      const d = Math.hypot(dx, dy) || 1e-4;
      const diff = (d - seg) / d;
      const wa = i === 0 ? 0 : 0.5;
      const wb = i === n - 2 ? 0 : 0.5;
      const share = wa + wb || 1;
      x[i] += (dx * diff * wa) / share;
      y[i] += (dy * diff * wa) / share;
      x[i + 1] -= (dx * diff * wb) / share;
      y[i + 1] -= (dy * diff * wb) / share;
    }
    x[0] = ax;
    y[0] = ay;
    x[n - 1] = bx;
    y[n - 1] = by;
  }
}

/** Fills `out` (x0, y0, x1, y1, ...) with a smooth curve through the rope's points (Catmull-Rom); returns the count. */
export function ropeCurve(rope: Rope, out: Float32Array, subdivisions = 3): number {
  const { n, x, y } = rope;
  let count = 0;
  for (let i = 0; i < n - 1; i += 1) {
    const i0 = Math.max(0, i - 1);
    const i3 = Math.min(n - 1, i + 2);
    for (let s = 0; s < subdivisions; s += 1) {
      const t = s / subdivisions;
      const t2 = t * t;
      const t3 = t2 * t;
      out[count * 2] = 0.5 * (2 * x[i] + (-x[i0] + x[i + 1]) * t + (2 * x[i0] - 5 * x[i] + 4 * x[i + 1] - x[i3]) * t2 + (-x[i0] + 3 * x[i] - 3 * x[i + 1] + x[i3]) * t3);
      out[count * 2 + 1] = 0.5 * (2 * y[i] + (-y[i0] + y[i + 1]) * t + (2 * y[i0] - 5 * y[i] + 4 * y[i + 1] - y[i3]) * t2 + (-y[i0] + 3 * y[i] - 3 * y[i + 1] + y[i3]) * t3);
      count += 1;
    }
  }
  out[count * 2] = x[n - 1];
  out[count * 2 + 1] = y[n - 1];
  return count + 1;
}
