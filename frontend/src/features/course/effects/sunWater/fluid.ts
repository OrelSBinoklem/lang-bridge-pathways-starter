/**
 * The water of the "Солнце и вода" effect: a position-based particle fluid (double density relaxation,
 * Clavet et al., "Particle-based viscoelastic fluid simulation") plus a pool of ballistic spray drops.
 * Pure functions over typed arrays, no DOM, so the behaviour (settling, damping, stability) can be
 * measured in node.
 */

/** Share of the card's height the resting water occupies, and the bounds of the particle pool at detail 1. */
export const FILL_RATIO = 0.34;
const MIN_FILL_PX = 46;
const MIN_PARTICLES = 90;
const MAX_PARTICLES = 520;
/** Area of card covered per particle at detail 1, in px². */
const AREA_PER_PARTICLE = 150;
/** Interaction radius relative to the particle spacing. */
const H_TO_SPACING = 2.2;
/** The detail the defaults are tuned for; splashes, spray and pressure are measured against a pool of this detail. */
const REFERENCE_DETAIL = 2;
/** How strongly the pressure relaxation stiffens as particles shrink below the reference size (see stepFluid). */
const PRESSURE_GAMMA = 1;
/** Velocity averaging between neighbours at full strength (used for water much finer than the reference). */
const FINE_VISCOSITY = 0.1;
/** A particle with this many neighbours or fewer counts as a loose drop. */
const LONELY_NEIGHBOURS = 2;
export const STIFFNESS = 0.32;
export const NEAR_STIFFNESS = 0.55;
export const GRAVITY = 0.42;
const MAX_SPEED = 14;
export const SUBSTEPS = 2;
/** More, smaller substeps lose less energy to the scheme itself, which is what lets waves last. */
export const EFFECT_SUBSTEPS = 3;
/** Fixed simulation rate: one physics step per 1/60 s, independent of the monitor's refresh rate. */
export const SIM_DT = 1 / 60;

export type Rng = () => number;

export type Fluid = {
  width: number;
  height: number;
  count: number;
  /** Distance between neighbouring particles at rest. */
  spacing: number;
  /** Interaction radius. */
  h: number;
  floorY: number;
  restRho: number;
  px: Float32Array;
  py: Float32Array;
  ox: Float32Array;
  oy: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  gridCols: number;
  gridRows: number;
  head: Int32Array;
  next: Int32Array;
  neighbours: Int32Array;
  neighbourQ: Float32Array;
  /** Highest particle per horizontal slot (px, smaller = higher), refreshed every step. */
  tops: Float32Array;
  topSlot: number;
  /** Particle count and interaction radius the card would have at the default detail: the yardstick for the rest. */
  refCount: number;
  /** Radius (px) of the cluster a splash kicks, the same at every detail. */
  splashRadius: number;
  /** Extra stiffness of the pressure relaxation for particles smaller than the reference ones. */
  pressureScale: number;
  /** Velocity averaging between neighbours (0 at the reference detail and below, more for finer water). */
  viscosity: number;
  /** 1 for a particle that has (almost) no neighbours: a loose drop, too thin to show in the density field. */
  lonely: Uint8Array;
};

const scratch = { n: 0, rho: 0, rhoNear: 0 };

/** Neighbour-grid column/row of a coordinate (the grid has a one-cell border). */
const cellIndex = (value: number, h: number, size: number) => Math.min(size - 1, Math.max(0, Math.floor(value / h) + 1));

function buildGrid(f: Fluid) {
  f.head.fill(-1);
  for (let i = 0; i < f.count; i += 1) {
    const cell = cellIndex(f.py[i], f.h, f.gridRows) * f.gridCols + cellIndex(f.px[i], f.h, f.gridCols);
    f.next[i] = f.head[cell];
    f.head[cell] = i;
  }
}

