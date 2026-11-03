import type { CanvasSceneDef, SceneParams } from './types';
import { clamp } from './kit';
import { createGlassTracer, type GlassTracer } from './kaleidoscopeGlass';
import { KALEIDOSCOPE_PRESETS, kaleidoscopePresetIndex, presetValues, type KaleidoscopeLook } from './kaleidoscopePresets';
import { PIECE_SETS, type PieceFactory, type RGB } from './kaleidoscopeSets';
import { createHdrPresenter, hdrQuery, STRIP_VALUES, type HdrPresenter } from './kaleidoscopeHdr';
import { createOrbit } from './orbitControl';

/**
 * An experimental effect: a wall of hexagonal kaleidoscope eyepieces looking into one shared object cell.
 *
 * The object cell is simulated in 3D, in millimetres: a flat glass drum (radius CELL_R, depth DEPTH) with loose pieces
 * in it, made by the chosen set (kaleidoscopeSets.ts) — flat glass shards (some dichroic), petals, shells, glass beads and
 * pearls, bugle-bead rods and metallic glitter flakes. Every
 * piece is a rigid body with a position, velocity, orientation (quaternion) and spin. Gravity pulls down in the picture
 * and, because a kaleidoscope is held tilted up towards the light (45°), also against the front glass. Contacts with the
 * glass faces and the drum's rim use every point of a piece that touches (a face lying on the glass touches with all its
 * corners), so a shard that lands on its edge gets the torque that lays it flat. Piece against piece: separating axes
 * (the line between the centres, face normals, edge normals of the flat pieces), one contact point shared by both arms.
 * The solver is the usual sequential-impulse one: contacts found once per substep, accumulated normal and friction
 * impulses (Coulomb, two tangents) warm-started from the substep before, restitution for hard hits, penetration fixed
 * by moving positions only. A piece that keeps its place for 0.4 s falls asleep (frozen, solid for the others) and
 * wakes when hit, when the drum is shaken or turned; nothing sleeps while the drum turns, so the pile slides round.
 * Time runs at half speed (a kaleidoscope twice the size): gravity and shaking are a quarter of the real ones, else
 * pieces cross the 28 mm drum in 65 ms and it reads as twitching. "В масле" adds buoyancy and viscous drag. The drum
 * turns by itself only when asked (⟳); left alone, the picture keeps still.
 * Headless checks: .tmp/check-kaleidoscope*.cjs.
 *
 * The view is a three-mirror kaleidoscope: one equilateral triangle of the cell, repeated around each hexagon's
 * centre six times, every other copy mirrored — exactly the tiling of three mirrors, so it runs seamlessly across the
 * triangles; the hexagons themselves are framed like separate eyepieces. Drag any hexagon to shake it: it follows the
 * pointer on a spring, and its acceleration is what the pieces feel (in the drum's frame they get −a). All hexagons show
 * the same cell. Let go of a pulled eyepiece and the pieces are tossed up and back into the drum's depth, each with its
 * own random share of how hard it was pulled (see cell.toss). The drum turns only when asked (⟳). The lamp is up left;
 * the cursor moves it when asked to (kalLightCursor, off by default: every move restarts the refinement; glints move, and the bright spot of the backlight behind the frosted glass; the glass keeps its
 * colours — dichroic and holographic pieces change with their own tilt, not with the light). A few seconds after the
 * last shake the pile freezes where it lies (every piece asleep), so nothing creeps; a shake, a turn or a hit wakes it. ⚙ opens the settings (also in the tuning panel): the ray-traced glass or the
 * earlier flat drawing, the look of the glass, how far the light follows, how hard a yank tosses.
 */

const SQ3 = Math.sqrt(3);
const SECTOR = Math.PI / 3;
/**
 * The drum moves as a kaleidoscope twice this size would (time runs at half speed, so accelerations are a quarter):
 * a 28 mm cell under full gravity drops a piece across the window in 65 ms, which on screen reads as twitching.
 */
const TIME_SCALE = 0.5;
export const CELL_GRAVITY = 9810 * TIME_SCALE * TIME_SCALE;
const G = CELL_GRAVITY;
/** A pull of the eyepiece on screen stands for a hand movement this many times bigger: a flick of 60 px then shakes
 * the drum with 4–7 g, as a real shake does, not with the half g its few millimetres would give. */
const SHAKE_GAIN = 8;
const CELL_R = 14;
const DEPTH = 5;
/**
 * How far the kaleidoscope is tilted up towards the light: 45° by default (kalSpread 0), the pieces slide down to the
 * drum's lowest part; the more upright it is held, the weaker the pull along the glass against the friction pressing
 * them onto it (above ~68° it holds them: μ 0.4), so they stay where they fall — spread over the whole window.
 */
const TILT = (45 * Math.PI) / 180;
const TILT_UPRIGHT = (88 * Math.PI) / 180;
/** The tilt for kalSpread s (0…1). */
export const tiltFor = (s: number) => TILT + (TILT_UPRIGHT - TILT) * clamp(s, 0, 1);
/** Side of the mirror triangle, in mm of the cell. */
const TRI_MM = 21;
const SUBSTEPS = 4;
const ITERATIONS = 4;
/** A piece that stays within SLEEP_MOVE mm and SLEEP_TURN of where it was for SLEEP_AFTER seconds rests: frozen, and
 * as solid as the glass for the others, so a pile settles layer by layer instead of simmering. Judged by where it is,
 * not by its speed: under full gravity a resting piece still trembles a little from step to step (the contact model
 * of thin tilted plates is an approximation), without going anywhere. */
const SLEEP_MOVE = 0.35;
const SLEEP_TURN = Math.cos((4 * Math.PI) / 180);
const SLEEP_V = 150;
const SLEEP_AFTER = 0.4;
/** A resting piece wakes when something hits it faster than this (mm/s). */
const WAKE_HIT = 40;

type Body = {
  kind: number; // 0 shard, 1 bead, 2 rod, 3 flake
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  qw: number; qx: number; qy: number; qz: number;
  wx: number; wy: number; wz: number;
  m: number[]; // rotation matrix, row-major
  invM: number; invI: number;
  a: number; t: number;
  poly: number[];
  /** Bounding radius, for the broad phase. */
  bound: number;
  /** Flat pieces: the outward normals of the outline's edges, body frame (x, y pairs; one per direction). */
  edges: number[];
  col: [number, number, number];
  col2: [number, number, number] | null;
  alpha: number;
  pearl: boolean;
  /** Surface roughness, 0 polished … 1 sand-blasted (sea glass, petals, grains): its faces scatter the light. */
  rough: number;
  /** Cut crystal: flat facets round the edge instead of a worn, rounded one. */
  cut: boolean;
  /** Touched something this substep (for rolling resistance). */
  touch: number;
  /** Resting: frozen and as heavy as the glass until something disturbs it (see createCell). */
  asleep: boolean;
  /** Seconds it has been nearly still. */
  still: number;
  /** Where it was when it last began to keep still: position and face normal. */
  rx: number; ry: number; rz: number; rnx: number; rny: number; rnz: number;
  /** Its own inverse mass and inertia (invM/invI are 0 while asleep). */
  im: number;
  ii: number;
  /** Which way gravity pulled (cell frame) when it fell asleep. */
  sgx: number;
  sgy: number;
  metal: number; // flakes: 0 gold, 1 silver, 2 holographic, 3 copper
  fx: number; fy: number; // flake facet tilt
};

type NumberKey = { [K in keyof SceneParams]: SceneParams[K] extends number ? K : never }[keyof SceneParams];

/** The kaleidoscope's sliders, for its own ⚙ panel and the tuning panel (plus the kalRays switch and the presets,
 * kaleidoscopePresets.ts). */
export type KaleidoscopeTab = 'look' | 'pieces' | 'hdr';
export const KALEIDOSCOPE_TABS: readonly { id: KaleidoscopeTab; label: string }[] = [
  { id: 'look', label: 'Свет и вид' },
  { id: 'pieces', label: 'Стёклышки' },
  { id: 'hdr', label: 'HDR' },
];
export const KALEIDOSCOPE_SETTINGS: readonly { key: NumberKey; label: string; min: number; max: number; step: number; tab: KaleidoscopeTab }[] = [
  { key: 'kalLightFollow', label: 'Сила света за курсором', min: 0, max: 2, step: 0.01, tab: 'look' },
  { key: 'kalExposure', label: 'Яркость', min: 0.5, max: 4, step: 0.05, tab: 'look' },
  { key: 'kalSaturation', label: 'Насыщенность', min: 0.5, max: 2.5, step: 0.05, tab: 'look' },
  { key: 'kalSparkle', label: 'Блики', min: 0, max: 4, step: 0.05, tab: 'look' },
  { key: 'kalGlow', label: 'Ореол бликов', min: 0, max: 2, step: 0.05, tab: 'look' },
  { key: 'kalStars', label: 'Лучи бликов', min: 0, max: 2, step: 0.05, tab: 'look' },
  { key: 'kalDispersion', label: 'Радужность, × стекло', min: 0, max: 12, step: 0.5, tab: 'look' },
  { key: 'kalBevel', label: 'Скругление краёв, мм', min: 0, max: 1, step: 0.05, tab: 'look' },
  { key: 'kalVignette', label: 'Затемнение к краям', min: 0, max: 1.5, step: 0.05, tab: 'look' },
  { key: 'kalSpread', label: 'Кучкой ↔ ровно', min: 0, max: 1, step: 0.05, tab: 'pieces' },
  { key: 'kalToss', label: 'Подброс при рывке', min: 0, max: 3, step: 0.05, tab: 'pieces' },
  { key: 'kalFreeze', label: 'Замереть через, с', min: 0, max: 10, step: 0.5, tab: 'pieces' },
  { key: 'kalSamples', label: 'Проходов запекания', min: 8, max: 512, step: 8, tab: 'pieces' },
  { key: 'kalScale', label: 'Масштаб', min: 0.4, max: 2.5, step: 0.05, tab: 'pieces' },
  { key: 'kalScaleMobile', label: 'Масштаб на телефоне', min: 0.4, max: 2.5, step: 0.05, tab: 'pieces' },
  { key: 'kalHdrWhite', label: 'Яркость картинки', min: 0.5, max: 2.5, step: 0.05, tab: 'hdr' },
  { key: 'kalHdrSaturation', label: 'Насыщенность', min: 0.5, max: 2, step: 0.05, tab: 'hdr' },
  { key: 'kalHdrGlints', label: 'Сила бликов', min: 0, max: 2, step: 0.05, tab: 'hdr' },
  { key: 'kalHdrBloom', label: 'Ореол и лучи', min: 0, max: 1.5, step: 0.05, tab: 'hdr' },
  { key: 'kalHdrSpill', label: 'Свет бликов на стёкла', min: 0, max: 3, step: 0.05, tab: 'hdr' },
  { key: 'kalHdrPeak', label: 'Предел монитора, ×', min: 1, max: 12, step: 0.25, tab: 'hdr' },
];

const METALS: [number, number, number][] = [[226, 184, 74], [214, 220, 228], [200, 200, 230], [214, 128, 84]];

function setMatrix(b: Body) {
  const { qw: w, qx: x, qy: y, qz: z } = b;
  const m = b.m;
  m[0] = 1 - 2 * (y * y + z * z); m[1] = 2 * (x * y - w * z); m[2] = 2 * (x * z + w * y);
  m[3] = 2 * (x * y + w * z); m[4] = 1 - 2 * (x * x + z * z); m[5] = 2 * (y * z - w * x);
  m[6] = 2 * (x * z - w * y); m[7] = 2 * (y * z + w * x); m[8] = 1 - 2 * (x * x + y * y);
}

/** Unit normals of a polygon's edges (opposite, parallel edges give one axis). */
function edgeNormals(poly: number[]): number[] {
  const out: number[] = [];
  const n = poly.length / 2;
  for (let k = 0; k < n; k += 1) {
    const j = (k + 1) % n;
    const ex = poly[j * 2] - poly[k * 2], ey = poly[j * 2 + 1] - poly[k * 2 + 1];
    const l = Math.hypot(ex, ey);
    if (l < 1e-9) continue;
    const nx = ey / l, ny = -ex / l;
    let dup = false;
    for (let i = 0; i < out.length; i += 2) if (Math.abs(out[i] * nx + out[i + 1] * ny) > 0.999) dup = true;
    if (!dup) out.push(nx, ny);
  }
  return out;
}

function randomQuat(rand: () => number): [number, number, number, number] {
  const u1 = rand(), u2 = rand() * Math.PI * 2, u3 = rand() * Math.PI * 2;
  const s1 = Math.sqrt(1 - u1), s2 = Math.sqrt(u1);
  return [s1 * Math.sin(u2), s1 * Math.cos(u2), s2 * Math.sin(u3), s2 * Math.cos(u3)];
}

/** The convex hull of an outline (x, y pairs), corners in increasing angle (Andrew's monotone chain): the contacts and
 * the tracer take a flat piece as a convex prism. */
function convexHull(pts: number[]): number[] {
  const p: [number, number][] = [];
  for (let i = 0; i < pts.length; i += 2) p.push([pts[i], pts[i + 1]]);
  p.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 1e-9) lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (let i = p.length - 1; i >= 0; i -= 1) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p[i]) <= 1e-9) upper.pop();
    upper.push(p[i]);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)].flat();
}

/** At most this many corners a flat piece (the tracer keeps 12 per piece). */
const MAX_CORNERS = 12;

