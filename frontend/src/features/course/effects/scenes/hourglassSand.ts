/**
 * The sand of the ray-traced hourglass (hourglass3d.ts), without DOM or WebGL so it can be checked in node.
 *
 * Units: the glass is 2 tall (the neck at y = 0, the bulbs' ends at y = ±1), so 1 unit ≈ 7.5 cm of a real 15 cm glass.
 * The glass is IQ's "round cone" mirrored at a rounded waist: a small sphere at the neck, a big one at `h`, joined by their
 * tangent cone; the hollow inside is the same shape `t` thinner. The shader (hourglassGL.ts) uses the same numbers.
 *
 * What makes the sand behave like sand, not a liquid:
 * - It runs at a constant rate however much is left above (Beverloo's law: the flow through an orifice depends on the
 *   orifice, not on the height of the grains above it, because the walls carry their weight). One run takes `runTime`.
 * - Its free surfaces stand at the angle of repose (34°, dry quartz sand): above, a funnel that sinks into the flat
 *   surface once sand starts to leave until the whole surface is one cone from the wall to the middle; below, a cone
 *   growing on whatever was already there.
 * - The volume is conserved: the upper bulb's loss is the lower bulb's gain, both solved from the bulbs' real profile.
 * - The stream leaves the neck at about √(g·D) and falls freely, so it speeds up and gets thinner (the same flow through a
 *   faster stream: radius ∝ 1/√v); a new stream's front and a finished stream's tail fall the same way.
 * - Turned over, the sand stays where it was in the glass until the turn is done, then slides down as one mass.
 */

export const GLASS = {
  /** Radius of the small sphere at the neck (outer); the neck itself is a little wider, see `round`. */
  r1: 0.033,
  /** Radius of a bulb (outer). */
  r2: 0.4,
  /** Height of the bulb's centre above the neck. */
  h: 0.6,
  /** Wall thickness. */
  t: 0.016,
  /** The two halves meet in a rounded waist, not a crease: the shape uses √(y² + round²) instead of |y|. */
  round: 0.025,
};
/** Angle of repose of dry sand, as the slope tan(34°). */
export const REPOSE = Math.tan((34 * Math.PI) / 180);
/** Top of the hollow above the neck. */
export const HOLLOW_TOP = Math.sqrt((GLASS.h + GLASS.r2 - GLASS.t) ** 2 - GLASS.round ** 2);
/** Gravity, units/s² (9.81 m/s² on a 7.5 cm unit), and the stream's speed as it leaves the neck. */
export const GRAVITY = 131;
/** How fast a mass of sand slides down the glass after the glass is turned over (friction on the walls), units/s². */
const SLIDE = 16;
/** How fast the funnel sinks into a flat surface once the sand starts to run, units/s. */
const FUNNEL = 0.45;
/** How long a turn takes, s, and how long a finished glass waits before it turns over by itself. */
export const FLIP_TIME = 1.25;
const REST_TIME = 1.4;

/** Signed distance to IQ's round cone in (r, y): a circle r1 at the origin, r2 at (0, h), and their tangent. */
export function roundCone2(r: number, y: number, r1: number, r2: number, h: number): number {
  const b = (r1 - r2) / h;
  const a = Math.sqrt(1 - b * b);
  const k = -b * r + a * y;
  if (k < 0) return Math.hypot(r, y) - r1;
  if (k > a * h) return Math.hypot(r, y - h) - r2;
  return a * r + b * y - r1;
}

/** Signed distance to the hollow in (r, y): negative inside. */
export const hollow2 = (r: number, y: number) =>
  roundCone2(r, Math.sqrt(y * y + GLASS.round * GLASS.round), GLASS.r1 - GLASS.t, GLASS.r2 - GLASS.t, GLASS.h);