/** Sums the density kernel around particle i; fills `neighbours`/`neighbourQ` and the module's `scratch`. */
function gather(f: Fluid, i: number) {
  const { px, py, head, next, neighbours, neighbourQ, h, gridCols, gridRows } = f;
  const x = px[i];
  const y = py[i];
  const cx = cellIndex(x, h, gridCols);
  const cy = cellIndex(y, h, gridRows);
  const h2 = h * h;
  const invH = 1 / h;
  const room = neighbours.length;
  let n = 0;
  let rho = 0;
  let rhoNear = 0;
  for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
    if (gy < 0 || gy >= gridRows) continue;
    for (let gx = cx - 1; gx <= cx + 1; gx += 1) {
      if (gx < 0 || gx >= gridCols) continue;
      for (let j = head[gy * gridCols + gx]; j !== -1; j = next[j]) {
        if (j === i || n >= room) continue;
        const dx = px[j] - x;
        const dy = py[j] - y;
        const r2 = dx * dx + dy * dy;
        if (r2 >= h2 || r2 < 1e-8) continue;
        const q = 1 - Math.sqrt(r2) * invH;
        neighbours[n] = j;
        neighbourQ[n] = q;
        rho += q * q;
        rhoNear += q * q * q;
        n += 1;
      }
    }
  }
  scratch.n = n;
  scratch.rho = rho;
  scratch.rhoNear = rhoNear;
}

/** Number of particles a card of this size gets. `detail` 2 means twice as many as the first version. */
export function particleCount(width: number, height: number, detail: number) {
  const fillHeight = Math.max(MIN_FILL_PX, height * FILL_RATIO);
  const raw = Math.round((width * fillHeight) / (AREA_PER_PARTICLE / detail));
  return Math.max(Math.round(MIN_PARTICLES * detail), Math.min(Math.round(MAX_PARTICLES * detail), raw));
}

export function createFluid(width: number, height: number, detail: number): Fluid {
  const fillHeight = Math.max(MIN_FILL_PX, height * FILL_RATIO);
  const count = particleCount(width, height, detail);
  const spacing = Math.sqrt((width * fillHeight) / count);
  const h = spacing * H_TO_SPACING;
  const refCount = particleCount(width, height, REFERENCE_DETAIL);
  const refH = Math.sqrt((width * fillHeight) / refCount) * H_TO_SPACING;
  const floorY = height - 1;
  const cols = Math.max(1, Math.floor(width / spacing));
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    px[i] = Math.min(width - 1, spacing * 0.5 + (i % cols) * spacing + ((Math.floor(i / cols) % 2) * spacing) / 4);
    py[i] = floorY - spacing * 0.5 - Math.floor(i / cols) * spacing * 0.9;
  }
  const gridCols = Math.ceil(width / h) + 2;
  const gridRows = Math.ceil(height / h) + 2;
  const topSlot = Math.max(2, h * 0.5);
  const fluid: Fluid = {
    width,
    height,
    count,
    spacing,
    h,
    floorY,
    restRho: 3,
    px,
    py,
    ox: new Float32Array(count),
    oy: new Float32Array(count),
    vx: new Float32Array(count),
    vy: new Float32Array(count),
    gridCols,
    gridRows,
    head: new Int32Array(gridCols * gridRows),
    next: new Int32Array(count),
    neighbours: new Int32Array(96),
    neighbourQ: new Float32Array(96),
    tops: new Float32Array(Math.ceil(width / topSlot) + 1).fill(floorY),
    topSlot,
    refCount,
    splashRadius: refH * 1.6,
    pressureScale: Math.max(1, refH / h) ** PRESSURE_GAMMA,
    viscosity: FINE_VISCOSITY * Math.min(1, Math.max(0, refH / h - 1)),
    lonely: new Uint8Array(count),
  };

  // Rest density = the average density of the initial pool, so the water starts calm at any card size.
  buildGrid(fluid);
  let total = 0;
  let samples = 0;
  for (let i = 0; i < count; i += 1) {
    gather(fluid, i);
    if (scratch.n >= 6) {
      total += scratch.rho;
      samples += 1;
    }
  }
  fluid.restRho = samples > 0 ? total / samples : 3;
  return fluid;
}