/** The loose pieces of a set (PIECE_SETS, kaleidoscopeSets.ts), scattered through the cell. */
export function makePieces(rand: () => number, set = 0): Body[] {
  const out: Body[] = [];
  const make = (kind: number, a: number, t: number, poly: number[], bound: number, mass: number, inertia: number): Body => {
    const [qw, qx, qy, qz] = randomQuat(rand);
    const r = Math.sqrt(rand()) * (CELL_R - 3);
    const ang = rand() * Math.PI * 2;
    const b: Body = {
      kind, x: Math.cos(ang) * r, y: Math.sin(ang) * r, z: DEPTH / 2 + (rand() - 0.5) * 2,
      vx: 0, vy: 0, vz: 0, qw, qx, qy, qz, wx: 0, wy: 0, wz: 0, m: new Array(9).fill(0),
      invM: 1 / mass, invI: 1 / inertia, im: 1 / mass, ii: 1 / inertia, asleep: false, still: 0, rx: 0, ry: 0, rz: 0, rnx: 0, rny: 0, rnz: 1, sgx: 0, sgy: 1, a, t, poly, bound, edges: edgeNormals(poly),
      col: [255, 255, 255], col2: null, alpha: 0.85, pearl: false, rough: 0, cut: false, touch: 0, metal: 0, fx: 0, fy: 0,
    };
    setMatrix(b);
    out.push(b);
    return b;
  };
  /** A flat piece from its outline (at most MAX_CORNERS; made convex, unless `keep` says it already is), centred on its middle. */
  const flat = (outline: number[], t: number, keep = false) => {
    const poly = keep ? outline : convexHull(outline);
    const n = poly.length / 2;
    let area = 0, cx = 0, cy = 0;
    for (let k = 0; k < n; k += 1) {
      const j = (k + 1) % n;
      const cr = poly[k * 2] * poly[j * 2 + 1] - poly[j * 2] * poly[k * 2 + 1];
      area += cr;
      cx += (poly[k * 2] + poly[j * 2]) * cr;
      cy += (poly[k * 2 + 1] + poly[j * 2 + 1]) * cr;
    }
    cx /= 3 * area;
    cy /= 3 * area;
    let bound = 0;
    for (let k = 0; k < n; k += 1) {
      poly[k * 2] -= cx;
      poly[k * 2 + 1] -= cy;
      bound = Math.max(bound, Math.hypot(poly[k * 2], poly[k * 2 + 1]));
    }
    const mass = (Math.abs(area) / 2) * t;
    return make(0, bound, t, poly, bound + t / 2 + 0.05, mass, mass * bound * bound * 0.3);
  };
  const f: PieceFactory = {
    shard({ size, sides, jitter = 0.6, aspect = 1, thick = 1, col, col2 = null, clear = false, rough = 0, cut = false }) {
      const n = Math.min(sides, MAX_CORNERS);
      const poly: number[] = [];
      const start = rand() * Math.PI * 2;
      for (let k = 0; k < n; k += 1) {
        const ang = start + (k / n) * Math.PI * 2 + (rand() - 0.5) * jitter;
        const r = size * (1 - jitter * 0.58 + rand() * jitter * 0.75);
        // Stretched into a splinter (about the same area).
        poly.push(Math.cos(ang) * r * Math.sqrt(aspect), (Math.sin(ang) * r) / Math.sqrt(aspect));
      }
      const b = flat(poly, thick);
      b.col = col;
      b.col2 = col2;
      b.alpha = clear ? 0.45 : 0.82;
      b.rough = rough;
      b.cut = cut;
    },
    bead({ r, col, pearl = false, rough = 0 }) {
      const mass = (4 / 3) * Math.PI * r * r * r;
      const b = make(1, r, r, [], r, mass, 0.4 * mass * r * r);
      b.col = col;
      b.pearl = pearl;
      b.rough = rough;
    },
    rod({ half, r, col, metal = false }) {
      const mass = Math.PI * r * r * 2 * half;
      const b = make(2, half, r, [], half + r, mass, mass * half * half * 0.33);
      b.col = col;
      b.metal = metal ? 1 : 0;
    },
    flake({ a, metal }) {
      const poly: number[] = [];
      for (let k = 0; k < 6; k += 1) poly.push(Math.cos((k * Math.PI) / 3) * a, Math.sin((k * Math.PI) / 3) * a);
      // Heavier than their size (metal foil), which also keeps the mass ratio to the shards solvable.
      const mass = 2.6 * a * a * 1.2;
      // A tiny flake's own inertia is so small that contact impulses would set it spinning wildly and kicking its
      // neighbours; it gets a few times more (its spin is hardly visible, only its tilt, which makes it glint).
      const b = make(3, a, 0.12, poly, a + 0.1, mass, mass * a * a * 2.5);
      b.metal = metal;
      b.col = METALS[metal];
      b.fx = (rand() - 0.5) * 0.7;
      b.fy = (rand() - 0.5) * 0.7;
    },
    petal({ len, width, col, rough = 0, pointed = false }) {
      // An egg-shaped outline, wider towards the tip (a leaf: narrowing to both ends); thin, so its colour is its own at any thickness (the tracer's
      // absorption goes by the piece's thickness).
      const poly: number[] = [];
      for (let k = 0; k < MAX_CORNERS; k += 1) {
        const a = (k / MAX_CORNERS) * Math.PI * 2;
        const shape = pointed ? 1 - 0.4 * Math.cos(a) ** 2 : 1 + 0.22 * Math.cos(a);
        poly.push((Math.cos(a) * len) / 2, (Math.sin(a) * width * shape) / 2);
      }
      const b = flat(poly, 0.35);
      b.col = col;
      b.rough = rough;
    },
    shell({ r, col }) {
      // A scallop: a fan of 110° round its hinge (the first corner, which the tracer's ribs start from).
      const poly: number[] = [0, -r * 0.8];
      for (let k = 0; k < MAX_CORNERS - 1; k += 1) {
        const a = Math.PI / 2 + ((k / (MAX_CORNERS - 2)) * 2 - 1) * 0.96;
        poly.push(Math.cos(a) * r * 1.6, -r * 0.8 + Math.sin(a) * r * 1.6);
      }
      // Corners in increasing angle round the middle: the hinge (below), then the rim from right to left.
      const b = flat(poly, 0.5, true);
      b.col = col;
      b.pearl = true;
    },
  };
  PIECE_SETS[clamp(Math.round(set), 0, PIECE_SETS.length - 1)].build(rand, f);
  return out;
}


/**
 * The points of a piece that are (nearly) the farthest along a world direction, as offsets from its centre, with
 * their projections on it. A face lying on the glass touches with all its corners and a rod lying down with both
 * ends — a single support point would make them rock from corner to corner.
 */
/** Which vertex (and face) each point of the last extremePoints() call was, for keys that stay put from step to step. */
const extremeIds = new Int32Array(24);

function extremePoints(b: Body, dx: number, dy: number, dz: number, out: Float64Array): number {
  const m = b.m;
  if (b.kind === 1) {
    out[0] = dx * b.a; out[1] = dy * b.a; out[2] = dz * b.a; out[3] = b.a;
    return 1;
  }
  let n = 0;
  const put = (ox: number, oy: number, oz: number) => {
    out[n * 4] = ox; out[n * 4 + 1] = oy; out[n * 4 + 2] = oz; out[n * 4 + 3] = ox * dx + oy * dy + oz * dz;
    n += 1;
  };
  if (b.kind === 2) {
    for (const s of [-b.a, b.a]) put(m[0] * s + dx * b.t, m[3] * s + dy * b.t, m[6] * s + dz * b.t);
  } else {
    // Both faces: against the rim (a direction in the piece's plane) an edge touches along its whole thickness.
    for (const hz of [-b.t / 2, b.t / 2]) {
      for (let i = 0; i < b.poly.length; i += 2) {
        const vx = b.poly[i], vy = b.poly[i + 1];
        put(m[0] * vx + m[1] * vy + m[2] * hz, m[3] * vx + m[4] * vy + m[5] * hz, m[6] * vx + m[7] * vy + m[8] * hz);
      }
    }
  }
  let best = -Infinity;
  for (let i = 0; i < n; i += 1) best = Math.max(best, out[i * 4 + 3]);
  let k = 0;
  for (let i = 0; i < n; i += 1) {
    if (out[i * 4 + 3] < best - 0.12) continue;
    for (let j = 0; j < 4; j += 1) out[k * 4 + j] = out[i * 4 + j];
    extremeIds[k] = i;
    k += 1;
  }
  return k;
}

export type CellSim = ReturnType<typeof createCell>;

/** One contact of a substep: A pushed along −n, B (or the glass/rim when b < 0) along +n, at arms rA, rB. */
type Contact = {
  a: number; b: number;
  nx: number; ny: number; nz: number;
  rax: number; ray: number; raz: number; rbx: number; rby: number; rbz: number;
  t1x: number; t1y: number; t1z: number; t2x: number; t2y: number; t2z: number;
  kn: number; kt1: number; kt2: number;
  /** The normal speed to reach: 0 at rest, a bounce after a hard hit, or closing a small gap (speculative). */
  target: number;
  ln: number; lt1: number; lt2: number;
  key: number;
};

