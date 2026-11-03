/**
 * The fountain's water: a fixed number of particles that go round and round, none ever made or lost.
 *
 *   pipe  → the pump pushes them out of the nozzle at a steady rate            (hidden, a queue)
 *   jet   → up and back down, ballistic with air drag and wind; a share of the pump feeds a ring of eight nozzles
 *           low in the basin's wall, each throwing an arc in towards the column, into the pool
 *   bowl  → on the upper bowl's surface, drifting out to its lip
 *   sheet → over the lip and down into the basin
 *   spray → a hard landing throws a few back up for a moment
 *   pool  → on the basin's surface, drifting slowly to the drain, swirling into it
 *   drain → back into the pipe
 *
 * Surface particles (bowl, pool) are a 2D fluid: each step pushes pairs that sit closer than the spacing apart
 * (position-based, over a grid), so they spread evenly over the water and the renderer can draw one continuous
 * surface from them. The spacing follows the count, so the surface stays whole however many are on it. The drift to
 * the drain (and to the bowl's lip) is steered so that each surface keeps about its share of the particles: too
 * many, it runs out faster; too few, slower — the pipe never runs dry and the jet never stops.
 *
 * The basin also carries a wave heightfield (ripples from every landing, from the cursor), which lifts the pool
 * particles and which the renderer reads for the surface's normals and caustics.
 *
 * Metres, seconds, y up, the fountain's axis at the origin. No three.js here: checked headless by
 * .tmp/check-fountain.cjs.
 */

/** The design is drawn at 1:1 in BASE (a 5 m basin); the fountain stands in the courtyard SCALE times bigger. */
export const SCALE = 1.5;

/** The fountain's measures at design scale (metres before SCALE). */
export const BASE = {
  /** Basin: inner wall radius, outer rim radius, rim top, floor, water surface. */
  basinIn: 2.35,
  basinOut: 2.62,
  rimTop: 0.62,
  floor: 0.06,
  pool: 0.47,
  /** The column's plinth where it stands in the water. */
  plinthR: 0.52,
  /** Upper bowl: radius of its water, of the lip the sheet leaves from, the lip's top, its water surface. */
  bowlR: 1.0,
  lipR: 1.1,
  lipY: 1.66,
  bowlWater: 1.64,
  /** The nozzle's finial rising from the bowl, and the nozzle's mouth. */
  finialR: 0.12,
  nozzleY: 1.8,
  /** The drain in the basin's floor, under the water (x, z, capture radius). */
  drainX: 0.9,
  drainZ: 1.25,
  drainR: 0.1,
};

/** The fountain as it stands (metres). */
export const FOUNTAIN = Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, v * SCALE])) as typeof BASE;

export const PIPE = 0;
export const JET = 1;
export const BOWL = 2;
export const SHEET = 3;
export const SPRAY = 4;
export const POOL = 5;

export type FountainOptions = {
  count: number;
  /** Particles a second through the pump. */
  rate: number;
  /** Jet's speed at the nozzle, m/s (height ≈ v²/2g). */
  jetSpeed: number;
  /** Spread of the jet, radians. */
  jetSpread: number;
  /** Wind, m/s (x, z). */
  windX: number;
  windZ: number;
  /** Share of the pump that feeds the ring of arcing jets (0: the central jet only). */
  ringShare?: number;
  /** Continuous mesh surface: density-grid pressure + potential flow; particles are foam tracers, not hard beads.
   * The original pairwise solver remains the default for particle-surface experiments. */
  surfaceSolver?: 'particles' | 'field';
  rand: () => number;
};

const G = 9.81;
const WAVE_N = 160;
/** The ring of arcing jets: nozzles, their radius (just inside the basin's wall) and launch angle (the renderer draws
 * the same arcs). */
export const RING_N = 8;
export const RING_R = (BASE.basinIn - 0.1) * SCALE;
export const RING_ANGLE = (55 * Math.PI) / 180;