export type StepOptions = {
  gravity: number;
  /** Share of velocity lost per frame (0.008 in the first version). */
  drag: number;
  /** Physics substeps per frame: more of them means less numerical damping (2 in the first version). */
  substeps: number;
  stiffness: number;
  nearStiffness: number;
  /** Extra horizontal acceleration this step (the pool's rocking), px per frame². */
  sway: number;
  /** The cup the cursor turned into, if any: solid walls the water cannot cross. */
  vessel?: Vessel | null;
};

export const DEFAULT_STEP: StepOptions = {
  gravity: GRAVITY,
  drag: 0.008,
  substeps: SUBSTEPS,
  stiffness: STIFFNESS,
  nearStiffness: NEAR_STIFFNESS,
  sway: 0,
};

/** Advances the water by one 1/60 s frame. */
export function stepFluid(f: Fluid, options: StepOptions) {
  const { px, py, ox, oy, vx, vy, count, h, width, floorY } = f;
  const sub = Math.max(1, Math.round(options.substeps));
  const keep = (1 - options.drag) ** (1 / sub);
  // Gravity is in px, so with smaller particles the same pool is deeper in particle layers and would be squeezed
  // more and more; a stiffer relaxation keeps the water's depth the same at any detail.
  const relax = (h * 0.02 * f.pressureScale) / sub;
  const viscous = f.viscosity / (2 * sub);
  for (let s = 0; s < sub; s += 1) {
    for (let i = 0; i < count; i += 1) {
      vy[i] += options.gravity / sub;
      vx[i] += options.sway / sub;
      vx[i] *= keep;
      vy[i] *= keep;
      ox[i] = px[i];
      oy[i] = py[i];
      px[i] += vx[i] / sub;
      py[i] += vy[i] / sub;
    }
    buildGrid(f);
    const lastSub = s === sub - 1;
    for (let i = 0; i < count; i += 1) {
      gather(f, i);
      const n = scratch.n;
      if (lastSub) f.lonely[i] = n <= LONELY_NEIGHBOURS ? 1 : 0;
      const pressure = options.stiffness * (scratch.rho - f.restRho);
      const nearPressure = options.nearStiffness * scratch.rhoNear;
      for (let k = 0; k < n; k += 1) {
        const j = f.neighbours[k];
        const q = f.neighbourQ[k];
        const dx = px[j] - px[i];
        const dy = py[j] - py[i];
        const r = Math.sqrt(dx * dx + dy * dy) || 1;
        const d = ((pressure * q + nearPressure * q * q) * relax * 0.5) / r;
        const ex = dx * d;
        const ey = dy * d;
        px[i] -= ex;
        py[i] -= ey;
        px[j] += ex;
        py[j] += ey;
        if (viscous > 0) {
          // Neighbours pull each other's velocity together (XSPH-like), which calms the small-scale chatter.
          const share = viscous * q;
          const sx = (vx[j] - vx[i]) * share;
          const sy = (vy[j] - vy[i]) * share;
          px[i] += sx;
          py[i] += sy;
          px[j] -= sx;
          py[j] -= sy;
        }
      }
    }
    const vessel = options.vessel;
    if (vessel && vessel.active) {
      // The walls sweep from where the cup was at the start of the frame to where it is now, a substep at a time.
      const k = (s + 1) / sub;
      const centreY = vessel.prevY + (vessel.y - vessel.prevY) * k;
      const lastY = vessel.prevY + (vessel.y - vessel.prevY) * (s / sub);
      collideVessel(f, vessel, vessel.prevX + (vessel.x - vessel.prevX) * k, centreY, centreY - lastY, sub);
    }
    for (let i = 0; i < count; i += 1) {
      if (px[i] < 1) px[i] = 1;
      else if (px[i] > width - 1) px[i] = width - 1;
      if (py[i] > floorY) py[i] = floorY;
      if (py[i] < 1) py[i] = 1;
      vx[i] = (px[i] - ox[i]) * sub;
      vy[i] = (py[i] - oy[i]) * sub;
      const speed2 = vx[i] * vx[i] + vy[i] * vy[i];
      if (speed2 > MAX_SPEED * MAX_SPEED) {
        const k = MAX_SPEED / Math.sqrt(speed2);
        vx[i] *= k;
        vy[i] *= k;
      }
    }
  }
  refreshTops(f);
}