const N = 360;
const DY = HOLLOW_TOP / N;
/** Radius of the hollow at height |y| = (i + 0.5)·DY. */
const RADIUS = Float64Array.from({ length: N }, (_, i) => {
  const y = (i + 0.5) * DY;
  let lo = 0;
  let hi = GLASS.r2;
  if (hollow2(0, y) >= 0) return 0;
  for (let k = 0; k < 40; k += 1) {
    const mid = (lo + hi) / 2;
    if (hollow2(mid, y) < 0) lo = mid;
    else hi = mid;
  }
  return lo;
});
export const hollowRadius = (y: number) => RADIUS[Math.min(N - 1, Math.max(0, Math.floor(Math.abs(y) / DY)))];
/** Radius of the hollow at the neck: the orifice the sand runs through. */
export const ORIFICE = (() => {
  let lo = 0;
  let hi = GLASS.r2;
  for (let k = 0; k < 40; k += 1) {
    const mid = (lo + hi) / 2;
    if (hollow2(mid, 0) < 0) lo = mid;
    else hi = mid;
  }
  return lo;
})();
export const STREAM_V0 = Math.sqrt(GRAVITY * ORIFICE * 2);

/** Volume of one bulb's hollow. */
export const BULB_VOLUME = RADIUS.reduce((sum, r) => sum + Math.PI * r * r * DY, 0);

/** Sand in the upper bulb: everything below min(L, c + r·tan θ) — a flat surface at L with a funnel whose tip is at c. */
export function upperVolume(L: number, c: number): number {
  let v = 0;
  for (let i = 0; i < N; i += 1) {
    const share = Math.min(1, Math.max(0, L / DY - i));
    if (share <= 0) break;
    const y = (i + 0.5) * DY;
    const r = RADIUS[i];
    const hole = Math.min(r, Math.max(0, (y - c) / REPOSE));
    v += Math.PI * (r * r - hole * hole) * DY * share;
  }
  return v;
}

/** Sand in the lower bulb (y < 0): a flat bed up to `bed` plus a cone with its tip at `apex`. */
export function lowerVolume(bed: number, apex: number): number {
  let v = 0;
  for (let i = 0; i < N; i += 1) {
    const y = -(i + 0.5) * DY;
    const r = RADIUS[i];
    // The share of this slice (from -(i+1)·DY up to -i·DY) under the bed.
    const share = Math.min(1, Math.max(0, (bed + (i + 1) * DY) / DY));
    const cone = Math.min(r, Math.max(0, (apex - y) / REPOSE));
    v += Math.PI * (r * r * share + cone * cone * (1 - share)) * DY;
  }
  return v;
}

