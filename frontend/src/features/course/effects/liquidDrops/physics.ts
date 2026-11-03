/**
 * The grid of drops behind the liquid-glass background. Pure functions over typed arrays: no React,
 * no three.js, so the behaviour can be checked in node. Positions are in grid cells: drop (i, j)
 * rests at (i + 0.5, j + 0.5) and only its offset from there is simulated.
 */

/** A drop never leaves its cell by more than this, so the shader's neighbour window stays valid. */
export const MAX_DROP_OFFSET = 0.48;

export type DropGrid = {
  cols: number;
  rows: number;
  ox: Float32Array;
  oy: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  /** Per-drop random phase in [0, 1) so the idle motion does not move in lockstep. */
  phase: Float32Array;
  /** Field amplitude of each drop (its "breathing"), around 1. */
  amp: Float32Array;
  /** Fixed per-drop randoms in [-1, 1]: where the drop sits off the lattice, and how big it is. */
  jx: Float32Array;
  jy: Float32Array;
  size: Float32Array;
};

function mulberry32(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDropGrid(cols: number, rows: number, seed = 7): DropGrid {
  const count = cols * rows;
  const random = mulberry32(seed);
  const phase = new Float32Array(count);
  const jx = new Float32Array(count);
  const jy = new Float32Array(count);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    phase[i] = random();
    jx[i] = random() * 2 - 1;
    jy[i] = random() * 2 - 1;
    size[i] = random() * 2 - 1;
  }
  return {
    cols,
    rows,
    ox: new Float32Array(count),
    oy: new Float32Array(count),
    vx: new Float32Array(count),
    vy: new Float32Array(count),
    phase,
    amp: new Float32Array(count).fill(1),
    jx,
    jy,
    size,
  };
}

export type PointerDrop = {
  /** Grid cell coordinates. */
  x: number;
  y: number;
  /** 0 when the pointer is away, 1 when it is fully present. */
  presence: number;
};

export type StepOptions = {
  dt: number;
  time: number;
  breathe: number;
  /** How far drops sit off the lattice, in cells (0 = a perfect grid). */
  jitter: number;
  /** Spread of the drops' sizes, 0..1. */
  variation: number;
  pointer: PointerDrop | null;
  /** Cells. */
  pullRadius: number;
  pullStrength: number;
  /** 0 = critically damped, 1 = very wobbly. */
  jelly: number;
};

const STIFFNESS = 70;

/** Advances every drop by `dt` seconds: a damped spring toward an idle wobble plus the pointer's pull. */
export function stepDropGrid(grid: DropGrid, options: StepOptions) {
  const { cols, rows, ox, oy, vx, vy, phase, amp, jx, jy, size } = grid;
  const { time, breathe, jitter, variation, pointer, pullRadius, pullStrength, jelly } = options;
  // Substeps keep the spring stable however long a frame took.
  const steps = Math.max(1, Math.ceil(options.dt / 0.016));
  const dt = options.dt / steps;
  // Damping ratio: 1 (no overshoot) down to 0.04 at jelly 1.2, where the drops ring for a long time.
  const damping = 2 * Math.max(0.04, 1 - 0.8 * Math.min(Math.max(jelly, 0), 1.2)) * Math.sqrt(STIFFNESS);
  const pulling = pointer && pointer.presence > 0.001 && pullStrength > 0 && pullRadius > 0;

  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const index = j * cols + i;
      const angle = phase[index] * Math.PI * 2;
      let targetX = jx[index] * jitter;
      let targetY = jy[index] * jitter;

      if (breathe > 0) {
        targetX += Math.sin(time * 0.5 + angle) * 0.07 * breathe;
        targetY += Math.cos(time * 0.43 + angle * 1.7) * 0.07 * breathe;
      }

      if (pulling) {
        const dx = pointer.x - (i + 0.5);
        const dy = pointer.y - (j + 0.5);
        const distance = Math.hypot(dx, dy);
        if (distance < pullRadius && distance > 1e-4) {
          const falloff = (1 - distance / pullRadius) ** 2;
          // Drops right under the pointer are absorbed rather than shoved in a random direction.
          const settle = Math.min(1, distance / 0.6);
          const pull = MAX_DROP_OFFSET * falloff * settle * pullStrength * pointer.presence;
          targetX += (dx / distance) * pull;
          targetY += (dy / distance) * pull;
        }
      }

      let x = ox[index];
      let y = oy[index];
      let vX = vx[index];
      let vY = vy[index];
      for (let step = 0; step < steps; step += 1) {
        vX += (-STIFFNESS * (x - targetX) - damping * vX) * dt;
        vY += (-STIFFNESS * (y - targetY) - damping * vY) * dt;
        x += vX * dt;
        y += vY * dt;
      }

      const length = Math.hypot(x, y);
      if (length > MAX_DROP_OFFSET) {
        const scale = MAX_DROP_OFFSET / length;
        x *= scale;
        y *= scale;
        vX *= 0.5;
        vY *= 0.5;
      }
      ox[index] = x;
      oy[index] = y;
      vx[index] = vX;
      vy[index] = vY;
      amp[index] = (1 + variation * 0.3 * size[index]) * (1 + breathe * 0.1 * Math.sin(time * 0.9 + angle * 1.3));
    }
  }
}

/** Puts every drop at its resting place (no breathing, no pointer): what reduced-motion users see. */
export function restDropGrid(grid: DropGrid, options: { jitter: number; variation: number }) {
  const count = grid.cols * grid.rows;
  for (let index = 0; index < count; index += 1) {
    grid.ox[index] = grid.jx[index] * options.jitter;
    grid.oy[index] = grid.jy[index] * options.jitter;
    grid.vx[index] = 0;
    grid.vy[index] = 0;
    grid.amp[index] = 1 + options.variation * 0.3 * grid.size[index];
  }
}

/** RGBA32F texels for the shader: offset x, offset y, amplitude, 1. */
export function packDropGrid(grid: DropGrid, out: Float32Array) {
  const count = grid.cols * grid.rows;
  for (let index = 0; index < count; index += 1) {
    const at = index * 4;
    out[at] = grid.ox[index];
    out[at + 1] = grid.oy[index];
    out[at + 2] = grid.amp[index];
    out[at + 3] = 1;
  }
}