function refreshTops(f: Fluid) {
  f.tops.fill(f.floorY);
  for (let i = 0; i < f.count; i += 1) {
    const slot = Math.min(f.tops.length - 1, Math.max(0, Math.floor(f.px[i] / f.topSlot)));
    if (f.py[i] < f.tops[slot]) f.tops[slot] = f.py[i];
  }
}

/** Height (px, smaller = higher) of the water surface above x. */
export function surfaceAt(f: Fluid, x: number): number {
  const slot = Math.min(f.tops.length - 1, Math.max(0, Math.floor(x / f.topSlot)));
  return f.tops[slot];
}

/** Pushes the water away from a point, as the cursor does. `mx`/`my` is the cursor's own motion. */
export function pushFluid(f: Fluid, cx: number, cy: number, mx: number, my: number, radius: number, strength: number) {
  for (let i = 0; i < f.count; i += 1) {
    const dx = f.px[i] - cx;
    const dy = f.py[i] - cy;
    const d = Math.hypot(dx, dy);
    if (d > radius || d < 0.001) continue;
    const power = (1 - d / radius) * strength;
    f.vx[i] += (dx / d) * power + mx * power * 0.4;
    f.vy[i] += (dy / d) * power + my * power * 0.4;
  }
}

/** Upward speed (px/frame) a splash gives the middle of its cluster at power 1. The first version gave 4 to 7. */
const SPLASH_KICK = 2.2;

/**
 * Kicks a cluster of the surface upwards, so the pool throws a splash. The cluster is the same size in px at any
 * detail and its kick fades out toward the edge; `power` scales the kick (1 = a gentle splash).
 */
export function geyser(f: Fluid, rng: Rng, power = 1) {
  if (power <= 0) return;
  const x = f.width * (0.08 + rng() * 0.84);
  const y = surfaceAt(f, x);
  const reach = f.splashRadius;
  for (let i = 0; i < f.count; i += 1) {
    const dx = f.px[i] - x;
    const dy = f.py[i] - y;
    const d2 = (dx * dx + dy * dy) / (reach * reach);
    if (d2 >= 1) continue;
    const fade = 1 - d2;
    f.vy[i] -= (SPLASH_KICK + rng() * SPLASH_KICK * 0.7) * power * fade;
    f.vx[i] += (rng() - 0.5) * 1.6 * power * fade;
  }
}

export function kineticEnergy(f: Fluid): number {
  let sum = 0;
  for (let i = 0; i < f.count; i += 1) sum += f.vx[i] * f.vx[i] + f.vy[i] * f.vy[i];
  return sum / 2;
}

// ---- the cup -------------------------------------------------------------------------------------------------

/**
 * A cup with a hole in its bottom, which the cursor can turn into: dip it in, lift it, and the water it took
 * seeps out through the hole. Four solid rectangles (two walls, two halves of the bottom); the water is pushed
 * out of them after every relaxation, so it can neither enter the walls nor leave the cup except through the top
 * or the hole.
 */
export type Vessel = {
  /** Outer size and wall thickness, px. */
  width: number;
  height: number;
  wall: number;
  /** Width of the gap in the bottom, px. */
  hole: number;
  /** Fastest the water may move down through the gap, px per frame (relative to the cup). */
  leak: number;
  /** Centre now, and at the start of this frame (the walls sweep between the two). */
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  active: boolean;
};

/**
 * Fastest the cup may move, px per frame, at the usual three substeps. A wall must not travel further in one
 * substep than the thickness it is caught by (the wall plus a particle's width), so with fewer substeps the cup
 * has to be slower: pass `maxStep = substeps * VESSEL_STEP_PER_SUBSTEP`.
 */
export const VESSEL_MAX_STEP = 16;
export const VESSEL_STEP_PER_SUBSTEP = 5;

/** Down speed through the gap at leak 1, px per frame. A full cup empties in several seconds. */
const LEAK_SPEED = 0.18;

/**
 * Size the cup for this pool. `size` scales the cup (1 = default), `hole` the gap in its bottom, `leak` how fast
 * water seeps through it (all 1 = default).
 */