function bisect(f: (x: number) => number, target: number, lo: number, hi: number): number {
  if (f(hi) <= target) return hi;
  if (f(lo) >= target) return lo;
  for (let k = 0; k < 36; k += 1) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The flat level holding `volume` in the upper bulb with the funnel's tip at `c` (c ≤ L). */
export const solveUpper = (volume: number, c: number) => bisect((L) => upperVolume(L, Math.min(c, L)), volume, 0, HOLLOW_TOP);
/** The lowest the funnel's tip can be with `volume` above: the whole surface one cone from the wall at L to the middle. */
export function lowestFunnel(volume: number): number {
  const tip = (L: number) => Math.max(0, L - hollowRadius(L) * REPOSE);
  const L = bisect((l) => upperVolume(l, Math.min(tip(l), l)), volume, 0, HOLLOW_TOP);
  return Math.min(tip(L), L);
}
/** The level of a flat bed of `volume` in the lower bulb. */
export const solveBed = (volume: number) => bisect((b) => lowerVolume(b, b), volume, -HOLLOW_TOP, 0);
/** The cone's tip once `volume` in all rests on a bed at `bed`. */
export const solvePile = (volume: number, bed: number) => bisect((a) => lowerVolume(bed, a), volume, bed, GLASS.r2 * REPOSE);

/** What the renderer needs, in the sand's frame (its +y is the bulb that is up once the current turn is done). */
export type SandView = {
  /** Upper bulb: flat level, funnel tip, and how far the whole mass still hangs above its resting place. */
  level: number;
  funnel: number;
  upperDrop: number;
  /** Lower bulb: bed level, cone tip, and how far above its resting place the fallen bed still is. */
  bed: number;
  apex: number;
  lowerDrop: number;
  /** The stream, as distances below the neck: its tail (0 while running), its front, and where it lands. */
  tail: number;
  head: number;
  land: number;
  streaming: boolean;
  /** The turn: 0 → π while turning over, and which way up the sand's frame is relative to the glass (±1). */
  turn: number;
  parity: number;
};

export function createSand(fill = 0.56) {
  const total = BULB_VOLUME * fill;
  let upper = total;
  let bedVolume = 0;
  let pileVolume = 0;
  let funnel = solveUpper(total, HOLLOW_TOP);
  let upperDrop = 0;
  let upperFall = 0;
  let lowerDrop = 0;
  let lowerFall = 0;
  let bed = solveBed(0);
  let running = false;
  let runFor = 0;
  let stoppedFor = -1;
  let rest = 0;
  let turning = -1;
  let parity = 1;
  const fallen = (s: number) => STREAM_V0 * s + 0.5 * GRAVITY * s * s;
  const view: SandView = {
    level: 0, funnel: 0, upperDrop: 0, bed: 0, apex: 0, lowerDrop: 0, tail: 0, head: 0, land: 0, streaming: false, turn: 0, parity: 1,
  };

  const turnOver = () => {
    if (turning >= 0) return;
    turning = 0;
    running = false;
    stoppedFor = -1;
  };

  /** Advances by `dt` seconds; one full run takes `runTime` seconds. */
  const step = (dt: number, runTime: number) => {
    if (turning >= 0) {
      turning += dt;
      if (turning >= FLIP_TIME) {
        // Done: what was below is now above and slides down onto the neck; what was above falls to the bottom as a bed.
        turning = -1;
        parity = -parity;
        const below = bedVolume + pileVolume;
        bedVolume = upper;
        pileVolume = 0;
        upper = below;
        const level = solveUpper(upper, HOLLOW_TOP);
        funnel = level;
        upperDrop = Math.max(0, HOLLOW_TOP - level);
        upperFall = 0;
        bed = solveBed(bedVolume);
        lowerDrop = Math.max(0, -bed - (HOLLOW_TOP + bed) * 0.1);
        lowerFall = 0;
        rest = 0;
      }
    } else {
      if (upperDrop > 0) {
        upperFall += SLIDE * dt;
        upperDrop = Math.max(0, upperDrop - upperFall * dt);
      }
      if (lowerDrop > 0) {
        lowerFall += SLIDE * dt;
        lowerDrop = Math.max(0, lowerDrop - lowerFall * dt);
      }
      const canRun = upperDrop === 0 && upper > total * 1e-4;
      if (canRun && !running) {
        running = true;
        runFor = 0;
        stoppedFor = -1;
      }
      if (running) {
        runFor += dt;
        const flow = Math.min(upper, (total / runTime) * dt);
        upper -= flow;
        pileVolume += flow;
        // The funnel sinks into the flat surface once grains leave from under it, until the whole surface is one cone
        // at the angle of repose, from the wall down to the middle (funnel flow).
        funnel = Math.max(lowestFunnel(upper), funnel - FUNNEL * dt);
        if (upper <= total * 1e-4) {
          pileVolume += upper;
          upper = 0;
          running = false;
          stoppedFor = 0;
        }
      } else if (stoppedFor >= 0) {
        stoppedFor += dt;
      }
      const landed = stoppedFor >= 0 && fallen(stoppedFor) > HOLLOW_TOP;
      if (upper === 0 && (landed || stoppedFor < 0)) {
        rest += dt;
        if (rest > REST_TIME) turnOver();
      }
    }
    const level = upper > 0 ? solveUpper(upper, funnel) : 0;
    const apex = solvePile(bedVolume + pileVolume, bed);
    view.level = level;
    view.funnel = Math.min(funnel, level);
    view.upperDrop = upperDrop;
    view.bed = bed;
    view.apex = apex;
    view.lowerDrop = lowerDrop;
    view.land = -Math.max(bed, apex);
    view.streaming = turning < 0 && (running || (stoppedFor >= 0 && fallen(stoppedFor) < view.land));
    view.head = running ? fallen(runFor) : HOLLOW_TOP * 2;
    view.tail = running ? 0 : stoppedFor >= 0 ? fallen(stoppedFor) : HOLLOW_TOP * 2;
    view.turn = turning >= 0 ? Math.PI * smooth(turning / FLIP_TIME) : 0;
    view.parity = parity;
    return view;
  };

  return {
    step,
    turnOver,
    get turning() {
      return turning >= 0;
    },
    /** Volumes, for the checks. */
    get volumes() {
      return { total, upper, lower: bedVolume + pileVolume };
    },
  };
}

function smooth(x: number) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}