/** The object cell: pieces, gravity, shaking. `step(dt, ax, ay, az)` takes the effective acceleration, cell frame. */
export function createCell(rand: () => number, set = 0) {
  let bodies = makePieces(rand, set);
  // How the drum is held (tiltFor): gravity along the glass at rest is G·cos(tilt).
  let tilt = TILT;
  let oil = false;
  // Gravity's direction in the drum a moment ago, and how fast it is turning (rad/s, smoothed): while the drum turns,
  // nothing may fall asleep, or the pile would never get to slide round.
  let lastGx = 0;
  let lastGy = 1;
  let turning = 0;
  // Broad phase: a cell at least as wide as the two biggest pieces' reach (splinters and leaves are up to ~4.8 mm).
  const CELL = 10;
  const GN = Math.ceil((2 * CELL_R) / CELL);
  const grid: number[][] = Array.from({ length: GN * GN }, () => []);
  const ea = new Float64Array(4 * 24);
  const eb = new Float64Array(4 * 24);
  const armA = [0, 0, 0];
  const armB = [0, 0, 0];
  const tmpA = [0, 0, 0];
  const tmpB = [0, 0, 0];
  /** How far a piece reaches along a direction, and (in arm) the middle of the points that reach that far. */
  const reach = (b: Body, dx: number, dy: number, dz: number, buf: Float64Array, arm: number[]) => {
    const n = extremePoints(b, dx, dy, dz, buf);
    let best = -Infinity;
    arm[0] = 0; arm[1] = 0; arm[2] = 0;
    for (let i = 0; i < n; i += 1) {
      best = Math.max(best, buf[i * 4 + 3]);
      arm[0] += buf[i * 4] / n; arm[1] += buf[i * 4 + 1] / n; arm[2] += buf[i * 4 + 2] / n;
    }
    return best;
  };

  const contacts: Contact[] = [];
  let used = 0;
  /** Position fixes, one per touching pair or piece-and-wall: a, b, nx, ny, nz, depth. */
  const fixes: number[] = [];
  /** Last substep's impulses per contact key: normal impulse, friction impulse (world), normal. */
  let warm = new Map<number, number[]>();
  let next = new Map<number, number[]>();
  const SPECULATIVE = 0.04;

  const addContact = (a: number, b: number, nx: number, ny: number, nz: number, ra: number[], rb: number[] | null, pen: number, h: number, e: number, key: number) => {
    const A = bodies[a];
    const B = b >= 0 ? bodies[b] : null;
    if (used === contacts.length) {
      contacts.push({ a: 0, b: 0, nx: 0, ny: 0, nz: 0, rax: 0, ray: 0, raz: 0, rbx: 0, rby: 0, rbz: 0, t1x: 0, t1y: 0, t1z: 0, t2x: 0, t2y: 0, t2z: 0, kn: 0, kt1: 0, kt2: 0, target: 0, ln: 0, lt1: 0, lt2: 0, key: 0 });
    }
    const c = contacts[used];
    used += 1;
    c.a = a; c.b = b; c.nx = nx; c.ny = ny; c.nz = nz; c.key = key;
    c.rax = ra[0]; c.ray = ra[1]; c.raz = ra[2];
    c.rbx = rb ? rb[0] : 0; c.rby = rb ? rb[1] : 0; c.rbz = rb ? rb[2] : 0;
    // Two tangents for friction.
    let t1x: number, t1y: number, t1z: number;
    if (Math.abs(nx) < 0.9) {
      t1x = 0; t1y = nz; t1z = -ny;
    } else {
      t1x = -nz; t1y = 0; t1z = nx;
    }
    const tl = Math.hypot(t1x, t1y, t1z);
    t1x /= tl; t1y /= tl; t1z /= tl;
    c.t1x = t1x; c.t1y = t1y; c.t1z = t1z;
    c.t2x = ny * t1z - nz * t1y; c.t2y = nz * t1x - nx * t1z; c.t2z = nx * t1y - ny * t1x;
    const eff = (dx: number, dy: number, dz: number) => {
      const ax = c.ray * dz - c.raz * dy, ay = c.raz * dx - c.rax * dz, az = c.rax * dy - c.ray * dx;
      let k = A.invM + A.invI * (ax * ax + ay * ay + az * az);
      if (B) {
        const bx = c.rby * dz - c.rbz * dy, by = c.rbz * dx - c.rbx * dz, bz = c.rbx * dy - c.rby * dx;
        k += B.invM + B.invI * (bx * bx + by * by + bz * bz);
      }
      return 1 / k;
    };
    c.kn = eff(nx, ny, nz);
    c.kt1 = eff(c.t1x, c.t1y, c.t1z);
    c.kt2 = eff(c.t2x, c.t2y, c.t2z);
    const vn = relNormal(c);
    c.target = pen < 0 ? pen / h : vn < -120 ? -e * vn : 0;
    const w = warm.get(key);
    c.ln = 0;
    c.lt1 = 0;
    c.lt2 = 0;
    if (w && w[4] * nx + w[5] * ny + w[6] * nz > 0.97) {
      c.ln = w[0] * 0.9;
      c.lt1 = (w[1] * c.t1x + w[2] * c.t1y + w[3] * c.t1z) * 0.9;
      c.lt2 = (w[1] * c.t2x + w[2] * c.t2y + w[3] * c.t2z) * 0.9;
    }
    if (c.ln || c.lt1 || c.lt2) {
      apply(c, c.nx * c.ln + c.t1x * c.lt1 + c.t2x * c.lt2, c.ny * c.ln + c.t1y * c.lt1 + c.t2y * c.lt2, c.nz * c.ln + c.t1z * c.lt1 + c.t2z * c.lt2);
    }
  };
  /** The speed at which B's contact point moves away from A's along (dx, dy, dz). */
  const relAlong = (c: Contact, dx: number, dy: number, dz: number) => {
    const A = bodies[c.a];
    let vx = -(A.vx + A.wy * c.raz - A.wz * c.ray);
    let vy = -(A.vy + A.wz * c.rax - A.wx * c.raz);
    let vz = -(A.vz + A.wx * c.ray - A.wy * c.rax);
    if (c.b >= 0) {
      const B = bodies[c.b];
      vx += B.vx + B.wy * c.rbz - B.wz * c.rby;
      vy += B.vy + B.wz * c.rbx - B.wx * c.rbz;
      vz += B.vz + B.wx * c.rby - B.wy * c.rbx;
    }
    return vx * dx + vy * dy + vz * dz;
  };
  const relNormal = (c: Contact) => relAlong(c, c.nx, c.ny, c.nz);
  /** Impulse P on B at its arm and −P on A at its arm. */
  const apply = (c: Contact, px: number, py: number, pz: number) => {
    const A = bodies[c.a];
    A.vx -= px * A.invM; A.vy -= py * A.invM; A.vz -= pz * A.invM;
    A.wx -= A.invI * (c.ray * pz - c.raz * py); A.wy -= A.invI * (c.raz * px - c.rax * pz); A.wz -= A.invI * (c.rax * py - c.ray * px);
    A.touch = 1;
    if (c.b >= 0) {
      const B = bodies[c.b];
      B.vx += px * B.invM; B.vy += py * B.invM; B.vz += pz * B.invM;
      B.wx += B.invI * (c.rby * pz - c.rbz * py); B.wy += B.invI * (c.rbz * px - c.rbx * pz); B.wz += B.invI * (c.rbx * py - c.rby * px);
      B.touch = 1;
    }
  };

  const wake = (b: Body) => {
    if (!b.asleep) return;
    b.asleep = false;
    b.invM = b.im;
    b.invI = b.ii;
    b.still = 0;
  };
  const sleep = (b: Body, gx: number, gy: number) => {
    b.asleep = true;
    b.invM = 0;
    b.invI = 0;
    b.vx = 0; b.vy = 0; b.vz = 0; b.wx = 0; b.wy = 0; b.wz = 0;
    b.sgx = gx;
    b.sgy = gy;
  };

  const WALLS: [number, number, number, number][] = [[0, 0, -1, 0], [0, 0, 1, DEPTH]];
  const detect = (h: number, e: number) => {
    used = 0;
    fixes.length = 0;
    for (let i = 0; i < bodies.length; i += 1) {
      const b = bodies[i];
      if (b.asleep) continue;
      const r = Math.hypot(b.x, b.y);
      const walls: [number, number, number, number][] = r > 1e-6 ? [...WALLS, [b.x / r, b.y / r, 0, CELL_R]] : WALLS;
      walls.forEach(([dx, dy, dz, limit], wi) => {
        const n = extremePoints(b, dx, dy, dz, ea);
        const base = b.x * dx + b.y * dy + b.z * dz - limit;
        let deepest = -Infinity;
        for (let k = 0; k < n; k += 1) {
          const pen = base + ea[k * 4 + 3];
          if (pen < -SPECULATIVE) continue;
          deepest = Math.max(deepest, pen);
          tmpA[0] = ea[k * 4]; tmpA[1] = ea[k * 4 + 1]; tmpA[2] = ea[k * 4 + 2];
          addContact(i, -1, dx, dy, dz, tmpA, null, pen, h, e, 1e7 + i * 256 + wi * 32 + extremeIds[k]);
        }
        if (deepest > 0) fixes.push(i, -1, dx, dy, dz, deepest);
      });
    }
    for (const cell of grid) cell.length = 0;
    const at = (v: number) => clamp(Math.floor((v + CELL_R) / CELL), 0, GN - 1);
    bodies.forEach((b, i) => grid[at(b.y) * GN + at(b.x)].push(i));
    for (let i = 0; i < bodies.length; i += 1) {
      const A = bodies[i];
      const gx = at(A.x), gy = at(A.y);
      for (let yy = Math.max(0, gy - 1); yy <= Math.min(GN - 1, gy + 1); yy += 1) {
        for (let xx = Math.max(0, gx - 1); xx <= Math.min(GN - 1, gx + 1); xx += 1) {
          for (const j of grid[yy * GN + xx]) {
            if (j <= i) continue;
            const B = bodies[j];
            const cx = B.x - A.x, cy = B.y - A.y, cz = B.z - A.z;
            const d = Math.hypot(cx, cy, cz);
            if (d > A.bound + B.bound + SPECULATIVE || d < 1e-9) continue;
            if (A.asleep && B.asleep) continue;
            if (A.asleep || B.asleep) {
              const closing = ((A.vx - B.vx) * cx + (A.vy - B.vy) * cy + (A.vz - B.vz) * cz) / d;
              if (closing > WAKE_HIT) {
                wake(A);
                wake(B);
              }
            }
            // Separating axes: the line between the centres, the face normals of flat pieces and their edges'
            // normals; the shallowest overlap wins, and any axis with a clear gap means no contact. So flakes lying
            // offset on each other touch face to face, and a corner pressing on an edge pushes along that edge's
            // normal, not along the line between the centres (which would make piled shards slide off each other).
            let nx = 0, ny = 0, nz = 0;
            let pen = Infinity;
            let apart = false;
            /** Whose feature the winning axis is: 0 neither (centre line or faces), 1 an edge of A, 2 an edge of B. */
            let ref = 0;
            const eA = A.edges.length / 2, eB = B.edges.length / 2;
            for (let axis = 0; axis < 3 + eA + eB && !apart; axis += 1) {
              let ux: number, uy: number, uz: number;
              if (axis === 0) {
                ux = cx / d; uy = cy / d; uz = cz / d;
              } else if (axis < 3) {
                const P = axis === 1 ? A : B;
                if (P.kind !== 0 && P.kind !== 3) continue;
                ux = P.m[2]; uy = P.m[5]; uz = P.m[8];
              } else {
                const P = axis < 3 + eA ? A : B;
                const k = (axis < 3 + eA ? axis - 3 : axis - 3 - eA) * 2;
                const ex = P.edges[k], ey = P.edges[k + 1];
                ux = P.m[0] * ex + P.m[1] * ey; uy = P.m[3] * ex + P.m[4] * ey; uz = P.m[6] * ex + P.m[7] * ey;
              }
              if (ux * cx + uy * cy + uz * cz < 0) {
                ux = -ux; uy = -uy; uz = -uz;
              }
              const over = reach(A, ux, uy, uz, ea, tmpA) + reach(B, -ux, -uy, -uz, eb, tmpB) - (ux * cx + uy * cy + uz * cz);
              if (over < -SPECULATIVE) apart = true;
              else if (over < pen) {
                pen = over;
                nx = ux; ny = uy; nz = uz;
                armA[0] = tmpA[0]; armA[1] = tmpA[1]; armA[2] = tmpA[2];
                armB[0] = tmpB[0]; armB[1] = tmpB[1]; armB[2] = tmpB[2];
                ref = axis < 3 ? 0 : axis < 3 + eA ? 1 : 2;
              }
            }
            if (apart) continue;
            // Both arms must reach the same point in space, or the contact would not be a real one (and the solver
            // would pump energy through the spins). Against an edge that point is the other piece's corner touching
            // it; otherwise the middle between the two touching features.
            let px: number, py: number, pz: number;
            if (ref === 1) {
              px = B.x + armB[0]; py = B.y + armB[1]; pz = B.z + armB[2];
            } else if (ref === 2) {
              px = A.x + armA[0]; py = A.y + armA[1]; pz = A.z + armA[2];
            } else {
              px = (A.x + armA[0] + B.x + armB[0]) / 2; py = (A.y + armA[1] + B.y + armB[1]) / 2; pz = (A.z + armA[2] + B.z + armB[2]) / 2;
            }
            armA[0] = px - A.x; armA[1] = py - A.y; armA[2] = pz - A.z;
            armB[0] = px - B.x; armB[1] = py - B.y; armB[2] = pz - B.z;
            addContact(i, j, nx, ny, nz, armA, armB, pen, h, e, i * 4096 + j);
            if (pen > 0) fixes.push(i, j, nx, ny, nz, pen);
          }
        }
      }
    }
  };

  const solve = (mu: number, iterations: number) => {
    for (let it = 0; it < iterations; it += 1) {
      for (let q = 0; q < used; q += 1) {
        const c = contacts[q];
        const vn = relNormal(c);
        const ln = Math.max(0, c.ln + (c.target - vn) * c.kn);
        const dn = ln - c.ln;
        c.ln = ln;
        if (dn) apply(c, c.nx * dn, c.ny * dn, c.nz * dn);
        // Coulomb friction, each tangent within ±μ·(normal impulse).
        const cap = mu * c.ln;
        const l1 = clamp(c.lt1 - relAlong(c, c.t1x, c.t1y, c.t1z) * c.kt1, -cap, cap);
        const d1 = l1 - c.lt1;
        c.lt1 = l1;
        const l2 = clamp(c.lt2 - relAlong(c, c.t2x, c.t2y, c.t2z) * c.kt2, -cap, cap);
        const d2 = l2 - c.lt2;
        c.lt2 = l2;
        if (d1 || d2) apply(c, c.t1x * d1 + c.t2x * d2, c.t1y * d1 + c.t2y * d2, c.t1z * d1 + c.t2z * d2);
      }
    }
    // Remember the impulses for the next substep's warm start.
    next.clear();
    for (let q = 0; q < used; q += 1) {
      const c = contacts[q];
      next.set(c.key, [c.ln, c.t1x * c.lt1 + c.t2x * c.lt2, c.t1y * c.lt1 + c.t2y * c.lt2, c.t1z * c.lt1 + c.t2z * c.lt2, c.nx, c.ny, c.nz]);
    }
    const swap = warm;
    warm = next;
    next = swap;
  };

  /** Push overlapping pieces apart, without touching their velocities (so no energy is added). */
  const fixPositions = () => {
    for (let i = 0; i < fixes.length; i += 6) {
      const a = fixes[i], b = fixes[i + 1];
      const depth = Math.max(0, fixes[i + 5] - 0.01) * 0.5;
      if (!depth) continue;
      const A = bodies[a];
      const B = b >= 0 ? bodies[b] : null;
      const tot = A.invM + (B ? B.invM : 0);
      const sa = (depth * A.invM) / tot;
      A.x -= fixes[i + 2] * sa; A.y -= fixes[i + 3] * sa; A.z -= fixes[i + 4] * sa;
      if (B) {
        const sb = (depth * B.invM) / tot;
        B.x += fixes[i + 2] * sb; B.y += fixes[i + 3] * sb; B.z += fixes[i + 4] * sb;
      }
    }
  };

  return {
    get bodies() {
      return bodies;
    },
    get oil() {
      return oil;
    },
    set oil(v: boolean) {
      oil = v;
      for (const b of bodies) wake(b);
    },
    /** New pieces of the same set, or of another one. */
    reset(nextSet = set, source = rand) {
      set = nextSet;
      bodies = makePieces(source, set);
      warm.clear();
    },
    wakeAll() {
      for (const b of bodies) wake(b);
    },
    /** Freeze every piece where it is: asleep, as solid as the glass; a shake, a turn of the drum or a hit wakes them. */
    freeze() {
      for (const b of bodies) if (!b.asleep) sleep(b, lastGx, lastGy);
    },
    /**
     * Toss the pieces: each flies off against gravity — up the picture (within ±40°) and back into the drum's depth —
     * and tumbles, with its own random share of `strength` (1: a hard yank, a piece rises about the drum's radius).
     */
    get tilt() {
      return tilt;
    },
    set tilt(v: number) {
      tilt = v;
    },
    toss(strength: number) {
      if (!(strength > 0)) return;
      // Held upright the pieces barely slide back, so they fly off every way (else they would all end up at the top).
      const every = clamp((tilt - TILT) / (TILT_UPRIGHT - TILT), 0, 1);
      for (const b of bodies) {
        wake(b);
        const u = strength * (0.35 + 0.65 * rand());
        const a = (rand() - 0.5) * (1.4 + every * (Math.PI * 2 - 1.4));
        const cs = Math.cos(a), sn = Math.sin(a);
        b.vx -= (lastGx * cs - lastGy * sn) * 340 * u;
        b.vy -= (lastGx * sn + lastGy * cs) * 340 * u;
        b.vz -= 230 * strength * (0.3 + 0.7 * rand());
        const spin = 18 * strength;
        b.wx += (rand() - 0.5) * spin;
        b.wy += (rand() - 0.5) * spin;
        b.wz += (rand() - 0.5) * spin;
      }
    },
    get sleeping() {
      return bodies.filter((b) => b.asleep).length;
    },
    /** One frame: (ax, ay, az) is the acceleration the pieces feel in the cell frame (gravity minus the drum's own). */
    step(dt: number, ax: number, ay: number, az: number, shake = 0) {
      const h = dt / SUBSTEPS;
      const lin = oil ? 14 : 0.4;
      const ang = oil ? 16 : 1.2;
      const buoy = oil ? 0.35 : 1;
      const e = oil ? 0 : 0.3;
      const mu = oil ? 0.12 : 0.4;
      const roll = Math.exp(-(oil ? 0 : 5) * h);
      // Resting pieces wake when the drum has turned enough for their slope to give way, or when it is shaken.
      const gl = Math.hypot(ax, ay) || 1;
      const gdx = ax / gl, gdy = ay / gl;
      const turnNow = Math.acos(Math.min(1, gdx * lastGx + gdy * lastGy)) / Math.max(dt, 1e-4);
      turning += (turnNow - turning) * Math.min(1, dt * 4);
      lastGx = gdx;
      lastGy = gdy;
      const mayRest = turning < 0.02;
      // Shaken: the scene says how hard (any direction), or gravity's pull is not what it is at rest.
      const shaken = shake > 0.08 * G || Math.abs(gl - G * Math.cos(tilt)) > 0.06 * G;
      for (const b of bodies) {
        if (b.asleep && (shaken || gdx * b.sgx + gdy * b.sgy < Math.cos((12 * Math.PI) / 180))) wake(b);
      }
      // Tiny flakes lose their spin to the air (and oil) much faster than heavy shards do.
      const flakeSpin = Math.exp(-6 * h);
      for (let s = 0; s < SUBSTEPS; s += 1) {
        const dl = Math.exp(-lin * h);
        const da = Math.exp(-ang * h);
        for (const b of bodies) {
          if (b.asleep) continue;
          if (b.kind === 3) {
            b.wx *= flakeSpin; b.wy *= flakeSpin; b.wz *= flakeSpin;
          }
          b.vx = (b.vx + ax * buoy * h) * dl;
          b.vy = (b.vy + ay * buoy * h) * dl;
          b.vz = (b.vz + az * buoy * h) * dl;
          b.wx *= da; b.wy *= da; b.wz *= da;
          if (b.touch) {
            // Rolling resistance: spin dies down while a piece lies on something.
            b.wx *= roll; b.wy *= roll; b.wz *= roll;
            b.touch = 0;
          }
        }
        detect(h, e);
        solve(mu, ITERATIONS);
        for (const b of bodies) {
          if (b.asleep) continue;
          b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
          // q += ½ (0, ω) q h
          const { qw, qx, qy, qz, wx, wy, wz } = b;
          b.qw += 0.5 * h * (-wx * qx - wy * qy - wz * qz);
          b.qx += 0.5 * h * (wx * qw + wy * qz - wz * qy);
          b.qy += 0.5 * h * (wy * qw + wz * qx - wx * qz);
          b.qz += 0.5 * h * (wz * qw + wx * qy - wy * qx);
          const n = Math.hypot(b.qw, b.qx, b.qy, b.qz);
          b.qw /= n; b.qx /= n; b.qy /= n; b.qz /= n;
          setMatrix(b);
        }
        fixPositions();
        for (const b of bodies) {
          if (b.asleep) continue;
          const dx = b.x - b.rx, dy = b.y - b.ry, dz = b.z - b.rz;
          const near = dx * dx + dy * dy + dz * dz < SLEEP_MOVE * SLEEP_MOVE && b.m[2] * b.rnx + b.m[5] * b.rny + b.m[8] * b.rnz > SLEEP_TURN
            && b.vx * b.vx + b.vy * b.vy + b.vz * b.vz < SLEEP_V * SLEEP_V;
          if (near && mayRest) b.still += h;
          else {
            b.still = 0;
            b.rx = b.x; b.ry = b.y; b.rz = b.z;
            b.rnx = b.m[2]; b.rny = b.m[5]; b.rnz = b.m[8];
          }
          if (b.still > SLEEP_AFTER) sleep(b, gdx, gdy);
        }
      }
      // A last hard clamp inside the drum, whatever happened (a violent shake must not lose a piece).
      for (const b of bodies) {
        b.z = clamp(b.z, 0, DEPTH);
        const r = Math.hypot(b.x, b.y);
        if (r > CELL_R) {
          b.x *= CELL_R / r;
          b.y *= CELL_R / r;
        }
      }
    },
  };
}