export function vesselDimensions(f: Fluid, size = 1, hole = 1, leak = 1) {
  const width = Math.max(36, Math.min(66, f.height * 0.3)) * size;
  const height = width * 0.8;
  // The gap is a few px wide at any detail, but never narrower than a particle can get through: a particle is a
  // disc of `0.35 * spacing` (see collideVessel), so it needs a little over twice that.
  const gap = Math.min(width * 0.5, Math.max(8 * hole, f.spacing * 0.7 * 1.3));
  return { width, height, wall: 6, hole: gap, leak: LEAK_SPEED * leak };
}

export function createVessel(f: Fluid, size = 1, hole = 1, leak = 1): Vessel {
  return { ...vesselDimensions(f, size, hole, leak), x: f.width / 2, y: f.height / 2, prevX: f.width / 2, prevY: f.height / 2, active: false };
}

/** Lowest the cup's centre may go: it stops a particle's width above the floor, so no water gets pinned under it. */
const vesselLowest = (f: Fluid, v: Vessel) => f.floorY - v.height / 2 - f.spacing * 0.7 - 1;

/** Puts the cup at a point with no sweep (the moment it appears). */
export function placeVessel(f: Fluid, v: Vessel, x: number, y: number) {
  const cx = Math.min(f.width - v.width / 2 - 1, Math.max(v.width / 2 + 1, x));
  const cy = Math.min(vesselLowest(f, v), Math.max(v.height / 2, y));
  v.x = cx;
  v.y = cy;
  v.prevX = cx;
  v.prevY = cy;
}

/** Moves the cup toward a point: it follows smoothly, never further than `maxStep` px, and stays inside the card. */
export function moveVessel(f: Fluid, v: Vessel, targetX: number, targetY: number, maxStep = VESSEL_MAX_STEP) {
  v.prevX = v.x;
  v.prevY = v.y;
  const tx = Math.min(f.width - v.width / 2 - 1, Math.max(v.width / 2 + 1, targetX));
  const ty = Math.min(vesselLowest(f, v), Math.max(v.height / 2, targetY));
  const dx = tx - v.x;
  const dy = ty - v.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.01) return;
  const step = Math.min(dist, Math.max(0.6, dist * 0.55), maxStep);
  v.x += (dx / dist) * step;
  v.y += (dy / dist) * step;
}

/** The four solid rectangles of a cup centred at (cx, cy): x0, y0, x1, y1 each. */
const rects = new Float64Array(16);

function collideVessel(f: Fluid, v: Vessel, cx: number, cy: number, moved: number, sub: number) {
  const hw = v.width / 2;
  const hh = v.height / 2;
  const gap = v.hole / 2;
  // Left wall, right wall, bottom left of the hole, bottom right of the hole.
  rects[0] = cx - hw; rects[1] = cy - hh; rects[2] = cx - hw + v.wall; rects[3] = cy + hh;
  rects[4] = cx + hw - v.wall; rects[5] = cy - hh; rects[6] = cx + hw; rects[7] = cy + hh;
  rects[8] = cx - hw; rects[9] = cy + hh - v.wall; rects[10] = cx - gap; rects[11] = cy + hh;
  rects[12] = cx + gap; rects[13] = cy + hh - v.wall; rects[14] = cx + hw; rects[15] = cy + hh;
  // A particle is a disc: the walls are grown by its radius.
  const r = f.spacing * 0.35;
  const { px, py } = f;
  const left = cx - hw - r;
  const right = cx + hw + r;
  const top = cy - hh - r;
  const bottom = cy + hh + r;
  const orificeTop = cy + hh - v.wall - 2 * r;
  const orificeBottom = cy + hh + r;
  for (let i = 0; i < f.count; i += 1) {
    let x = px[i];
    let y = py[i];
    if (x < left || x > right || y < top || y > bottom) continue;
    // Twice, because leaving one rectangle can land a particle in the next (a corner of the cup).
    for (let pass = 0; pass < 2; pass += 1) {
      for (let k = 0; k < 16; k += 4) {
        const x0 = rects[k] - r;
        const y0 = rects[k + 1] - r;
        const x1 = rects[k + 2] + r;
        const y1 = rects[k + 3] + r;
        if (x <= x0 || x >= x1 || y <= y0 || y >= y1) continue;
        const toLeft = x - x0;
        const toRight = x1 - x;
        const toTop = y - y0;
        const toBottom = y1 - y;
        const nearest = Math.min(toLeft, toRight, toTop, toBottom);
        if (nearest === toLeft) x = x0;
        else if (nearest === toRight) x = x1;
        else if (nearest === toTop) y = y0;
        else y = y1;
      }
    }
    // The gap is a narrow neck rather than a free fall: water goes through it slowly (relative to the cup), which
    // is what makes a full cup seep for seconds instead of emptying at once.
    if (Math.abs(x - cx) < gap && y > orificeTop && y < orificeBottom) {
      const allowed = f.oy[i] + moved + v.leak / sub;
      if (y > allowed) y = allowed;
    }
    px[i] = x;
    py[i] = y;
  }
}

