/** A conservative lattice model: each lit LED is exactly one sand grain. */
export type Led = { x: number; y: number };
export type PixelSand = {
  cells: Uint8Array;
  motionTime: number;
  throatCooldown: number;
  transfers: number;
  tick: number;
};

const SIDE = 8;
const MATRIX_SIZE = SIDE * SIDE;
const MOTION_INTERVAL = 1 / 14;
const DRIP_INTERVAL = 0.31;
const NEIGHBOR_STEPS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0], [0, -1], [0, 1], [1, 0],
];

// Two 8x8 diamond matrices. The lower matrix is slightly smaller, like the photographed object.
export const LEDS: Led[] = Array.from({ length: MATRIX_SIZE * 2 }, (_, index) => {
  const bottom = index >= MATRIX_SIZE;
  const local = index % MATRIX_SIZE;
  const u = Math.floor(local / SIDE);
  const v = local % SIDE;
  const step = bottom ? 0.071 : 0.08;
  return { x: (u - v) * step, y: (u + v - (SIDE - 1)) * step + (bottom ? 0.61 : -0.56) };
});

const NEIGHBORS: number[][] = LEDS.map((_, index) => {
  const chamber = Math.floor(index / MATRIX_SIZE);
  const local = index % MATRIX_SIZE;
  const u = Math.floor(local / SIDE);
  const v = local % SIDE;
  return NEIGHBOR_STEPS.flatMap(([du, dv]) => {
    const nextU = u + du;
    const nextV = v + dv;
    return nextU >= 0 && nextU < SIDE && nextV >= 0 && nextV < SIDE
      ? [chamber * MATRIX_SIZE + nextU * SIDE + nextV] : [];
  });
});

function scatter(a: number, b: number, tick: number) {
  let value = Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca77) ^ Math.imul(tick + 1, 0xc2b2ae3d);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) / 0xffffffff;
}

/** The photographed starting piles contain 36 upper and 28 lower pixels. */
export function createPixelSand(): PixelSand {
  const cells = new Uint8Array(LEDS.length);
  LEDS.forEach((led, index) => {
    cells[index] = Number(index < MATRIX_SIZE ? led.y >= -0.56 : led.y > 0.61);
  });
  return { cells, motionTime: 0, throatCooldown: 0, transfers: 0, tick: 0 };
}

function moveWithinChambers(sand: PixelSand, gx: number, gy: number) {
  const before = sand.cells;
  const after = before.slice();
  const order = Array.from(before.keys()).filter((index) => before[index]);
  // The leading grains move first. A changing tie-breaker avoids a fixed left/right bias.
  order.sort((a, b) => {
    const da = LEDS[a].x * gx + LEDS[a].y * gy;
    const db = LEDS[b].x * gx + LEDS[b].y * gy;
    return db - da || scatter(a, 0, sand.tick) - scatter(b, 0, sand.tick);
  });

  for (const source of order) {
    let destination = -1;
    let bestScore = 0.18;
    for (const candidate of NEIGHBORS[source]) {
      // Test the previous frame as well as reservations in this frame. This
      // prevents two grains claiming one LED or cascading multiple cells at once.
      if (before[candidate] || after[candidate]) continue;
      const dx = LEDS[candidate].x - LEDS[source].x;
      const dy = LEDS[candidate].y - LEDS[source].y;
      const score = (dx * gx + dy * gy) / Math.hypot(dx, dy)
        + (scatter(source, candidate, sand.tick) - 0.5) * 0.08;
      if (score > bestScore) {
        destination = candidate;
        bestScore = score;
      }
    }
    if (destination >= 0) {
      after[source] = 0;
      after[destination] = 1;
    }
  }
  sand.cells = after;
  sand.tick += 1;
}

/** One adjacent-cell move per grain, and at most one neck crossing per interval. */
export function stepPixelSand(sand: PixelSand, gx: number, gy: number, dt: number) {
  sand.motionTime += dt;
  sand.throatCooldown = Math.max(0, sand.throatCooldown - dt);
  while (sand.motionTime >= MOTION_INTERVAL) {
    sand.motionTime -= MOTION_INTERVAL;
    moveWithinChambers(sand, gx, gy);
  }

  if (sand.throatCooldown > 0) return;
  // These are the two tip LEDs (both at x=0), separated only by the waist.
  const source = gy > 0.18 ? MATRIX_SIZE - 1 : gy < -0.18 ? MATRIX_SIZE : -1;
  const destination = gy > 0.18 ? MATRIX_SIZE : gy < -0.18 ? MATRIX_SIZE - 1 : -1;
  if (source >= 0 && sand.cells[source] && !sand.cells[destination]) {
    sand.cells[source] = 0;
    sand.cells[destination] = 1;
    sand.throatCooldown = DRIP_INTERVAL;
    sand.transfers += 1;
  }
}