/**
 * Lays a set's pieces out flat for the preview: grouped (glass, shells, beads, bugle beads, flakes), row by row, as big
 * as they fit into aw × ah css px. Sets their positions (mm round the area's middle) and returns the scale (px per mm).
 */
function layOut(bodies: Body[], aw: number, ah: number): number {
  const GAP = 0.9;
  const items = bodies.map((b) => {
    let x0 = 0, x1 = 0, y0 = 0, y1 = 0;
    if (b.kind === 0 || b.kind === 3) {
      // The outline as the piece lies (turned by its own matrix), seen from above.
      for (let i = 0; i < b.poly.length; i += 2) {
        const px = b.m[0] * b.poly[i] + b.m[1] * b.poly[i + 1], py = b.m[3] * b.poly[i] + b.m[4] * b.poly[i + 1];
        x0 = Math.min(x0, px); x1 = Math.max(x1, px);
        y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
    } else if (b.kind === 1) {
      x0 = -b.a; x1 = b.a; y0 = -b.a; y1 = b.a;
    } else {
      x0 = -b.a - b.t; x1 = b.a + b.t; y0 = -b.t; y1 = b.t;
    }
    const group = b.kind === 0 ? (b.pearl ? 1 : 0) : b.kind === 1 ? 2 : b.kind === 2 ? 3 : 4;
    return { b, group, x0, x1, y0, y1 };
  }).sort((p, q) => p.group - q.group);
  type Row = { list: typeof items; w: number; h: number };
  const rowsFor = (width: number) => {
    const rows: Row[] = [];
    let row: Row | null = null;
    for (const it of items) {
      const w = it.x1 - it.x0;
      if (!row || it.group !== row.list[0].group || row.w + GAP + w > width) {
        row = { list: [], w: -GAP, h: 0 };
        rows.push(row);
      }
      row.list.push(it);
      row.w += GAP + w;
      row.h = Math.max(row.h, it.y1 - it.y0);
    }
    return rows;
  };
  const height = (rows: Row[]) => rows.reduce((s, r) => s + r.h, 0) + GAP * (rows.length - 1);
  let lo = 1, hi = 80;
  for (let i = 0; i < 24; i += 1) {
    const k = (lo + hi) / 2;
    if (height(rowsFor(aw / k)) <= ah / k) lo = k;
    else hi = k;
  }
  const k = lo * 0.96;
  const rows = rowsFor(aw / k);
  let y = -height(rows) / 2;
  for (const r of rows) {
    let x = -r.w / 2;
    for (const it of r.list) {
      it.b.x = x - it.x0;
      it.b.y = y + r.h / 2 - (it.y0 + it.y1) / 2;
      x += it.x1 - it.x0 + GAP;
    }
    y += r.h + GAP;
  }
  return k;
}

const rgbStr = (c: [number, number, number], a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
];

export const KALEIDOSCOPE: CanvasSceneDef = {
  kind: 'canvas',
  id: 'kaleidoscope',
  label: 'Калейдоскоп: стёклышки и блёстки',
  palettes: [['#fff6e6', '#e6d2e4', '#0b0910']],
  create(c) {
    const W = c.width;
    const H = c.height;
    const dpr = c.dpr;
    const [lightCenter, lightEdge, frameCol] = c.palette;
    // The piece set (kalSet) the drum holds now: changed in the list (top left) or in the tuning panel.
    const setOf = () => clamp(Math.round(Number(c.params.kalSet) || 0), 0, PIECE_SETS.length - 1);
    let cellSet = setOf();
    const cell = createCell(c.rand, cellSet);
    cell.tilt = tiltFor(c.params.kalSpread);
    // Settle the pieces before the first frame.
    for (let k = 0; k < 36; k += 1) cell.step(1 / 60, 0, G * Math.cos(cell.tilt), G * Math.sin(cell.tilt));
    // How the pieces spread (kalSpread): the value last acted on, the last one seen and how long until it counts as
    // settled (a slider dragged in the tuning panel changes it every frame; the pieces are tossed once, when it rests).
    let spreadApplied = c.params.kalSpread;
    let spreadSeen = spreadApplied;
    let spreadWait = 0;
    // The tuning panel asks for the preview by bumping kalShowSet.
    let showSeen = c.params.kalShowSet;
    // A set's own look (PieceSet.look) lies over the settings while that set is in the drum; what it covered comes back
    // when another set is poured in.
    let covered: Partial<KaleidoscopeLook> = {};
    const coverWith = (set: number) => {
      Object.assign(c.params, covered);
      covered = {};
      const look = PIECE_SETS[set].look;
      if (!look) return;
      for (const key of Object.keys(look) as (keyof KaleidoscopeLook)[]) (covered as Record<string, unknown>)[key] = c.params[key];
      Object.assign(c.params, look);
    };
    // Waiting for the scale to rest before laying the eyepieces out again (the tuning panel's slider changes it every
    // frame while dragged, and a new layout makes a new GPU context).
    let scaleWait = 0;
    let scaleSeen = -1;

    // The eyepieces' size: the hexagon's radius R (css px) from the screen, times the scale — its own on phones (720 px
    // wide and less). Everything that depends on it is laid out again (layout) when the scale changes.
    const scaleNow = () => clamp(W <= 720 ? c.params.kalScaleMobile : c.params.kalScale, 0.3, 3);
    let laidScale = scaleNow();
    let R = 40;
    let pxPerMm = 1;
    const m = 3;
    const tri = document.createElement('canvas');
    const tg = tri.getContext('2d')!;
    // The window ray traced on the GPU (kaleidoscopeGlass.ts); the flat drawing stays as the other choice (⚙).
    let glass: GlassTracer | null = null;
    const rays = () => c.params.kalRays && !!glass;
    // HDR (kaleidoscopeHdr.ts): a WebGPU canvas under the scene's 2D one, used while the display is in HDR (the
    // system's switch, followed every frame), the browser can show extended range and the tracer draws; otherwise the
    // picture is drawn on the 2D canvas as before.
    let hdr: HdrPresenter | null = null;
    let hdrAsked = false;
    let hdrWas = false;
    let disposed = false;
    const hdrPeak = () => clamp(c.params.kalHdrPeak, 1, 12);
    /** The picture's white (paper white). */
    const hdrWhite = () => clamp(c.params.kalHdrWhite, 0.3, 4);
    const hdrOn = () => !!hdr && !!hdrQuery?.matches && hdrPeak() > 1.01 && rays() && !!glass?.hdrCapable;
    const hex = document.createElement('canvas');
    const hg = hex.getContext('2d')!;
    let hcx = 0;
    let hcy = 0;
    // Maps cell millimetres (cell frame) to the triangle canvas, in css px with the triangle's O at (m, m).
    let gx0 = 0;
    let gy0 = 0;

    const ox = W / 2;
    const oy = H / 2 + 10;
    let centers: [number, number][] = [];
    let frames = new Path2D();
    const hexPath = (path: Path2D | CanvasRenderingContext2D, x: number, y: number, r: number) => {
      for (let k = 0; k < 6; k += 1) {
        const a = k * SECTOR;
        if (k === 0) path.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
        else path.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
      }
      path.closePath();
    };
    const layout = () => {
      laidScale = scaleNow();
      R = Math.max(20, Math.min(W, H) * (W < 700 ? 0.24 : 0.2) * laidScale);
      pxPerMm = R / TRI_MM;
      tri.width = Math.ceil((R + 2 * m) * dpr);
      tri.height = Math.ceil(((SQ3 / 2) * R + 2 * m) * dpr);
      glass?.dispose();
      try {
        glass = createGlassTracer(tri.width, tri.height, lightCenter, lightEdge);
      } catch {
        glass = null;
      }
      hex.width = 2 * Math.ceil((R + 2) * dpr);
      hex.height = 2 * Math.ceil(((SQ3 / 2) * R + 2) * dpr);
      hcx = hex.width / 2;
      hcy = hex.height / 2;
      gx0 = m + R / 2;
      gy0 = m + (R * SQ3) / 6;
      centers = [];
      frames = new Path2D();
      const colW = 1.5 * R;
      const rowH = SQ3 * R;
      for (let i = Math.floor(-(ox + R) / colW) - 1; i <= Math.ceil((W - ox + R) / colW) + 1; i += 1) {
        const shift = ((i % 2) + 2) % 2 ? rowH / 2 : 0;
        for (let j = Math.floor(-(oy + R) / rowH) - 1; j <= Math.ceil((H - oy + R) / rowH) + 1; j += 1) {
          const x = ox + colW * i;
          const y = oy + rowH * j + shift;
          if (x < -R || x > W + R || y < -R || y > H + R) continue;
          centers.push([x, y]);
          hexPath(frames, x, y, R);
        }
      }
    };
    layout();
    const hexAt = (x: number, y: number): [number, number] => {
      const px = (x - ox) / R;
      const py = (y - oy) / R;
      const q = (2 / 3) * px;
      const r = (-1 / 3) * px + (SQ3 / 3) * py;
      const s = -q - r;
      let rq = Math.round(q), rr = Math.round(r);
      const rs = Math.round(s);
      const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
      if (dq > dr && dq > ds) rq = -rr - rs;
      else if (dr > ds) rr = -rq - rs;
      return [ox + R * 1.5 * rq, oy + R * SQ3 * (rr + rq / 2)];
    };

    let clock = 0;
    let angle = 0;
    // A real kaleidoscope lies still until you turn it: the drum only turns by itself when asked (⟳).
    let autoTurn = false;
    // The lamp: up and to the left; the cursor nudges it.
    const LX = -0.35;
    const LY = -0.45;
    let lx = LX;
    let ly = LY;
    let hint = 1;
    // The grabbed hexagon: its home, where the grab began, its offset on a spring.
    let grab: { cx: number; cy: number; sx: number; sy: number; ox: number; oy: number; vx: number; vy: number; held: boolean } | null = null;
    let shakeAx = 0;
    let shakeAy = 0;

    // Top left: the piece set's name (opens the list of sets), the magnifier (a window with the set's pieces), then the
    // buttons.
    tg.font = '13px sans-serif';
    const pillText = (i: number) => (W < 420 ? '' : 'Набор: ') + PIECE_SETS[i].label;
    // Over a whole page the site's header covers the top 70 px: the controls go under it.
    const TOP = c.body ? 72 : 0;
    const pill = { x: 10, y: 10 + TOP, w: Math.ceil(Math.max(...PIECE_SETS.map((_, i) => tg.measureText(pillText(i)).width))) + 32, h: 28 };
    const LENS_TEXT = 'Стёклышки';
    const lensLabel = W >= 480;
    const lens = { x: pill.x + pill.w + 4, y: 10 + TOP, w: lensLabel ? 32 + Math.ceil(tg.measureText(LENS_TEXT).width) + 10 : 28, h: 28 };
    const inRect = (x: number, y: number, r: { x: number; y: number; w?: number; h?: number; s?: number }) =>
      x >= r.x && x <= r.x + (r.w ?? r.s ?? 0) && y >= r.y && y <= r.y + (r.h ?? r.s ?? 0);
    // ✦ (new pieces of the same set) goes with the set; a gap, then the drum's own buttons.
    const buttons = [
      { id: 'new', glyph: '✦', label: 'Новые стёклышки того же набора' },
      { id: 'turn', glyph: '⟳', label: 'Вращение барабана' },
      { id: 'oil', glyph: '≈', label: 'Стёклышки в масле' },
      { id: 'shake', glyph: '⇅', label: 'Встряхнуть' },
      { id: 'settings', glyph: '⚙', label: 'Настройки' },
    ].map((b, i) => ({ ...b, x: lens.x + lens.w + 4 + i * 34 + (i > 0 ? 10 : 0), y: 10 + TOP, s: 28 }));
    const buttonAt = (x: number, y: number) => buttons.find((b) => x >= b.x && x <= b.x + b.s && y >= b.y && y <= b.y + b.s) ?? null;
    let hover: (typeof buttons)[number] | null = null;
    let kick = 0;
    // The camera: turn the eyepiece's view, tilt the look into the drum (the rays lean), the wheel brings it closer.
    // Top right, or under the buttons when they reach there.
    const buttonsEnd = buttons[buttons.length - 1].x + 28;
    const orbit = createOrbit(c, {
      pitch: [-25, 25],
      zoom: [0.6, 3],
      place: () => ({ right: W - 10, top: buttonsEnd + 170 > W ? 44 : 10 }),
    });

    // The settings panel (⚙), under the buttons, in three tabs — the look (switches, sliders, presets), the pieces and the
    // drum, HDR (its state, sliders, the calibration strip) — so it stays short. Its rows are built for the tab shown.
    type PanelRow =
      | { kind: 'tabs' }
      | { kind: 'switch'; label: string; on: boolean; toggle: () => void; note: string }
      | { kind: 'slider'; st: (typeof KALEIDOSCOPE_SETTINGS)[number] }
      | { kind: 'text'; text: string; dim: boolean }
      | { kind: 'strip' }
      | { kind: 'presets' };
    let panelOpen = false;
    let panelTab: KaleidoscopeTab = 'look';
    let dragKey: NumberKey | null = null;
    const PW = Math.min(W - 20, 330);
    const ROW = 27;
    const panelX = 10;
    const panelY = 46 + TOP;
    const trackX = panelX + 168;
    const trackW = PW - 168 - 52;
    // Why HDR is or is not on (the HDR tab's first line).
    let hdrFailed = false;
    const hdrStatus = () => {
      if (!hdrQuery?.matches) return 'HDR выключен: дисплей не в HDR (включите HDR в системе)';
      if (hdrFailed) return 'HDR недоступен: браузер не умеет (нужен WebGPU)';
      if (!hdr) return 'HDR: запуск…';
      if (!rays()) return 'HDR работает только с трассировкой стекла';
      if (c.params.kalHdrPeak <= 1.01) return 'HDR выключен: предел монитора = 1';
      return 'HDR включён';
    };
    const sliderRows = (tab: KaleidoscopeTab, keys?: NumberKey[]): PanelRow[] =>
      KALEIDOSCOPE_SETTINGS.filter((st) => st.tab === tab && (!keys || keys.includes(st.key))).map((st) => ({ kind: 'slider', st }));
    const panelRows = (): PanelRow[] => {
      const rows: PanelRow[] = [{ kind: 'tabs' }];
      if (panelTab === 'look') {
        rows.push(
          { kind: 'switch', label: glass ? 'Трассировка стекла' : 'Трассировка (нет WebGL2)', on: rays(), toggle: () => { c.params.kalRays = !c.params.kalRays; }, note: rays() ? (hdrOn() ? 'вкл · HDR' : 'вкл') : 'плоская' },
          { kind: 'switch', label: 'Свет за курсором', on: c.params.kalLightCursor, toggle: () => { c.params.kalLightCursor = !c.params.kalLightCursor; }, note: c.params.kalLightCursor ? 'вкл' : 'выкл' },
          { kind: 'switch', label: 'Гистограмма', on: c.params.kalHistogram, toggle: () => { c.params.kalHistogram = !c.params.kalHistogram; }, note: c.params.kalHistogram ? 'вкл' : 'выкл' },
          ...sliderRows('look'),
          { kind: 'presets' },
        );
      } else if (panelTab === 'pieces') {
        rows.push(...sliderRows('pieces'));
      } else {
        rows.push(
          { kind: 'text', text: hdrStatus(), dim: !hdrOn() },
          ...sliderRows('hdr', ['kalHdrWhite', 'kalHdrSaturation', 'kalHdrGlints', 'kalHdrBloom', 'kalHdrSpill']),
          { kind: 'text', text: 'Калибровка: нажмите последний квадрат, где ещё виден центр', dim: !hdrOn() },
          { kind: 'strip' },
          ...sliderRows('hdr', ['kalHdrPeak']),
        );
      }
      return rows;
    };
    const panelHeight = () => panelRows().length * ROW + 12;
    const panelRow = (x: number, y: number) => {
      const n = panelRows().length;
      if (!panelOpen || x < panelX || x > panelX + PW || y < panelY || y > panelY + n * ROW + 12) return -2;
      return clamp(Math.floor((y - panelY - 6) / ROW), 0, n - 1);
    };
    /** The calibration strip in the panel (css px), when the HDR tab shows it. */
    const stripRect = () => {
      const i = panelRows().findIndex((r) => r.kind === 'strip');
      return i < 0 ? null : { x: panelX + 12, y: panelY + 6 + i * ROW + 2, w: PW - 24, h: 14 };
    };
    const setFromX = (key: NumberKey, x: number) => {
      const st = KALEIDOSCOPE_SETTINGS.find((q) => q.key === key)!;
      const v = st.min + clamp((x - trackX) / trackW, 0, 1) * (st.max - st.min);
      c.params[key] = Math.round(v / st.step) * st.step;
    };
    // Where the tab chips were drawn (the first row), for the clicks.
    let tabChips: { id: KaleidoscopeTab; x: number; w: number }[] = [];
    // Where the preset chips were drawn, for the clicks.
    let presetChips: { index: number; x: number; w: number }[] = [];
    const look = () => ({
      exposure: c.params.kalExposure, saturation: c.params.kalSaturation, sparkle: c.params.kalSparkle, glow: c.params.kalGlow,
      stars: c.params.kalStars, dispersion: c.params.kalDispersion, bevel: c.params.kalBevel, vignette: c.params.kalVignette,
    });
    // Seconds since the last disturbance (a shake, a new set, oil on or off): after kalFreeze the pile freezes.
    let quiet = 0;
    // Nothing to redraw while every piece rests and the light, the turn and the settings keep still — once the traced
    // picture has been refined (up to 8 sub-pixel-shifted traces averaged).
    let lastSig = '';
    let refined = 0;
    /** How many traces the still picture averages (kalSamples), and how many a frame once it is still. */
    const samples = () => clamp(Math.round(c.params.kalSamples), 1, 512);
    const PER_FRAME = 4;


    /** Where the lamp shines through the frosted back (mm, view frame): it moves with the light. */
    const backShift = (): [number, number] => {
      const dx = (lx - LX) * 12, dy = (ly - LY) * 12;
      const d = Math.hypot(dx, dy);
      return d > 9 ? [(dx * 9) / d, (dy * 9) / d] : [dx, dy];
    };
    /**
     * Towards the lamp (view frame): the cursor's sideways offset swings it round the axis, the vertical one tilts it,
     * within 22°–54° — never near the axis, where every flat-lying face would mirror it at once and wash out white.
     */
    const lampDir = (): [number, number, number] => {
      const az = Math.atan2(LY, LX) + (lx - LX) * 1.6;
      const tilt = clamp(Math.atan(Math.hypot(LX, LY)) + (ly - LY) * 0.5, 0.38, 0.95);
      return [Math.cos(az) * Math.sin(tilt), Math.sin(az) * Math.sin(tilt), Math.cos(tilt)];
    };

    // The brightness histogram (kalHistogram): of the picture as shown (luma of the sRGB-encoded colour), from the traced
    // triangle — in SDR over 0…white, in HDR over 0…the monitor's limit with SDR white marked; with the mean and the
    // share of clipped pixels (a channel at white, or in HDR at the limit).
    const HIST_N = 64;
    const hist = new Float32Array(HIST_N);
    const histInfo = { max: 1, clip: 0, over: 0, mean: 0, hdr: false, has: false };
    // The last picture's HDR floats (null when it went to the 2D triangle), and which picture the histogram is of.
    let lastHdr: Float32Array | null = null;
    let renders = 0;
    let histOf = -1;
    const updateHistogram = () => {
      histOf = renders;
      hist.fill(0);
      const w = tri.width, h = tri.height;
      const fromHdr = !!lastHdr;
      const src: ArrayLike<number> = fromHdr ? lastHdr! : tg.getImageData(0, 0, w, h).data;
      const scale = fromHdr ? 1 : 1 / 255;
      // The HDR values are extended sRGB (the peak encoded so too).
      const xMax = fromHdr ? 1.055 * Math.pow(hdrPeak(), 1 / 2.4) - 0.055 : 1;
      const clipAt = fromHdr ? 0.98 * xMax : 0.99;
      const tall = (R * SQ3) / 2;
      let n = 0, clip = 0, over = 0, sum = 0;
      for (let py = 0; py < h; py += 2) {
        // Only the triangle (its O at (m, m), css px; the HDR rows come bottom up).
        const yc = (fromHdr ? h - 1 - py : py) / dpr - m;
        if (yc < 0 || yc > tall) continue;
        const half = (1 - yc / tall) * (R / 2);
        for (let px = 0; px < w; px += 2) {
          if (Math.abs(px / dpr - m - R / 2) > half) continue;
          const o = (py * w + px) * 4;
          const r = src[o] * scale, gg = src[o + 1] * scale, b = src[o + 2] * scale;
          const Y = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
          hist[clamp(Math.floor((Y / xMax) * HIST_N), 0, HIST_N - 1)] += 1;
          const top = Math.max(r, gg, b);
          if (top >= clipAt) clip += 1;
          if (top > 1.001) over += 1;
          sum += Y;
          n += 1;
        }
      }
      histInfo.max = xMax;
      histInfo.clip = n ? clip / n : 0;
      histInfo.over = n ? over / n : 0;
      histInfo.mean = n ? sum / n : 0;
      histInfo.hdr = fromHdr;
      histInfo.has = n > 0;
    };
    const drawHistogram = (g: CanvasRenderingContext2D) => {
      const bw = Math.min(300, W - 24), bh = 156;
      const bx = W - bw - 12, by = H - bh - 60;
      const pc = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0).replace('.', ',')} %`;
      g.fillStyle = 'rgba(10,8,16,0.86)';
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.lineWidth = 1;
      g.beginPath();
      g.roundRect(bx, by, bw, bh, 9);
      g.fill();
      g.stroke();
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      g.font = '13px sans-serif';
      g.fillStyle = '#f6eee0';
      g.fillText(histInfo.hdr ? 'Гистограмма яркости · HDR' : 'Гистограмма яркости', bx + 10, by + 14, bw - 20);
      // The mean, what is brighter than white (HDR), what is clipped (at white, or in HDR at the monitor's limit).
      g.font = '12px sans-serif';
      g.fillStyle = 'rgba(246,238,224,0.8)';
      const stats = `средняя ${histInfo.mean.toFixed(2).replace('.', ',')}` + (histInfo.hdr ? ` · ярче белого ${pc(histInfo.over)}` : '');
      g.fillText(stats, bx + 10, by + 32, bw - 20);
      g.textAlign = 'right';
      g.fillStyle = histInfo.clip > 0.02 ? '#ff8a7a' : 'rgba(246,238,224,0.8)';
      g.fillText(`пересвет ${pc(histInfo.clip)}`, bx + bw - 10, by + 32);
      const ax = bx + 10, ay = by + 44, aw = bw - 20, ah = bh - 44 - 36;
      let top = 1;
      for (let i = 0; i < HIST_N; i += 1) top = Math.max(top, hist[i]);
      const white = Math.min(1, 1 / histInfo.max);
      for (let i = 0; i < HIST_N; i += 1) {
        const v = (i + 0.5) / HIST_N;
        const hgt = Math.sqrt(hist[i] / top) * ah;
        g.fillStyle = i === HIST_N - 1 && histInfo.clip > 0.005 ? '#ff6b5a' : v > white ? '#ffd27a' : 'rgba(246,238,224,0.85)';
        g.fillRect(ax + (i / HIST_N) * aw, ay + ah - hgt, aw / HIST_N - 0.5, hgt);
      }
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.beginPath();
      g.moveTo(ax, ay + ah + 0.5);
      g.lineTo(ax + aw, ay + ah + 0.5);
      g.stroke();
      g.font = '11px sans-serif';
      g.fillStyle = 'rgba(246,238,224,0.7)';
      g.textAlign = 'left';
      g.fillText('чёрный', ax, ay + ah + 10);
      g.textAlign = 'right';
      if (histInfo.hdr) {
        // SDR white on the HDR scale, and the monitor's limit at the right.
        const wx = ax + white * aw;
        g.setLineDash([3, 3]);
        g.beginPath();
        g.moveTo(wx, ay);
        g.lineTo(wx, ay + ah);
        g.stroke();
        g.setLineDash([]);
        g.textAlign = 'center';
        g.fillText('белый', wx, ay + ah + 10);
        g.textAlign = 'right';
        g.fillText(`предел ${String(hdrPeak()).replace('.', ',')}×`, ax + aw, ay + ah + 10);
      } else {
        g.fillText('белый', ax + aw, ay + ah + 10);
      }
      g.textAlign = 'left';
      g.fillStyle = 'rgba(246,238,224,0.55)';
      g.fillText(histInfo.hdr ? 'жёлтое — ярче белого (блики HDR)' : 'красный столбик справа — пересвет', ax, by + bh - 10, aw);
    };

    const renderTriangle = (sample: number, count: number) => {
      renders += 1;
      lastHdr = null;
      const k = pxPerMm * orbit.zoom;
      // The window is turned so that the drum's bottom (where the pile lies) is at the triangle's corner in the hexagon's
      // centre: the pieces gather into a rosette around each centre, not at the hexagons' corners.
      const view = angle + (2 * Math.PI) / 3 + orbit.yaw;
      const ca = Math.cos(view), sa = Math.sin(view);
      if (rays() && glass) {
        // Towards the lamp, in the drum's frame.
        const [vx, vy, vz] = lampDir();
        const [bx, by] = backShift();
        const data = glass.render(cell.bodies, view, gx0, gy0, k, dpr, [vx * ca + vy * sa, -vx * sa + vy * ca, vz], [bx * ca + by * sa, -bx * sa + by * ca], CELL_R, DEPTH, TRI_MM / SQ3 + 3, look(), sample, count, hdrOn() ? hdrPeak() : 0, hdrWhite(), clamp(c.params.kalHdrGlints, 0, 3), clamp(c.params.kalHdrSaturation, 0, 3), clamp(c.params.kalHdrBloom, 0, 3), clamp(c.params.kalHdrSpill, 0, 5), [0, Math.tan(orbit.pitch)]);
        lastHdr = data;
        if (data && hdr) {
          hdr.upload(data, tri.width, tri.height);
          return;
        }
        tg.setTransform(1, 0, 0, 1, 0, 0);
        tg.globalCompositeOperation = 'source-over';
        tg.drawImage(glass.canvas, 0, 0);
        return;
      }
      tg.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The backlight through frosted glass, brightest where the lamp shines through.
      const [bx, by] = backShift();
      const bg = tg.createRadialGradient(gx0 + bx * k, gy0 + by * k, 0, gx0 + bx * k, gy0 + by * k, CELL_R * k);
      bg.addColorStop(0, lightCenter);
      bg.addColorStop(1, lightEdge);
      tg.globalCompositeOperation = 'source-over';
      tg.fillStyle = bg;
      tg.fillRect(0, 0, tri.width, tri.height);
      // Cell frame → view frame (the drum's turn) → canvas.
      tg.setTransform(dpr * k * ca, dpr * k * sa, -dpr * k * sa, dpr * k * ca, dpr * gx0, dpr * gy0);
      // Half vector between the light and the eye, in the cell frame.
      const [ldx, ldy, ldz] = lampDir();
      let hx = ldx, hy = ldy, hz = ldz + 1;
      const hn = Math.hypot(hx, hy, hz);
      hx /= hn; hy /= hn; hz /= hn;
      const chx = hx * ca + hy * sa, chy = -hx * sa + hy * ca;
      const bodies = [...cell.bodies].sort((a, b) => a.z - b.z);
      const reach = TRI_MM / SQ3 + 5;
      for (const b of bodies) {
        if (Math.hypot(b.x, b.y) > reach + 20) continue;
        const bm = b.m;
        const nx = bm[2], ny = bm[5], nz = bm[8];
        if (b.kind === 0 || b.kind === 3) {
          tg.beginPath();
          for (let i = 0; i < b.poly.length; i += 2) {
            const px = b.x + bm[0] * b.poly[i] + bm[1] * b.poly[i + 1];
            const py = b.y + bm[3] * b.poly[i] + bm[4] * b.poly[i + 1];
            if (i === 0) tg.moveTo(px, py);
            else tg.lineTo(px, py);
          }
          tg.closePath();
          if (b.kind === 0) {
            const facing = Math.abs(nx * chx + ny * chy + nz * hz);
            const spec = facing ** 28;
            // Dichroic glass: its colour goes with the tilt towards the eye, not with the light.
            const col = b.col2 ? mix3(b.col, b.col2, clamp((Math.abs(nz) - 0.8) * 5, 0, 1)) : b.col;
            tg.globalCompositeOperation = 'multiply';
            tg.fillStyle = rgbStr(col, b.alpha);
            tg.fill();
            tg.strokeStyle = rgbStr([col[0] * 0.55, col[1] * 0.55, col[2] * 0.55], 0.9);
            tg.lineWidth = 0.28;
            tg.stroke();
            tg.globalCompositeOperation = 'lighter';
            if (spec > 0.02) {
              tg.fillStyle = `rgba(255,255,255,${spec * 0.6})`;
              tg.fill();
            }
            tg.strokeStyle = `rgba(255,255,255,${0.12 + spec * 0.5})`;
            tg.lineWidth = 0.12;
            tg.stroke();
          } else {
            // Glitter: the flake's facet tilts a little off its face normal, so flakes lying flat still twinkle apart.
            let fnx = nx + bm[0] * b.fx + bm[1] * b.fy;
            let fny = ny + bm[3] * b.fx + bm[4] * b.fy;
            let fnz = nz + bm[6] * b.fx + bm[7] * b.fy;
            const fl = Math.hypot(fnx, fny, fnz);
            fnx /= fl; fny /= fl; fnz /= fl;
            const facing = Math.abs(fnx * chx + fny * chy + fnz * hz);
            const spec = facing ** 60;
            let col = b.col;
            if (b.metal === 2) {
              const hue = (Math.abs(fnz) * 5 + b.fx * 3) % 1;
              col = [128 + 127 * Math.cos(6.283 * hue), 128 + 127 * Math.cos(6.283 * (hue - 0.33)), 128 + 127 * Math.cos(6.283 * (hue - 0.67))];
            }
            tg.globalCompositeOperation = 'source-over';
            tg.fillStyle = rgbStr([col[0] * 0.55, col[1] * 0.55, col[2] * 0.55]);
            tg.fill();
            tg.globalCompositeOperation = 'lighter';
            tg.fillStyle = rgbStr(col, 0.25 + spec * 0.75);
            tg.fill();
            if (spec > 0.2) {
              const s = (0.6 + spec * 2.2) * b.a;
              tg.strokeStyle = `rgba(255,255,255,${spec})`;
              tg.lineWidth = 0.14;
              tg.beginPath();
              tg.moveTo(b.x - s, b.y);
              tg.lineTo(b.x + s, b.y);
              tg.moveTo(b.x, b.y - s);
              tg.lineTo(b.x, b.y + s);
              tg.stroke();
            }
          }
        } else if (b.kind === 1) {
          const r = b.a;
          // Where the highlight sits on the sphere: towards the light, in the cell frame.
          const hlx = b.x + chx * r * 0.45, hly = b.y + chy * r * 0.45;
          if (b.pearl) {
            tg.globalCompositeOperation = 'source-over';
            const gr = tg.createRadialGradient(hlx, hly, r * 0.1, b.x, b.y, r);
            gr.addColorStop(0, '#ffffff');
            gr.addColorStop(0.5, rgbStr(b.col));
            gr.addColorStop(1, 'rgba(150,140,150,1)');
            tg.fillStyle = gr;
          } else {
            tg.globalCompositeOperation = 'multiply';
            const gr = tg.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
            gr.addColorStop(0, rgbStr(b.col, 0.55));
            gr.addColorStop(0.8, rgbStr(b.col, 0.95));
            gr.addColorStop(1, rgbStr([b.col[0] * 0.4, b.col[1] * 0.4, b.col[2] * 0.4], 1));
            tg.fillStyle = gr;
          }
          tg.beginPath();
          tg.arc(b.x, b.y, r, 0, Math.PI * 2);
          tg.fill();
          tg.globalCompositeOperation = 'lighter';
          const hl = tg.createRadialGradient(hlx, hly, 0, hlx, hly, r * 0.45);
          hl.addColorStop(0, 'rgba(255,255,255,0.95)');
          hl.addColorStop(1, 'rgba(255,255,255,0)');
          tg.fillStyle = hl;
          tg.beginPath();
          tg.arc(hlx, hly, r * 0.45, 0, Math.PI * 2);
          tg.fill();
        } else {
          // A rod, foreshortened by its tilt.
          const ux = bm[0] * b.a, uy = bm[3] * b.a;
          const along = Math.hypot(bm[0], bm[3]);
          tg.globalCompositeOperation = b.metal ? 'source-over' : 'multiply';
          tg.strokeStyle = rgbStr(b.metal ? [b.col[0] * 0.7, b.col[1] * 0.7, b.col[2] * 0.7] : b.col, b.metal ? 1 : 0.9);
          tg.lineCap = 'round';
          tg.lineWidth = b.t * 2;
          tg.beginPath();
          tg.moveTo(b.x - ux, b.y - uy);
          tg.lineTo(b.x + ux, b.y + uy);
          tg.stroke();
          tg.globalCompositeOperation = 'lighter';
          // The bright line along a cylinder, on the side towards the light.
          const px = -bm[3] / (along || 1), py = bm[0] / (along || 1);
          const side = Math.sign(px * chx + py * chy) || 1;
          tg.strokeStyle = `rgba(255,255,255,${0.35 + 0.4 * (1 - Math.abs(bm[6]))})`;
          tg.lineWidth = b.t * 0.5;
          tg.beginPath();
          tg.moveTo(b.x - ux * 0.8 + px * side * b.t * 0.45, b.y - uy * 0.8 + py * side * b.t * 0.45);
          tg.lineTo(b.x + ux * 0.8 + px * side * b.t * 0.45, b.y + uy * 0.8 + py * side * b.t * 0.45);
          tg.stroke();
        }
      }
      tg.globalCompositeOperation = 'source-over';
    };

    const composeHex = () => {
      hg.setTransform(1, 0, 0, 1, 0, 0);
      hg.clearRect(0, 0, hex.width, hex.height);
      // A hair outside the triangle: across a mirror line both sides are the same, so the overlap never shows.
      const grow = 1 + 1.4 / (R / SQ3);
      const cxT = R / 2, cyT = (R * SQ3) / 6;
      const vx = [0, R, R / 2].map((x) => cxT + (x - cxT) * grow);
      const vy = [0, 0, (R * SQ3) / 2].map((y) => cyT + (y - cyT) * grow);
      for (let k = 0; k < 6; k += 1) {
        // Even sectors: the triangle turned; odd ones: mirrored in the shared edge (reflection = turn by 2α ∘ flip).
        const a = k % 2 === 0 ? k * SECTOR : (k + 1) * SECTOR;
        const f = k % 2 === 0 ? 1 : -1;
        const cs = Math.cos(a), sn = Math.sin(a);
        hg.save();
        hg.setTransform(dpr * cs, dpr * sn, -dpr * sn * f, dpr * cs * f, hcx, hcy);
        hg.beginPath();
        hg.moveTo(vx[0], vy[0]);
        hg.lineTo(vx[1], vy[1]);
        hg.lineTo(vx[2], vy[2]);
        hg.closePath();
        hg.clip();
        hg.drawImage(tri, -m, -m, tri.width / dpr, tri.height / dpr);
        hg.restore();
      }
      // An eyepiece's soft dark rim.
      hg.setTransform(dpr, 0, 0, dpr, hcx, hcy);
      const v = hg.createRadialGradient(0, 0, R * 0.55, 0, 0, R * 1.02);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(0,0,0,${0.38 * clamp(c.params.kalVignette, 0, 2)})`);
      hg.fillStyle = v;
      hg.beginPath();
      hexPath(hg, 0, 0, R + 1);
      hg.fill();
    };

    // The list of sets, under the set's name: a few of each set's colours, its name and idea.
    const swatches = PIECE_SETS.map((set) => {
      const cols: RGB[] = [];
      const add = (col: RGB) => {
        if (cols.length < 7 && !cols.some((q) => q[0] === col[0] && q[1] === col[1] && q[2] === col[2])) cols.push(col);
      };
      let seed = 12345;
      const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      set.build(r, {
        shard: (o) => add(o.col), bead: (o) => add(o.col), rod: (o) => add(o.col),
        flake: (o) => add(METALS[o.metal]), petal: (o) => add(o.col), shell: (o) => add(o.col),
      });
      return cols;
    });
    let setMenu = false;
    let menuHover = -1;
    /** The hint for the set's name or the magnifier under the pointer. */
    let topHover = '';
    const MENU_ROW = 44;
    // The last row opens the preview.
    const menu = { x: 10, y: 46, w: Math.min(W - 20, 380), h: (PIECE_SETS.length + 1) * MENU_ROW + 8 };
    const menuItemAt = (x: number, y: number) => {
      if (!inRect(x, y, menu)) return -1;
      const i = Math.floor((y - menu.y - 4) / MENU_ROW);
      return i >= 0 && i <= PIECE_SETS.length ? i : -1;
    };

    // The preview: a set's pieces laid out on a light table (layOut), traced once and refined like the window. For the
    // set in the drum it shows the very pieces in it ("live"); for another one, pieces its generator made from `seed` —
    // "Положить в калейдоскоп" pours exactly those in. ✦ makes new ones (for the live set, new pieces in the drum).
    type Box = { x: number; y: number; w: number; h: number };
    type Preview = {
      set: number; live: boolean; seed: number; bodies: Body[]; k: number; tracer: GlassTracer | null; sample: number;
      box: Box; area: Box; note: string[]; counts: string[];
    };
    let preview: Preview | null = null;
    const seeded = (seed: number) => {
      let s = seed;
      return () => (s = (s * 16807) % 2147483647) / 2147483647;
    };
    const wrap = (text: string, width: number, maxLines: number) => {
      const lines: string[] = [];
      let line = '';
      for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (line && tg.measureText(next).width > width) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      if (line) lines.push(line);
      if (lines.length > maxLines) {
        lines.length = maxLines;
        lines[maxLines - 1] += '…';
      }
      return lines;
    };
    /** What the pieces are, counted (petals are the thin flat ones, shells the nacre ones). */
    const countsOf = (bodies: Body[]) => {
      const n = new Map<string, number>();
      for (const b of bodies) {
        const what = b.kind === 0 ? (b.pearl ? 'ракушки' : b.t < 0.4 ? 'лепестки и листики' : 'осколки')
          : b.kind === 1 ? (b.pearl ? 'жемчуг' : b.rough > 0.5 && b.a < 0.9 ? 'песчинки и семена' : 'бусины') : b.kind === 2 ? 'стеклярус' : 'блёстки';
        n.set(what, (n.get(what) ?? 0) + 1);
      }
      return `Всего ${bodies.length}: ${[...n].map(([what, k]) => `${what} ${k}`).join(', ')}`;
    };
    const CHOOSE = 'Положить в калейдоскоп';
    const REGEN = '✦ Сгенерировать заново';
    const pvButtons = (box: Box) => {
      tg.font = '13px sans-serif';
      const cw = Math.ceil(tg.measureText(CHOOSE).width) + 36;
      const rw = Math.ceil(tg.measureText(REGEN).width) + 24;
      const narrow = box.w < cw + rw + 36;
      return {
        prev: { x: box.x + 10, y: box.y + 10, w: 30, h: 30 },
        next: { x: box.x + 44, y: box.y + 10, w: 30, h: 30 },
        close: { x: box.x + box.w - 40, y: box.y + 10, w: 30, h: 30 },
        regen: { x: box.x + 12, y: box.y + box.h - 42, w: narrow ? 42 : rw, h: 30 },
        regenText: narrow ? '✦' : REGEN,
        choose: { x: box.x + box.w - 12 - cw, y: box.y + box.h - 42, w: cw, h: 30 },
      };
    };
    const closePreview = () => {
      preview?.tracer?.dispose();
      preview = null;
    };
    const openPreview = (set: number, seed?: number) => {
      closePreview();
      const live = seed === undefined && set === cellSet;
      const pieceSeed = seed ?? 1 + Math.floor(c.rand() * 2147483000);
      const w = Math.min(W - 24, 660);
      const h = Math.min(H - 24, 540);
      const box = { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h };
      const bodies = live ? cell.bodies.map((b) => ({ ...b, m: [...b.m] })) : makePieces(seeded(pieceSeed), set);
      tg.font = '12.5px sans-serif';
      const note = wrap(PIECE_SETS[set].note, w - 28, h < 420 ? 1 : 3);
      tg.font = '12px sans-serif';
      const counts = wrap(countsOf(bodies), w - 28, 2);
      const top = box.y + 70 + note.length * 17 + counts.length * 16 + 4;
      const area = { x: box.x + 12, y: top, w: w - 24, h: Math.max(60, box.y + h - 52 - top) };
      const tilt = seeded(pieceSeed + 1);
      for (const p of bodies) {
        // Face up on the table, a few degrees off (so a few of them glint).
        const axis = tilt() * Math.PI * 2;
        const half = (tilt() - 0.5) * 0.07;
        p.qw = Math.cos(half); p.qx = Math.cos(axis) * Math.sin(half); p.qy = Math.sin(axis) * Math.sin(half); p.qz = 0;
        // Shells hinge down, as drawn in books (turned over: a flat piece looks the same from both sides).
        if (p.kind === 0 && p.pearl) {
          p.qw = 0; p.qx = 1; p.qy = 0; p.qz = 0;
        }
        setMatrix(p);
        p.z = p.kind === 1 ? p.a : p.kind === 2 ? p.t : p.t / 2 + 0.05;
      }
      const k = layOut(bodies, area.w, area.h);
      let tracer: GlassTracer | null = null;
      if (glass) {
        try {
          tracer = createGlassTracer(Math.max(1, Math.round(area.w * dpr)), Math.max(1, Math.round(area.h * dpr)), lightCenter, lightEdge);
        } catch {
          tracer = null;
        }
      }
      preview = { set, live, seed: pieceSeed, bodies, k, tracer, sample: 0, box, area, note, counts };
    };
    const previewClick = (x: number, y: number) => {
      if (!preview) return;
      const pv = preview;
      const b = pvButtons(pv.box);
      const n = PIECE_SETS.length;
      if (!inRect(x, y, pv.box) || inRect(x, y, b.close)) closePreview();
      else if (inRect(x, y, b.prev)) openPreview((pv.set + n - 1) % n);
      else if (inRect(x, y, b.next)) openPreview((pv.set + 1) % n);
      else if (inRect(x, y, b.regen)) {
        if (pv.live) {
          cell.reset();
          quiet = 0;
          openPreview(pv.set);
        } else openPreview(pv.set, 1 + Math.floor(c.rand() * 2147483000));
      } else if (inRect(x, y, b.choose) && !pv.live) {
        // Exactly the pieces shown (the same generator, the same seed).
        cellSet = pv.set;
        c.params.kalSet = pv.set;
        coverWith(pv.set);
        cell.reset(pv.set, seeded(pv.seed));
        quiet = 0;
        closePreview();
      }
    };
    /** The preview without WebGL2: the pieces as flat shapes on the light table. */
    const drawPreviewFlat = (g: CanvasRenderingContext2D, pv: NonNullable<typeof preview>) => {
      const { area, k } = pv;
      const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
      const bg = g.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(area.w, area.h) / 2);
      bg.addColorStop(0, lightCenter);
      bg.addColorStop(1, lightEdge);
      g.fillStyle = bg;
      g.fillRect(area.x, area.y, area.w, area.h);
      for (const b of pv.bodies) {
        const x = cx + b.x * k, y = cy + b.y * k;
        g.beginPath();
        if (b.kind === 0 || b.kind === 3) {
          for (let i = 0; i < b.poly.length; i += 2) g.lineTo(x + b.poly[i] * k, y + b.poly[i + 1] * k);
          g.closePath();
          g.fillStyle = rgbStr(b.col, b.kind === 3 || b.pearl ? 1 : b.rough > 0.4 ? 0.6 : b.alpha);
          g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.25)';
          g.lineWidth = 1;
          g.stroke();
        } else if (b.kind === 1) {
          g.arc(x, y, b.a * k, 0, Math.PI * 2);
          g.fillStyle = rgbStr(b.col, b.pearl ? 1 : 0.8);
          g.fill();
        } else {
          g.moveTo(x - b.a * k, y);
          g.lineTo(x + b.a * k, y);
          g.strokeStyle = rgbStr(b.col, 0.9);
          g.lineWidth = b.t * 2 * k;
          g.lineCap = 'round';
          g.stroke();
        }
      }
    };

    return {
      isControlPoint: (x, y) => !!preview || setMenu || panelOpen || !!buttonAt(x, y) || inRect(x, y, pill) || inRect(x, y, lens),
      update(dt, _t, pIn) {
        const p = orbit.update(pIn);
        const sdt = Math.min(dt, 1 / 30);
        clock += sdt;
        if (autoTurn) angle += sdt * 0.12 * clamp(c.params.speed, 0, 4);
        // The lamp: up left, moved by the cursor (kalLightFollow of the whole screen's swing).
        const follow = c.params.kalLightCursor ? clamp(c.params.kalLightFollow, 0, 2) * 1.6 : 0;
        const tlx = LX + (p.active ? (p.x / W - 0.5) * follow : 0);
        const tly = LY + (p.active ? (p.y / H - 0.5) * follow : 0);
        lx += (tlx - lx) * Math.min(1, sdt * 3);
        ly += (tly - ly) * Math.min(1, sdt * 3);
        if (dragKey && p.pressed) setFromX(dragKey, p.rawX);
        if (!p.pressed) dragKey = null;
        hover = p.active ? buttonAt(p.rawX, p.rawY) : null;
        menuHover = setMenu && p.active ? menuItemAt(p.rawX, p.rawY) : -1;
        topHover = p.active && !preview && !setMenu ? (inRect(p.rawX, p.rawY, pill) ? 'Набор стёклышек' : inRect(p.rawX, p.rawY, lens) ? 'Посмотреть стёклышки набора' : '') : '';
        if (c.params.kalShowSet !== showSeen) {
          showSeen = c.params.kalShowSet;
          setMenu = false;
          panelOpen = false;
          openPreview(setOf());
        }
        // Another set asked for (the list, the preview or the tuning panel): new pieces poured in.
        if (setOf() !== cellSet) {
          cellSet = setOf();
          coverWith(cellSet);
          cell.reset(cellSet);
          quiet = 0;
        }
        // The scale: laid out again once it rests.
        if (scaleNow() !== scaleSeen) {
          scaleSeen = scaleNow();
          scaleWait = 0.3;
        }
        scaleWait = Math.max(0, scaleWait - sdt);
        if (scaleWait === 0 && scaleSeen !== laidScale && dragKey !== 'kalScale' && dragKey !== 'kalScaleMobile') {
          grab = null;
          layout();
          lastSig = '';
          refined = 0;
        }
        // The spread: tossed once it has rested (more even: tossed up so the pieces can land all over; less: they just
        // wake and slide down).
        if (c.params.kalSpread !== spreadSeen) {
          spreadSeen = c.params.kalSpread;
          spreadWait = 0.35;
        }
        spreadWait = Math.max(0, spreadWait - sdt);
        if (spreadWait === 0 && spreadSeen !== spreadApplied && dragKey !== 'kalSpread') {
          if (spreadSeen > spreadApplied + 0.02) cell.toss(0.8);
          else cell.wakeAll();
          spreadApplied = spreadSeen;
          quiet = 0;
        }
        const tilt = tiltFor(c.params.kalSpread);
        cell.tilt = tilt;
        if (p.clicked && preview) previewClick(p.rawX, p.rawY);
        else if (p.clicked && setMenu) {
          const item = menuItemAt(p.rawX, p.rawY);
          if (item === PIECE_SETS.length) openPreview(setOf());
          else if (item >= 0) c.params.kalSet = item;
          setMenu = false;
        } else if (p.clicked && inRect(p.rawX, p.rawY, pill)) {
          setMenu = true;
          panelOpen = false;
        } else if (p.clicked && inRect(p.rawX, p.rawY, lens)) {
          openPreview(setOf());
          panelOpen = false;
        } else if (p.clicked) {
          const bt = buttonAt(p.rawX, p.rawY);
          const row = panelRow(p.rawX, p.rawY);
          if (bt) {
            if (bt.id === 'turn') autoTurn = !autoTurn;
            else if (bt.id === 'settings') panelOpen = !panelOpen;
            else if (bt.id === 'oil') {
              cell.oil = !cell.oil;
              quiet = 0;
            }
            else if (bt.id === 'shake') {
              kick = 0.6;
              cell.toss(c.params.kalToss);
            } else {
              cell.reset();
              quiet = 0;
            }
          } else if (row >= 0) {
            const item = panelRows()[row];
            if (item.kind === 'tabs') {
              const chip = tabChips.find((q) => p.rawX >= q.x && p.rawX <= q.x + q.w);
              if (chip) panelTab = chip.id;
            } else if (item.kind === 'switch') item.toggle();
            else if (item.kind === 'slider') {
              dragKey = item.st.key;
              setFromX(dragKey, p.rawX);
            } else if (item.kind === 'strip') {
              // A patch of the calibration strip: the monitor's limit is that patch's brightness.
              const r = stripRect();
              if (r && hdrOn() && p.rawX >= r.x && p.rawX < r.x + r.w) c.params.kalHdrPeak = STRIP_VALUES[clamp(Math.floor(((p.rawX - r.x) / r.w) * 10), 0, 9)];
            } else if (item.kind === 'presets') {
              const chip = presetChips.find((q) => p.rawX >= q.x && p.rawX <= q.x + q.w);
              if (chip) {
                // The preset, with the set's own look over it; leaving the set restores the preset's values.
                const values = presetValues(chip.index);
                const look = PIECE_SETS[setOf()].look ?? {};
                Object.assign(c.params, values, look);
                covered = Object.fromEntries(Object.keys(look).map((key) => [key, values[key as keyof KaleidoscopeLook]]));
              }
            }
          } else if (row === -2 && c.params.react > 0) {
            const [cx, cy] = hexAt(p.rawX, p.rawY);
            grab = { cx, cy, sx: p.rawX, sy: p.rawY, ox: grab?.ox ?? 0, oy: grab?.oy ?? 0, vx: grab?.vx ?? 0, vy: grab?.vy ?? 0, held: true };
            hint = 0;
          }
        }
        if (grab && grab.held && !p.pressed) {
          // Let go: the drum is tossed as hard as the eyepiece was pulled out and flung.
          grab.held = false;
          const lim = R * 0.45;
          const yank = clamp(Math.hypot(grab.ox, grab.oy) / lim + Math.hypot(grab.vx, grab.vy) / (lim * 30), 0, 1.5);
          cell.toss(yank * c.params.kalToss);
        }
        // The grabbed eyepiece on a spring towards the pointer (softly limited), back home when let go.
        let accX = 0;
        let accY = 0;
        if (grab) {
          let tx = 0;
          let ty = 0;
          if (grab.held) {
            const dx = p.rawX - grab.sx, dy = p.rawY - grab.sy;
            const d = Math.hypot(dx, dy);
            const lim = R * 0.45;
            const s = d > 1e-6 ? (lim * Math.tanh(d / lim)) / d : 0;
            tx = dx * s;
            ty = dy * s;
          }
          const K = 900;
          const C = 2 * Math.sqrt(K) * 0.22;
          const n = 4;
          const h = sdt / n;
          const v0x = grab.vx, v0y = grab.vy;
          for (let i = 0; i < n; i += 1) {
            grab.vx += (K * (tx - grab.ox) - C * grab.vx) * h;
            grab.vy += (K * (ty - grab.oy) - C * grab.vy) * h;
            grab.ox += grab.vx * h;
            grab.oy += grab.vy * h;
          }
          accX = (grab.vx - v0x) / Math.max(sdt, 1e-3);
          accY = (grab.vy - v0y) / Math.max(sdt, 1e-3);
          if (!grab.held && Math.hypot(grab.ox, grab.oy) < 0.3 && Math.hypot(grab.vx, grab.vy) < 5) grab = null;
        }
        if (kick > 0) {
          // "Встряхнуть": a few seconds of hand shaking, up and down.
          kick -= sdt;
          accY += Math.sin(clock * 38) * 5200 * pxPerMm;
          accX += Math.cos(clock * 23) * 1800 * pxPerMm;
        }
        // px/s² of the eyepiece → mm/s² of the drum; the pieces feel gravity minus that, in the drum's (turned) frame.
        const gain = TIME_SCALE * TIME_SCALE * SHAKE_GAIN;
        shakeAx += (clamp((accX / pxPerMm) * gain, -8 * G, 8 * G) - shakeAx) * 0.6;
        shakeAy += (clamp((accY / pxPerMm) * gain, -8 * G, 8 * G) - shakeAy) * 0.6;
        const shake = Math.hypot(shakeAx, shakeAy);
        const vx = -shakeAx;
        const vy = G * Math.cos(tilt) - shakeAy;
        const ca = Math.cos(angle), sa = Math.sin(angle);
        // A hand never shakes quite in the plane: part of it goes along the tube and flips the pieces over.
        const along = shake * 0.35 * Math.sin(clock * 29);
        cell.step(sdt, vx * ca + vy * sa, -vx * sa + vy * ca, G * Math.sin(tilt) + along, shake);
        // Held, shaken or turning: not quiet. From the moment of letting go it counts.
        if (grab?.held || kick > 0 || autoTurn) quiet = 0;
        else quiet += sdt;
        if (c.params.kalFreeze > 0 && quiet >= c.params.kalFreeze) cell.freeze();
        if (hint > 0 && clock > 12) hint = Math.max(0, hint - sdt * 0.5);
      },
      draw(g) {
        // HDR: asked for once the display is in HDR (the presenter goes under this canvas); switched on and off with it.
        if (!hdrAsked && hdrQuery?.matches && g.canvas instanceof HTMLCanvasElement) {
          hdrAsked = true;
          void createHdrPresenter(g.canvas).then((made) => {
            if (disposed) made?.dispose();
            else hdr = made;
            hdrFailed = !made;
          });
        }
        const on = hdrOn();
        if (on !== hdrWas) {
          hdrWas = on;
          lastSig = '';
          refined = 0;
          if (hdr) hdr.visible = on;
        }
        const L = look();
        const sig = cell.bodies.every((b) => b.asleep)
          ? [angle.toFixed(5), orbit.yaw.toFixed(4), orbit.pitch.toFixed(4), orbit.zoom.toFixed(4), lx.toFixed(4), ly.toFixed(4), rays(), L.exposure, L.saturation, L.sparkle, L.glow, L.stars, L.dispersion, L.bevel, L.vignette, c.params.kalHdrPeak, c.params.kalHdrWhite, c.params.kalHdrGlints, c.params.kalHdrSaturation, c.params.kalHdrBloom, c.params.kalHdrSpill].join('|')
          : '';
        const same = !!sig && sig === lastSig;
        if (!same) refined = 0;
        if (!same || (rays() && refined < samples())) {
          const count = refined === 0 ? 1 : Math.min(PER_FRAME, samples() - refined);
          renderTriangle(refined, count);
          if (!on) composeHex();
          refined += count;
        }
        lastSig = sig;
        const lift = grab ? (grab.held ? 1 : clamp(Math.hypot(grab.ox, grab.oy) / (R * 0.1), 0, 1)) : 0;
        const sc = 1 + 0.04 * lift;
        if (on && hdr) {
          // The honeycomb (and a pulled eyepiece with its shadow) on the HDR canvas below; here only the frames.
          g.clearRect(0, 0, W, H);
          hdr.draw({ R, ox, oy, m, triDpr: dpr, vignette: clamp(c.params.kalVignette, 0, 2), grab: grab ? { cx: grab.cx, cy: grab.cy, ox: grab.ox, oy: grab.oy, scale: sc, lift } : null, strip: panelOpen ? stripRect() : null });
        } else {
          g.fillStyle = frameCol;
          g.fillRect(0, 0, W, H);
          for (const [x, y] of centers) {
            if (grab && x === grab.cx && y === grab.cy) continue;
            g.drawImage(hex, x - hcx / dpr, y - hcy / dpr, hex.width / dpr, hex.height / dpr);
          }
        }
        g.save();
        if (on && grab) {
          // The lifted eyepiece is on the canvas below: the other frames must not cross it.
          g.beginPath();
          g.rect(0, 0, W, H);
          const cxL = grab.cx + grab.ox, cyL = grab.cy + grab.oy;
          for (let k2 = 0; k2 < 6; k2 += 1) {
            const a = k2 * SECTOR;
            if (k2 === 0) g.moveTo(cxL + R * sc * Math.cos(a), cyL + R * sc * Math.sin(a));
            else g.lineTo(cxL + R * sc * Math.cos(a), cyL + R * sc * Math.sin(a));
          }
          g.closePath();
          g.clip('evenodd');
        }
        g.strokeStyle = frameCol;
        g.lineWidth = Math.max(1.5, R * 0.022);
        g.stroke(frames);
        g.strokeStyle = 'rgba(255,240,220,0.14)';
        g.lineWidth = 1;
        g.stroke(frames);
        g.restore();
        if (grab) {
          // The hole it was lifted out of, and the eyepiece itself, a little closer and with a shadow (in HDR both are
          // drawn below; only its frame here).
          if (!on) {
            g.fillStyle = '#000';
            g.beginPath();
            hexPath(g, grab.cx, grab.cy, R);
            g.fill();
          }
          g.save();
          g.translate(grab.cx + grab.ox, grab.cy + grab.oy);
          g.scale(sc, sc);
          if (!on) {
            g.shadowColor = 'rgba(0,0,0,0.6)';
            g.shadowBlur = 24 * lift;
            g.shadowOffsetY = 10 * lift;
            g.drawImage(hex, -hcx / dpr, -hcy / dpr, hex.width / dpr, hex.height / dpr);
            g.shadowColor = 'transparent';
          }
          g.strokeStyle = frameCol;
          g.lineWidth = Math.max(1.5, R * 0.022);
          g.beginPath();
          hexPath(g, 0, 0, R);
          g.stroke();
          g.strokeStyle = 'rgba(255,240,220,0.3)';
          g.lineWidth = 1;
          g.stroke();
          g.restore();
        }
        // The set's name and the magnifier.
        g.fillStyle = setMenu ? 'rgba(255,225,160,0.3)' : 'rgba(10,8,16,0.72)';
        g.strokeStyle = setMenu ? '#ffd27a' : 'rgba(255,255,255,0.25)';
        g.lineWidth = 1;
        g.beginPath();
        g.roundRect(pill.x, pill.y, pill.w, pill.h, 7);
        g.fill();
        g.stroke();
        g.font = '13px sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillStyle = '#f6eee0';
        g.fillText(pillText(setOf()), pill.x + 10, pill.y + pill.h / 2 + 1);
        g.fillText('▾', pill.x + pill.w - 17, pill.y + pill.h / 2 + 1);
        g.fillStyle = preview ? 'rgba(255,225,160,0.3)' : 'rgba(10,8,16,0.72)';
        g.strokeStyle = preview ? '#ffd27a' : 'rgba(255,255,255,0.25)';
        g.beginPath();
        g.roundRect(lens.x, lens.y, lens.w, lens.h, 7);
        g.fill();
        g.stroke();
        g.strokeStyle = '#f6eee0';
        g.lineWidth = 1.8;
        g.beginPath();
        g.arc(lens.x + 12, lens.y + 12, 5.5, 0, Math.PI * 2);
        g.moveTo(lens.x + 16, lens.y + 16);
        g.lineTo(lens.x + 21, lens.y + 21);
        g.stroke();
        g.lineWidth = 1;
        if (lensLabel) {
          g.fillStyle = '#f6eee0';
          g.textAlign = 'left';
          g.fillText(LENS_TEXT, lens.x + 30, lens.y + lens.h / 2 + 1);
        }
        // Buttons and their hints.
        for (const b of buttons) {
          const on = (b.id === 'settings' && panelOpen) || (b.id === 'turn' && autoTurn) || (b.id === 'oil' && cell.oil) || (b.id === 'shake' && kick > 0);
          // Pressed: dark with a gold rim and glyph (a light fill vanished on a bright picture).
          g.fillStyle = on ? 'rgba(58,42,14,0.94)' : 'rgba(10,8,16,0.72)';
          g.strokeStyle = on ? '#ffd27a' : 'rgba(255,255,255,0.25)';
          g.lineWidth = on ? 1.5 : 1;
          g.beginPath();
          g.roundRect(b.x, b.y, b.s, b.s, 7);
          g.fill();
          g.stroke();
          g.fillStyle = on ? '#ffd27a' : '#f6eee0';
          g.font = '17px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(b.glyph, b.x + b.s / 2, b.y + b.s / 2 + 1);
        }
        if (panelOpen) {
          const rows = panelRows();
          g.fillStyle = 'rgba(10,8,16,0.86)';
          g.strokeStyle = 'rgba(255,255,255,0.18)';
          g.beginPath();
          g.roundRect(panelX, panelY, PW, rows.length * ROW + 12, 9);
          g.fill();
          g.stroke();
          g.font = '13px sans-serif';
          g.textBaseline = 'middle';
          const chips = <T,>(items: { key: T; label: string; on: boolean }[], x0: number, y: number) => {
            let x = x0;
            return items.map(({ key, label, on }) => {
              const w = g.measureText(label).width + 18;
              g.fillStyle = on ? 'rgba(255,210,122,0.9)' : 'rgba(255,255,255,0.14)';
              g.beginPath();
              g.roundRect(x, y - 10, w, 20, 10);
              g.fill();
              g.textAlign = 'center';
              g.fillStyle = on ? '#1a1206' : '#f6eee0';
              g.fillText(label, x + w / 2, y + 1);
              const chip = { key, x, w };
              x += w + 6;
              return chip;
            });
          };
          rows.forEach((row, i) => {
            const y = panelY + 6 + i * ROW + ROW / 2;
            g.textAlign = 'left';
            g.fillStyle = '#f6eee0';
            if (row.kind === 'tabs') {
              tabChips = chips(KALEIDOSCOPE_TABS.map((tab) => ({ key: tab.id, label: tab.label, on: tab.id === panelTab })), panelX + 12, y).map((q) => ({ id: q.key, x: q.x, w: q.w }));
            } else if (row.kind === 'switch') {
              g.fillText(row.label, panelX + 12, y);
              g.fillStyle = row.on ? 'rgba(255,210,122,0.9)' : 'rgba(255,255,255,0.18)';
              g.beginPath();
              g.roundRect(trackX, y - 8, 34, 16, 8);
              g.fill();
              g.fillStyle = '#fff';
              g.beginPath();
              g.arc(row.on ? trackX + 26 : trackX + 8, y, 6, 0, Math.PI * 2);
              g.fill();
              g.textAlign = 'right';
              g.fillStyle = 'rgba(246,238,224,0.65)';
              g.fillText(row.note, panelX + PW - 12, y);
            } else if (row.kind === 'slider') {
              const st = row.st;
              const v = c.params[st.key];
              g.fillText(st.label, panelX + 12, y);
              const f = clamp((v - st.min) / (st.max - st.min), 0, 1);
              g.fillStyle = 'rgba(255,255,255,0.18)';
              g.fillRect(trackX, y - 2, trackW, 4);
              g.fillStyle = '#ffd27a';
              g.fillRect(trackX, y - 2, trackW * f, 4);
              g.beginPath();
              g.arc(trackX + trackW * f, y, dragKey === st.key ? 7 : 6, 0, Math.PI * 2);
              g.fill();
              g.textAlign = 'right';
              g.fillStyle = 'rgba(246,238,224,0.8)';
              // 0 s: never freeze.
              g.fillText(st.key === 'kalFreeze' && v === 0 ? 'нет' : v.toFixed(st.step < 0.1 ? 2 : 1), panelX + PW - 12, y);
            } else if (row.kind === 'text') {
              g.font = '12px sans-serif';
              g.fillStyle = row.dim ? 'rgba(246,238,224,0.55)' : '#ffd27a';
              g.fillText(row.text, panelX + 12, y, PW - 24);
              g.font = '13px sans-serif';
            } else if (row.kind === 'strip') {
              const r = stripRect();
              if (r && hdrOn()) {
                // The strip itself is on the HDR canvas below: a hole here to show it; its numbers under it.
                g.clearRect(r.x, r.y, r.w, r.h);
                g.font = '10px sans-serif';
                g.textAlign = 'center';
                STRIP_VALUES.forEach((v, n) => {
                  const cx = r.x + ((n + 0.53) / 10) * r.w;
                  const chosen = Math.abs(v - c.params.kalHdrPeak) < 1e-6;
                  g.fillStyle = chosen ? '#ffd27a' : 'rgba(246,238,224,0.75)';
                  g.fillText(`${String(v).replace('.', ',')}×`, cx, r.y + r.h + 6);
                  if (chosen) {
                    g.strokeStyle = '#ffd27a';
                    g.lineWidth = 1.5;
                    g.strokeRect(r.x + (n / 10) * r.w + 1, r.y - 1, r.w / 10 - 1, r.h + 2);
                  }
                });
                g.font = '13px sans-serif';
              }
            } else {
              // The presets as chips; the one the settings match is lit ("свой" when changed by hand).
              g.fillText('Пресет', panelX + 12, y);
              const current = kaleidoscopePresetIndex(c.params, PIECE_SETS[setOf()].look);
              g.font = '13px sans-serif';
              presetChips = chips(KALEIDOSCOPE_PRESETS.map((preset, index) => ({ key: index, label: preset.label, on: index === current })), panelX + 72, y).map((q) => ({ index: q.key, x: q.x, w: q.w }));
              if (current < 0) {
                g.textAlign = 'right';
                g.fillStyle = 'rgba(246,238,224,0.55)';
                g.fillText('свой', panelX + PW - 12, y);
              }
            }
          });
        }
        if (c.params.kalHistogram && !preview) {
          if (histOf !== renders) updateHistogram();
          if (histInfo.has) drawHistogram(g);
        }
        const tip = setMenu || preview ? '' : hover ? hover.label : topHover || (hint > 0 && !panelOpen ? 'Потяните любой шестигранник и отпустите — стёклышки подбросит' : '');
        if (tip) {
          g.font = '13px sans-serif';
          g.textAlign = 'left';
          g.textBaseline = 'middle';
          const tw = g.measureText(tip).width + 16;
          const tx = Math.min(10, W - tw - 6);
          g.globalAlpha = hover ? 1 : Math.min(1, hint);
          g.fillStyle = 'rgba(10,8,16,0.8)';
          g.beginPath();
          const ty = panelOpen ? panelY + panelHeight() + 6 : 46 + TOP;
          g.roundRect(tx, ty, tw, 24, 7);
          g.fill();
          g.fillStyle = '#f6eee0';
          g.fillText(tip, tx + 8, ty + 12);
          g.globalAlpha = 1;
        }
        if (setMenu) {
          g.fillStyle = 'rgba(10,8,16,0.9)';
          g.strokeStyle = 'rgba(255,255,255,0.18)';
          g.beginPath();
          g.roundRect(menu.x, menu.y, menu.w, menu.h, 9);
          g.fill();
          g.stroke();
          const current = setOf();
          g.font = '13px sans-serif';
          g.textBaseline = 'middle';
          PIECE_SETS.forEach((set, i) => {
            const y = menu.y + 4 + i * MENU_ROW;
            if (i === current || i === menuHover) {
              g.fillStyle = i === current ? 'rgba(255,210,122,0.22)' : 'rgba(255,255,255,0.08)';
              g.beginPath();
              g.roundRect(menu.x + 4, y + 1, menu.w - 8, MENU_ROW - 2, 7);
              g.fill();
            }
            swatches[i].forEach((col, j) => {
              g.fillStyle = rgbStr(col);
              g.beginPath();
              g.arc(menu.x + 16 + j * 10, y + MENU_ROW / 2, 4.5, 0, Math.PI * 2);
              g.fill();
            });
            g.textAlign = 'left';
            g.fillStyle = i === current ? '#ffd27a' : '#f6eee0';
            g.fillText(set.label, menu.x + 16 + 7 * 10 + 6, y + 15);
            g.font = '11.5px sans-serif';
            g.fillStyle = 'rgba(246,238,224,0.6)';
            g.fillText(set.idea, menu.x + 16 + 7 * 10 + 6, y + 31, menu.w - 16 - 7 * 10 - 14);
            g.font = '13px sans-serif';
          });
          // The preview row.
          const py = menu.y + 4 + PIECE_SETS.length * MENU_ROW;
          g.strokeStyle = 'rgba(255,255,255,0.12)';
          g.beginPath();
          g.moveTo(menu.x + 10, py + 0.5);
          g.lineTo(menu.x + menu.w - 10, py + 0.5);
          g.stroke();
          if (menuHover === PIECE_SETS.length) {
            g.fillStyle = 'rgba(255,255,255,0.08)';
            g.beginPath();
            g.roundRect(menu.x + 4, py + 1, menu.w - 8, MENU_ROW - 2, 7);
            g.fill();
          }
          g.textAlign = 'left';
          g.fillStyle = '#ffd27a';
          g.fillText('🔍 Посмотреть стёклышки набора', menu.x + 16, py + MENU_ROW / 2 + 1);
        }
        orbit.draw(g);
        if (preview) {
          const pv = preview;
          const { box, area } = pv;
          const b = pvButtons(box);
          const set = PIECE_SETS[pv.set];
          g.fillStyle = 'rgba(0,0,0,0.55)';
          g.fillRect(0, 0, W, H);
          g.fillStyle = 'rgba(14,11,20,0.97)';
          g.strokeStyle = 'rgba(255,255,255,0.2)';
          g.beginPath();
          g.roundRect(box.x, box.y, box.w, box.h, 12);
          g.fill();
          g.stroke();
          const btn = (r: Box, text: string, on = false) => {
            g.fillStyle = on ? 'rgba(255,210,122,0.9)' : 'rgba(255,255,255,0.1)';
            g.beginPath();
            g.roundRect(r.x, r.y, r.w, r.h, 8);
            g.fill();
            g.fillStyle = on ? '#1a1206' : '#f6eee0';
            g.textAlign = 'center';
            g.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 1);
          };
          g.textBaseline = 'middle';
          g.font = '17px sans-serif';
          btn(b.prev, '‹');
          btn(b.next, '›');
          btn(b.close, '✕');
          g.font = '600 16px sans-serif';
          g.textAlign = 'left';
          g.fillStyle = '#f6eee0';
          g.fillText(set.label, box.x + 86, box.y + 26);
          const titleW = g.measureText(set.label).width;
          g.font = '12px sans-serif';
          g.fillStyle = pv.live ? 'rgba(255,210,122,0.85)' : 'rgba(246,238,224,0.55)';
          g.fillText(pv.live ? 'сейчас в калейдоскопе' : `${pv.set + 1} из ${PIECE_SETS.length}`, box.x + 86 + titleW + 12, box.y + 27);
          g.font = 'italic 13px sans-serif';
          g.fillStyle = '#ffd27a';
          g.fillText(set.idea, box.x + 14, box.y + 56);
          g.font = '12.5px sans-serif';
          g.fillStyle = 'rgba(246,238,224,0.82)';
          pv.note.forEach((line, i) => g.fillText(line, box.x + 14, box.y + 76 + i * 17));
          g.font = '12px sans-serif';
          g.fillStyle = 'rgba(246,238,224,0.55)';
          pv.counts.forEach((line, i) => g.fillText(line, box.x + 14, box.y + 78 + pv.note.length * 17 + i * 16));
          if (pv.tracer) {
            if (pv.sample < samples()) {
              const count = pv.sample === 0 ? 1 : Math.min(PER_FRAME, samples() - pv.sample);
              // Lit as the window is (the lamp up left), on a light table as wide as the pieces lie; a little darker, so
              // clear and pale glass shows on it (in the window the pieces overlap, here each lies on the bare light).
              const az = Math.atan2(LY, LX), tl = Math.atan(Math.hypot(LX, LY));
              const light: [number, number, number] = [Math.cos(az) * Math.sin(tl), Math.sin(az) * Math.sin(tl), Math.cos(tl)];
              pv.tracer.render(pv.bodies, 0, area.w / 2, area.h / 2, pv.k, dpr, light, [0, 0], (Math.hypot(area.w, area.h) / 2 / pv.k) * 1.08, 4, 1e5, { ...look(), exposure: look().exposure * 0.7 }, pv.sample, count);
              pv.sample += count;
            }
            g.drawImage(pv.tracer.canvas, area.x, area.y, area.w, area.h);
          } else drawPreviewFlat(g, pv);
          g.strokeStyle = 'rgba(255,255,255,0.14)';
          g.strokeRect(area.x + 0.5, area.y + 0.5, area.w - 1, area.h - 1);
          g.font = '13px sans-serif';
          btn(b.regen, b.regenText);
          if (!pv.live) btn(b.choose, CHOOSE, true);
          else {
            g.textAlign = 'right';
            g.fillStyle = 'rgba(255,210,122,0.85)';
            g.fillText('Эти стёклышки сейчас в калейдоскопе', b.choose.x + b.choose.w, b.choose.y + 15);
          }
        }
      },
      dispose() {
        disposed = true;
        orbit.dispose();
        hdr?.dispose();
        closePreview();
        glass?.dispose();
      },
    };
  },
};