// ---- spray -------------------------------------------------------------------------------------------------

export type Spray = {
  max: number;
  count: number;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  /** Radius in px. */
  size: Float32Array;
  /** Random phase for twinkling. */
  phase: Float32Array;
  /** Seconds since the drop left the water. */
  age: Float32Array;
};

export function createSpray(max: number): Spray {
  return {
    max,
    count: 0,
    x: new Float32Array(max),
    y: new Float32Array(max),
    vx: new Float32Array(max),
    vy: new Float32Array(max),
    size: new Float32Array(max),
    phase: new Float32Array(max),
    age: new Float32Array(max),
  };
}

const SPRAY_MIN_UP_SPEED = 3;
const SPRAY_CHANCE = 0.05;

/**
 * Lets fast, upward-moving particles near the surface shed drops. `amount` scales how many. The chance is per
 * particle, so it shrinks as there are more of them: the spray stays the same at any detail.
 */
export function emitSpray(f: Fluid, s: Spray, rng: Rng, amount: number) {
  if (amount <= 0) return;
  const chance = SPRAY_CHANCE * amount * Math.min(1, f.refCount / f.count);
  const band = f.splashRadius * 0.75;
  for (let i = 0; i < f.count && s.count < s.max; i += 1) {
    if (f.vy[i] > -SPRAY_MIN_UP_SPEED) continue;
    if (f.py[i] > surfaceAt(f, f.px[i]) + band) continue;
    if (rng() > chance) continue;
    const k = s.count;
    const speed = Math.hypot(f.vx[i], f.vy[i]);
    const spread = 0.35 + rng() * 0.5;
    s.x[k] = f.px[i] + (rng() - 0.5) * f.spacing * 0.6;
    s.y[k] = f.py[i] - f.spacing * 0.4;
    s.vx[k] = f.vx[i] * (0.7 + rng() * 0.5) + (rng() - 0.5) * speed * spread * 0.6;
    s.vy[k] = f.vy[i] * (0.8 + rng() * 0.5);
    s.size[k] = 0.9 + rng() * 1.7;
    s.phase[k] = rng() * Math.PI * 2;
    s.age[k] = 0;
    s.count += 1;
  }
}

/** Ballistic flight; a drop that reaches the water (or a wall) is gone. */
export function stepSpray(f: Fluid, s: Spray, gravity: number) {
  let k = 0;
  while (k < s.count) {
    s.vy[k] += gravity;
    s.x[k] += s.vx[k];
    s.y[k] += s.vy[k];
    s.age[k] += SIM_DT;
    const inWater = s.vy[k] > 0 && s.y[k] > surfaceAt(f, s.x[k]) + f.spacing * 0.2;
    const outside = s.x[k] < 0 || s.x[k] > f.width || s.y[k] > f.floorY || s.age[k] > 4;
    if (inWater || outside) {
      const last = s.count - 1;
      if (k !== last) {
        s.x[k] = s.x[last];
        s.y[k] = s.y[last];
        s.vx[k] = s.vx[last];
        s.vy[k] = s.vy[last];
        s.size[k] = s.size[last];
        s.phase[k] = s.phase[last];
        s.age[k] = s.age[last];
      }
      s.count -= 1;
    } else {
      k += 1;
    }
  }
}