export function createFountainSim(opts: FountainOptions) {
  const N = opts.count;
  const fieldSurface = opts.surfaceSolver === 'field';
  const F = FOUNTAIN;
  const rand = opts.rand;
  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);
  const vx = new Float32Array(N), vy = new Float32Array(N), vz = new Float32Array(N);
  const state = new Uint8Array(N);
  /** Thrown by a ring nozzle (flies under the bowl and must not be caught by it). */
  const ring = new Uint8Array(N);
  /** Foam on a surface particle (1 just after a landing, fading), or a droplet's size factor in the air. */
  const foam = new Float32Array(N);
  /** Seconds since it left a nozzle or the bowl's lip (for drawing: where a stream breaks up). */
  const age = new Float32Array(N);
  /** The pipe: a ring buffer of particle indices waiting for the pump. */
  const queue = new Int32Array(N);
  let qHead = 0;
  let qLen = 0;
  const enqueue = (i: number) => {
    state[i] = PIPE;
    queue[(qHead + qLen) % N] = i;
    qLen += 1;
  };
  const dequeue = () => {
    const i = queue[qHead];
    qHead = (qHead + 1) % N;
    qLen -= 1;
    return i;
  };

  // --- waves on the basin: h(t+dt) = 2h − h_prev + (c dt/dx)² ∇²h, damped, walls reflect ---------------------------
  const wN = WAVE_N;
  const wSize = F.basinIn * 2;
  const wDx = wSize / wN;
  let h0 = new Float32Array(wN * wN);
  let h1 = new Float32Array(wN * wN);
  const wet = new Uint8Array(wN * wN);
  for (let j = 0; j < wN; j += 1) {
    for (let i = 0; i < wN; i += 1) {
      const x = (i + 0.5) * wDx - F.basinIn, z = (j + 0.5) * wDx - F.basinIn;
      const r = Math.hypot(x, z);
      wet[j * wN + i] = r < F.basinIn && r > F.plinthR ? 1 : 0;
    }
  }
  const waveAt = (x: number, z: number) => {
    const fi = (x + F.basinIn) / wDx - 0.5, fj = (z + F.basinIn) / wDx - 0.5;
    const i = Math.max(0, Math.min(wN - 2, Math.floor(fi))), j = Math.max(0, Math.min(wN - 2, Math.floor(fj)));
    const tx = Math.max(0, Math.min(1, fi - i)), tz = Math.max(0, Math.min(1, fj - j));
    const a = h1[j * wN + i], b = h1[j * wN + i + 1], c = h1[(j + 1) * wN + i], d = h1[(j + 1) * wN + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  };
  /** A disturbance of the basin's surface: amount in metres, spread over radius r. */
  const poke = (x: number, z: number, amount: number, r = 0.035) => {
    const ci = Math.round((x + F.basinIn) / wDx - 0.5), cj = Math.round((z + F.basinIn) / wDx - 0.5);
    const k = Math.ceil(r / wDx) + 1;
    for (let j = cj - k; j <= cj + k; j += 1) {
      for (let i = ci - k; i <= ci + k; i += 1) {
        if (i < 1 || j < 1 || i >= wN - 1 || j >= wN - 1 || !wet[j * wN + i]) continue;
        const dx = ((i + 0.5) * wDx - F.basinIn - x) / r, dz = ((j + 0.5) * wDx - F.basinIn - z) / r;
        const q = dx * dx + dz * dz;
        if (q < 4) {
          // Displace both time slices: a height disturbance, not an accidental velocity proportional to 1/dt.
          const impulse = amount * (1 - q * 1.5) * Math.exp(-q * 1.5);
          h1[j * wN + i] += impulse;
          h0[j * wN + i] += impulse;
        }
      }
    }
  };
  const stepWaves = (dt: number) => {
    const c = 0.34;
    const k = (c * dt / wDx) ** 2;
    const damp = Math.exp(-dt * 1.1);
    for (let j = 1; j < wN - 1; j += 1) {
      for (let i = 1; i < wN - 1; i += 1) {
        const o = j * wN + i;
        if (!wet[o]) {
          h0[o] = 0;
          continue;
        }
        // Walls reflect: a dry neighbour counts as this cell.
        const c0 = h1[o];
        const l = wet[o - 1] ? h1[o - 1] : c0, r = wet[o + 1] ? h1[o + 1] : c0;
        const u = wet[o - wN] ? h1[o - wN] : c0, d = wet[o + wN] ? h1[o + wN] : c0;
        h0[o] = c0 + (c0 - h0[o]) * damp + k * (l + r + u + d - 4 * c0);
      }
    }
    const t = h0;
    h0 = h1;
    h1 = t;
  };

  // --- surface particles: the evenly spread 2D fluid ---------------------------------------------------------------
  const poolArea = Math.PI * (F.basinIn ** 2 - F.plinthR ** 2);
  const bowlArea = Math.PI * (F.bowlR ** 2 - F.finialR ** 2);
  // Shares of the particles: what is in the air follows from the rate, the pipe keeps a buffer of 0.5 s, the rest
  // lies on the surfaces at one fixed spacing — fixed, so that water arriving faster than it leaves pushes over the
  // lip (and the pool has no holes).
  const inAir = opts.rate * 1.1;
  const buffer = opts.rate * 0.5;
  const surf = Math.max(200, N - inAir - buffer);
  const spacing = Math.sqrt((poolArea + bowlArea) / (surf * 0.866));
  const bowlTarget = Math.round(bowlArea / (spacing * spacing * 0.866));
  const poolTarget = Math.round(surf - bowlTarget);
  /** Area a particle stands for, so a flow of `rate` particles a second is Q m²/s of surface. */
  const Q = opts.rate * spacing * spacing * 0.866;
  let drainCarry = 0;

  // The pool's flow: 2D potential flow from where the sheet lands (a ring) into the drain, the walls and the plinth
  // letting nothing through — ∇²φ = source − sink, v = ∇φ, solved once (SOR on the wave grid). Water carried by it
  // keeps its density: nothing piles up at the drain and no holes open far from it.
  // Where the sheet lands: thrown out at about 0.34 m/s, falling from the lip to the pool.
  const LAND_R = F.lipR + 0.34 * Math.sqrt((2 * (F.lipY - F.pool)) / G);
  const flowX = new Float32Array(wN * wN);
  const flowZ = new Float32Array(wN * wN);
  {
    const src = new Float32Array(wN * wN);
    let ringSum = 0;
    let drainSum = 0;
    const ringW = new Float32Array(wN * wN);
    const drainW = new Float32Array(wN * wN);
    for (let j = 0; j < wN; j += 1) {
      for (let i = 0; i < wN; i += 1) {
        const o = j * wN + i;
        if (!wet[o]) continue;
        const x = (i + 0.5) * wDx - F.basinIn, z = (j + 0.5) * wDx - F.basinIn;
        ringW[o] = Math.exp(-(((Math.hypot(x, z) - LAND_R) / 0.07) ** 2) / 2);
        drainW[o] = Math.exp(-((x - F.drainX) ** 2 + (z - F.drainZ) ** 2) / (2 * 0.045 ** 2));
        ringSum += ringW[o];
        drainSum += drainW[o];
      }
    }
    const cellArea = wDx * wDx;
    for (let o = 0; o < wN * wN; o += 1) if (wet[o]) src[o] = (Q * (ringW[o] / ringSum - drainW[o] / drainSum)) / cellArea;
    const phi = new Float32Array(wN * wN);
    const omega = 1.92;
    for (let it = 0; it < 1400; it += 1) {
      for (let j = 1; j < wN - 1; j += 1) {
        for (let i = 1; i < wN - 1; i += 1) {
          const o = j * wN + i;
          if (!wet[o]) continue;
          let sum = 0;
          let n = 0;
          if (wet[o - 1]) { sum += phi[o - 1]; n += 1; }
          if (wet[o + 1]) { sum += phi[o + 1]; n += 1; }
          if (wet[o - wN]) { sum += phi[o - wN]; n += 1; }
          if (wet[o + wN]) { sum += phi[o + wN]; n += 1; }
          if (!n) continue;
          phi[o] += omega * ((sum - src[o] * cellArea) / n - phi[o]);
        }
      }
    }
    for (let j = 1; j < wN - 1; j += 1) {
      for (let i = 1; i < wN - 1; i += 1) {
        const o = j * wN + i;
        if (!wet[o]) continue;
        const l = wet[o - 1] ? phi[o - 1] : phi[o], r = wet[o + 1] ? phi[o + 1] : phi[o];
        const u = wet[o - wN] ? phi[o - wN] : phi[o], d = wet[o + wN] ? phi[o + wN] : phi[o];
        flowX[o] = (r - l) / (2 * wDx);
        flowZ[o] = (d - u) / (2 * wDx);
      }
    }
  }
  const flowAt = (x: number, z: number, out: number[]) => {
    const fi = (x + F.basinIn) / wDx - 0.5, fj = (z + F.basinIn) / wDx - 0.5;
    const i = Math.max(0, Math.min(wN - 2, Math.floor(fi))), j = Math.max(0, Math.min(wN - 2, Math.floor(fj)));
    const tx = Math.max(0, Math.min(1, fi - i)), tz = Math.max(0, Math.min(1, fj - j));
    const o = j * wN + i;
    const w00 = (1 - tx) * (1 - tz), w10 = tx * (1 - tz), w01 = (1 - tx) * tz, w11 = tx * tz;
    out[0] = flowX[o] * w00 + flowX[o + 1] * w10 + flowX[o + wN] * w01 + flowX[o + wN + 1] * w11;
    out[1] = flowZ[o] * w00 + flowZ[o + 1] * w10 + flowZ[o + wN] * w01 + flowZ[o + wN + 1] * w11;
  };
  const flow = [0, 0];
  /** How far from the axis the jet comes down: its spread times its speed over the flight (about 2v/g). */
  const landSigma = Math.max(0.08, opts.jetSpread * opts.jetSpeed * ((2 * opts.jetSpeed) / G) * 0.6);
  /** The pairwise push holds particles back from crowding into the drain; the sink draws a little harder for it. */
  const SINK = 1.5;
  // Cells about the spacing wide (each holds one or two), so a pass looks at few pairs.
  const CELLS = 192;
  const cell = new Int32Array(CELLS * CELLS + 1);
  const next = new Int32Array(N);
  // Neighbour topology is fixed. Cache it once per surface grid instead of repeating
  // boundary clamps and half-plane tests for every particle, sixty times a second.
  const neighbourGrids = new Map<string, { offsets: Int32Array; cells: Int32Array }>();
  const neighboursFor = (gN: number, reach: number) => {
    const key = `${gN}:${reach}`;
    const cached = neighbourGrids.get(key);
    if (cached) return cached;
    const offsets = new Int32Array(gN * gN + 1);
    const cells = new Int32Array(gN * gN * (reach + 1) * (reach * 2 + 1));
    let at = 0;
    for (let gj = 0; gj < gN; gj++) for (let gi = 0; gi < gN; gi++) {
      offsets[gj * gN + gi] = at;
      for (let nj = gj; nj <= Math.min(gN - 1, gj + reach); nj++) {
        for (let ni = Math.max(0, gi - reach); ni <= Math.min(gN - 1, gi + reach); ni++) {
          if (nj === gj && ni < gi) continue;
          cells[at++] = nj * gN + ni;
        }
      }
    }
    offsets[gN * gN] = at;
    const grid = { offsets, cells };
    neighbourGrids.set(key, grid);
    return grid;
  };

  /** Push surface particles of one state apart to spacing s (one pass over a grid of s-sized cells). */
  const relax = (st: number, s: number, extent: number) => {
    const gN = Math.min(CELLS, Math.max(4, Math.floor((extent * 2) / s)));
    const gs = (extent * 2) / gN;
    cell.fill(-1, 0, gN * gN);
    for (let i = 0; i < N; i += 1) {
      if (state[i] !== st) continue;
      const gi = Math.min(gN - 1, Math.max(0, Math.floor((px[i] + extent) / gs)));
      const gj = Math.min(gN - 1, Math.max(0, Math.floor((pz[i] + extent) / gs)));
      const c = gj * gN + gi;
      next[i] = cell[c];
      cell[c] = i;
    }
    const reach = Math.ceil(s / gs);
    const neighbours = neighboursFor(gN, reach);
    const s2 = s * s;
    for (let gridCell = 0; gridCell < gN * gN; gridCell++) {
      for (let a = cell[gridCell]; a >= 0; a = next[a]) {
        for (let n = neighbours.offsets[gridCell]; n < neighbours.offsets[gridCell + 1]; n++) {
          const otherCell = neighbours.cells[n];
          for (let b = cell[otherCell]; b >= 0; b = next[b]) {
            if (otherCell === gridCell && b <= a) continue;
            const dx = px[b] - px[a], dz = pz[b] - pz[a];
            const d2 = dx * dx + dz * dz;
            if (d2 >= s2 || d2 < 1e-12) continue;
            const d = Math.sqrt(d2);
            const push = (s - d) * 0.45 / d;
            px[a] -= dx * push; pz[a] -= dz * push;
            px[b] += dx * push; pz[b] += dz * push;
          }
        }
      }
    }
  };

  /**
   * Pressure on a coarse grid: particles are counted per cell (bilinear), set against how many the cell's water
   * holds at the spacing, and each particle is pushed down the gradient of that ratio — from crowded to thin. This
   * is what fills a hole the drain leaves (the pairwise push only ever separates).
   */
  const makePressure = (extent: number, rMin: number, rMax: number) => {
    const gN = Math.max(8, Math.round((extent * 2) / (spacing * 2.4)));
    const gs = (extent * 2) / gN;
    const full = (gs * gs) / (spacing * spacing * 0.866);
    const expect = new Float32Array(gN * gN);
    for (let j = 0; j < gN; j += 1) {
      for (let i = 0; i < gN; i += 1) {
        let wetN = 0;
        for (let b = 0; b < 8; b += 1) {
          for (let a = 0; a < 8; a += 1) {
            const x = (i + (a + 0.5) / 8) * gs - extent, z = (j + (b + 0.5) / 8) * gs - extent;
            const r = Math.hypot(x, z);
            if (r >= rMin && r <= rMax) wetN += 1;
          }
        }
        expect[j * gN + i] = (full * wetN) / 64;
      }
    }
    const dens = new Float32Array(gN * gN);
    const pres = new Float32Array(gN * gN);
    const gradientX = new Float32Array(gN * gN), gradientZ = new Float32Array(gN * gN);
    return {
      update(st: number) {
        dens.fill(0);
        for (let i = 0; i < N; i += 1) {
          if (state[i] !== st) continue;
          const fi = (px[i] + extent) / gs - 0.5, fj = (pz[i] + extent) / gs - 0.5;
          const ci = Math.max(0, Math.min(gN - 2, Math.floor(fi))), cj = Math.max(0, Math.min(gN - 2, Math.floor(fj)));
          const tx = Math.max(0, Math.min(1, fi - ci)), tz = Math.max(0, Math.min(1, fj - cj));
          const o = cj * gN + ci;
          dens[o] += (1 - tx) * (1 - tz); dens[o + 1] += tx * (1 - tz);
          dens[o + gN] += (1 - tx) * tz; dens[o + gN + 1] += tx * tz;
        }
        for (let o = 0; o < gN * gN; o += 1) pres[o] = expect[o] > full * 0.15 ? dens[o] / expect[o] - 1 : 0;
        // One gradient per cell, not eight derivatives and three closures per particle lookup.
        for (let y = 1; y < gN - 1; y++) for (let x = 1; x < gN - 1; x++) {
          const o = y * gN + x;
          gradientX[o] = expect[o + 1] > 0 && expect[o - 1] > 0 ? (pres[o + 1] - pres[o - 1]) / (2 * gs) : 0;
          gradientZ[o] = expect[o + gN] > 0 && expect[o - gN] > 0 ? (pres[o + gN] - pres[o - gN]) / (2 * gs) : 0;
        }
      },
      /** −∇(ρ/ρ0) at a point, per metre. */
      push(x: number, z: number, out: number[]) {
        const fi = (x + extent) / gs - 0.5, fj = (z + extent) / gs - 0.5;
        const ci = Math.max(1, Math.min(gN - 3, Math.floor(fi))), cj = Math.max(1, Math.min(gN - 3, Math.floor(fj)));
        const tx = Math.max(0, Math.min(1, fi - ci)), tz = Math.max(0, Math.min(1, fj - cj));
        const w00 = (1 - tx) * (1 - tz), w10 = tx * (1 - tz), w01 = (1 - tx) * tz, w11 = tx * tz;
        const o = cj * gN + ci;
        out[0] = -(gradientX[o] * w00 + gradientX[o + 1] * w10 + gradientX[o + gN] * w01 + gradientX[o + gN + 1] * w11);
        out[1] = -(gradientZ[o] * w00 + gradientZ[o + 1] * w10 + gradientZ[o + gN] * w01 + gradientZ[o + gN + 1] * w11);
      },
    };
  };
  const poolPressure = makePressure(F.basinIn, F.plinthR, F.basinIn);
  const bowlPressure = makePressure(F.bowlR, F.finialR, F.bowlR);
  const press = [0, 0];
  /** How hard the pressure pushes: m/s per unit of relative density per metre. */
  const PRESS_K = 0.26 * SCALE;

  /** Keeps a point within the ring rMin..rMax. */
  const clampRing = (i: number, rMin: number, rMax: number) => {
    const r2 = px[i] * px[i] + pz[i] * pz[i];
    if (r2 >= rMin * rMin && r2 <= rMax * rMax) return;
    const r = Math.hypot(px[i], pz[i]);
    if (r < 1e-6) {
      px[i] = rMin;
      return;
    }
    if (r < rMin) {
      px[i] *= rMin / r; pz[i] *= rMin / r;
    } else if (r > rMax) {
      px[i] *= rMax / r; pz[i] *= rMax / r;
    }
  };

  // --- the start: surfaces filled, the rest in the pipe ------------------------------------------------------------
  let placed = 0;
  const scatter = (st: number, n: number, rMin: number, rMax: number, y: number) => {
    for (let k = 0; k < n && placed < N; k += 1, placed += 1) {
      const i = placed;
      const r = Math.sqrt(rMin * rMin + rand() * (rMax * rMax - rMin * rMin));
      const a = rand() * Math.PI * 2;
      px[i] = Math.cos(a) * r; pz[i] = Math.sin(a) * r; py[i] = y;
      state[i] = st;
    }
  };
  scatter(POOL, poolTarget, F.plinthR, F.basinIn, F.pool);
  scatter(BOWL, bowlTarget, F.finialR, F.bowlR, F.bowlWater);
  for (let i = placed; i < N; i += 1) enqueue(i);

  let emitCarry = 0;
  /** The pump's actual rate, smoothed over about a second. */
  let rateEst = opts.rate;
  let emittedNow = 0;
  let time = 0;
  const counts = new Int32Array(6);
  const poolS = spacing;
  const bowlS = spacing;
  let drained = 0;
  /** Pool particles near the drain, nearest first (scratch). */
  const near: number[] = [];
  let emitted = 0;
  let accumulator = 0;
  let revision = 0;

  const land = (i: number, surfaceY: number) => {
    const speed = Math.hypot(vx[i], vy[i], vz[i]);
    poke(px[i], pz[i], -0.002 * Math.min(4, speed));
    // A hard landing throws a droplet back up now and then.
    if (state[i] !== SPRAY && speed > 2.2 && rand() < 0.1) {
      state[i] = SPRAY;
      py[i] = surfaceY + 0.002;
      vy[i] = speed * (0.15 + rand() * 0.25);
      vx[i] = vx[i] * 0.2 + (rand() - 0.5) * 0.9;
      vz[i] = vz[i] * 0.2 + (rand() - 0.5) * 0.9;
      return;
    }
    state[i] = POOL;
    py[i] = surfaceY;
    vx[i] *= 0.15; vz[i] *= 0.15; vy[i] = 0;
    foam[i] = Math.min(1, 0.55 + speed * 0.15);
    clampRing(i, F.plinthR + poolS * 0.5, F.basinIn - poolS * 0.5);
  };

  return {
    N,
    px, py, pz, vx, vy, vz, state, foam, ring, age,
    counts,
    get poolSpacing() { return poolS; },
    get bowlSpacing() { return bowlS; },
    get queued() { return qLen; },
    get drained() { return drained; },
    get emitted() { return emitted; },
    waveSize: wN,
    get waves() { return h1; },
    waveAt,
    poke,
    options: opts,
    get revision() { return revision; },
    /** One step (split into steps of at most 1/60 s). */
    step(dtIn: number) {
      if (!Number.isFinite(dtIn) || dtIn <= 0) return;
      accumulator += Math.min(dtIn, .1);
      const dt = 1 / 60;
      const sub = Math.floor((accumulator + 1e-9) / dt);
      accumulator -= sub * dt;
      if (!sub) return;
      revision++;
      const bowlFoamDecay = Math.exp(-dt / 1.2), poolFoamDecay = Math.exp(-dt / 7);
      for (let s = 0; s < sub; s += 1) {
        time += dt;
        // The pump.
        emitCarry += opts.rate * dt;
        while (emitCarry >= 1) {
          emitCarry -= 1;
          if (qLen === 0) break;
          const i = dequeue();
          if (rand() < (opts.ringShare ?? 0)) {
            // A ring nozzle: low in the wall, an arc at 55° in towards the column, landing about a metre and a half
            // short of it (range v² sin 2θ / g).
            const k = Math.floor(rand() * RING_N);
            const th = ((k + 0.5) / RING_N) * Math.PI * 2;
            const cx = Math.cos(th), cz = Math.sin(th);
            const range = RING_R - (F.plinthR + 0.6 * SCALE);
            const up = RING_ANGLE + gauss(rand) * 0.012;
            const sp = Math.sqrt((range * G) / Math.sin(2 * RING_ANGLE)) * (1 + gauss(rand) * 0.015);
            const side = gauss(rand) * 0.012;
            px[i] = cx * RING_R; pz[i] = cz * RING_R; py[i] = F.pool + 0.09 * SCALE;
            vx[i] = (-cx * Math.cos(up) - cz * side) * sp; vz[i] = (-cz * Math.cos(up) + cx * side) * sp; vy[i] = Math.sin(up) * sp;
            ring[i] = 1;
          } else {
            const a = rand() * Math.PI * 2;
            const tilt = Math.abs(gauss(rand)) * opts.jetSpread;
            const sp = opts.jetSpeed * (1 + gauss(rand) * 0.025);
            px[i] = Math.cos(a) * 0.006; pz[i] = Math.sin(a) * 0.006; py[i] = F.nozzleY;
            vx[i] = Math.cos(a) * Math.sin(tilt) * sp; vz[i] = Math.sin(a) * Math.sin(tilt) * sp; vy[i] = Math.cos(tilt) * sp;
            ring[i] = 0;
          }
          state[i] = JET;
          foam[i] = 0.6 + rand() * 0.8;
          age[i] = 0;
          emitted += 1;
          emittedNow += 1;
        }
        emitCarry = Math.min(emitCarry, 2);
        rateEst += (emittedNow / dt - rateEst) * Math.min(1, dt * 1.2);
        emittedNow = 0;
        // In the air: gravity, drag, wind.
        for (let i = 0; i < N; i += 1) {
          const st = state[i];
          if (st !== JET && st !== SHEET && st !== SPRAY) continue;
          const sp = Math.hypot(vx[i], vy[i], vz[i]);
          const drag = (st === SHEET ? 0.08 : 0.25) * sp;
          const wind = st === SHEET ? 0.25 : 0.6;
          vx[i] += ((opts.windX - vx[i]) * wind - vx[i] * drag) * dt;
          vz[i] += ((opts.windZ - vz[i]) * wind - vz[i] * drag) * dt;
          vy[i] += (-G - vy[i] * drag) * dt;
          px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
          age[i] += dt;
          const r = Math.hypot(px[i], pz[i]);
          if (vy[i] < 0 && st === JET && !ring[i] && r < F.bowlR && py[i] <= F.bowlWater) {
            state[i] = BOWL;
            py[i] = F.bowlWater;
            vx[i] *= 0.2; vz[i] *= 0.2; vy[i] = 0;
            foam[i] = 0.8;
            clampRing(i, F.finialR, F.bowlR - bowlS * 0.5);
          } else if (vy[i] < 0 && py[i] <= F.pool + waveAt(px[i], pz[i]) && r < F.basinIn && r > F.plinthR) {
            land(i, F.pool);
          } else if (py[i] < F.floor) {
            // External runoff returns through the hidden drain, never teleports sideways onto the visible pool.
            enqueue(i);
          } else if (r < F.plinthR && py[i] < F.bowlWater && py[i] > F.pool) {
            // Solid column: deflect outward, then let gravity carry the drop into the basin.
            const nx = px[i] / Math.max(r, 1e-6), nz = pz[i] / Math.max(r, 1e-6);
            px[i] = nx * (F.plinthR + .01); pz[i] = nz * (F.plinthR + .01);
            const normalV = vx[i] * nx + vz[i] * nz;
            if (normalV < 0) { vx[i] -= normalV * 1.2 * nx; vz[i] -= normalV * 1.2 * nz; }
          } else if (st === JET && r >= F.bowlR && r < F.lipR + 0.04 && py[i] < F.lipY && py[i] > F.lipY - 0.12) {
            // Hits the lip on its way down: runs over it with the sheet.
            state[i] = SHEET;
            vx[i] *= 0.3; vz[i] *= 0.3; vy[i] = Math.min(vy[i], -0.2);
          }
        }
        // Surfaces flow as incompressible 2D water would: the bowl out from its middle (a source: the speed at radius r
        // carries the whole flow, Q / 2πr), the pool into the drain (a sink, the same law in the distance to it), with
        // a swirl close to the drain. The pairwise push keeps them evenly spread and pushes a crowded bowl over its lip.
        const dX = F.drainX, dZ = F.drainZ;
        near.length = 0;
        poolPressure.update(POOL);
        bowlPressure.update(BOWL);
        // The bowl's flow carries what the pump actually moves (less than asked for a moment at the start); the
        // pool's flow is what the pump asks for, since the pump draws from it.
        const q = (Q * rateEst) / opts.rate;
        for (let i = 0; i < N; i += 1) {
          const st = state[i];
          if (st === BOWL) {
            const r = Math.hypot(px[i], pz[i]) || 1e-6;
            // The jet lands round the middle (about a Gaussian of landSigma): the flow through radius r carries what
            // landed inside it.
            const out = Math.min(0.8, (q * (1 - Math.exp(-(r * r) / (2 * landSigma * landSigma)))) / (2 * Math.PI * r));
            bowlPressure.push(px[i], pz[i], press);
            vx[i] += ((px[i] / r) * out + press[0] * PRESS_K - vx[i]) * dt * 4;
            vz[i] += ((pz[i] / r) * out + press[1] * PRESS_K - vz[i]) * dt * 4;
            px[i] += vx[i] * dt; pz[i] += vz[i] * dt;
            foam[i] *= bowlFoamDecay;
          } else if (st === POOL) {
            const dx = dX - px[i], dz = dZ - pz[i];
            const d = Math.hypot(dx, dz) || 1e-6;
            flowAt(px[i], pz[i], flow);
            poolPressure.push(px[i], pz[i], press);
            const swirl = 0.28 * Math.exp(-d / 0.15);
            // (Capped, but high enough that the drain can take the whole pump's flow through the ring round it.)
            const tx = Math.max(-2.2, Math.min(2.2, flow[0] * SINK)) - (dz / d) * swirl + press[0] * PRESS_K;
            const tz = Math.max(-2.2, Math.min(2.2, flow[1] * SINK)) + (dx / d) * swirl + press[1] * PRESS_K;
            vx[i] += (tx - vx[i]) * Math.min(1, dt * 6);
            vz[i] += (tz - vz[i]) * Math.min(1, dt * 6);
            px[i] += vx[i] * dt; pz[i] += vz[i] * dt;
            foam[i] *= poolFoamDecay;
            if (d < 0.3) near.push(i);
          }
        }
        // The drain takes the particles nearest to it, as many as the pump needs (and a little more or less to keep
        // the pipe's buffer): the pool can neither drain dry nor overfill.
        drainCarry += opts.rate * dt * (1 + Math.max(-0.9, Math.min(1.5, (buffer - qLen) / buffer)));
        let take = Math.floor(drainCarry);
        drainCarry -= take;
        if (take > 0 && near.length) {
          const dist = (i: number) => (px[i] - dX) ** 2 + (pz[i] - dZ) ** 2;
          near.sort((a, b) => dist(a) - dist(b));
          for (let k = 0; k < near.length && take > 0; k += 1, take -= 1) {
            enqueue(near[k]);
            drained += 1;
          }
        }
        drainCarry += take;
        drainCarry = Math.min(drainCarry, 20);
        if (!fieldSurface) {
          relax(POOL, poolS, F.basinIn);
          relax(BOWL, bowlS, F.bowlR);
          relax(BOWL, bowlS, F.bowlR);
        }
        // The bowl spills only when full (as water rises over a lip): below its share, what reaches the lip stays.
        let nBowl = 0;
        for (let i = 0; i < N; i += 1) if (state[i] === BOWL) nBowl += 1;
        const spill = Math.max(0, Math.min(1, (nBowl / bowlTarget - 0.94) / 0.06));
        for (let i = 0; i < N; i += 1) {
          if (state[i] === BOWL) {
            const r = Math.hypot(px[i], pz[i]) || 1e-6;
            if (r > F.bowlR - bowlS * 0.3 && rand() < spill) {
              // Over the lip: a thin sheet, thrown out a little.
              state[i] = SHEET;
              const ux = px[i] / r, uz = pz[i] / r;
              px[i] = ux * F.lipR; pz[i] = uz * F.lipR; py[i] = F.lipY - 0.004;
              const v = 0.3 + 0.08 * rand();
              vx[i] = ux * v; vz[i] = uz * v; vy[i] = -0.06;
              foam[i] = 0.4 + rand() * 0.4;
              age[i] = 0;
            }
          }
          if (state[i] === POOL) {
            clampRing(i, F.plinthR + poolS * 0.45, F.basinIn - poolS * 0.45);
            // The surface: the waves, and a dip over the drain.
            // The mesh samples the heightfield itself. Foam tracers only need x/z; don't sample it 20k times again.
            py[i] = fieldSurface ? F.pool : F.pool + waveAt(px[i], pz[i]) - 0.035 * Math.exp(-((px[i] - dX) ** 2 + (pz[i] - dZ) ** 2) / 0.012);
          } else if (state[i] === BOWL) {
            clampRing(i, F.finialR + bowlS * 0.45, F.bowlR - bowlS * 0.3);
            py[i] = F.bowlWater + 0.004 * Math.sin(time * 9 + px[i] * 40) * Math.cos(time * 7 + pz[i] * 37);
          }
        }
        stepWaves(dt);
      }
      counts.fill(0);
      for (let i = 0; i < N; i += 1) counts[state[i]] += 1;
    },
  };
}

export type FountainSim = ReturnType<typeof createFountainSim>;

function gauss(rand: () => number) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(2 * Math.PI * rand());
}
