// Model coordinates are independent of display resolution. Each colour has its own depth channel.
export type TimerRamp = { x: number; y: number; endX: number; endY: number; lane: number };
export type TimerDrop = { x: number; y: number; vx: number; vy: number; volume: number; lane: number; contact: number; departed: number; wobble: number };
export const TIMER_VOLUME = 44;
// Equal visual chamber depth: a unit occupies the same projected area upstairs and downstairs.
export const TIMER_POOL_SCALE = 232 * 28 / (112 * TIMER_VOLUME);
export const TIMER_STEP = 1 / 120;
export const timerRadius = (volume: number) => 6.2 * Math.cbrt(volume);
export const TIMER_RAMPS: TimerRamp[] = [];
for (let lane = 0; lane < 2; lane++) {
  for (let run = 0; run < 3; run++) {
    const dir = (run + lane) % 2 === 0 ? 1 : -1;
    for (let step = 0; step < 6; step++) {
      const x = (dir > 0 ? 95 : 305) + dir * step * 35;
      const y = 205 + run * 100 + step * 13 + lane * 5;
      TIMER_RAMPS.push({ x, y, endX: x + dir * 33, endY: y + 6, lane });
    }
  }
}

export function createLiquidTimer(random: () => number) {
  const drops: TimerDrop[] = [];
  const remaining = [TIMER_VOLUME, TIMER_VOLUME];
  const collected = [0, 0];
  const nozzle = [0, 0];
  const threshold = [1, 1.07];
  let accumulator = 0;
  let time = 0;
  const reset = () => {
    drops.length = 0;
    remaining.fill(TIMER_VOLUME); collected.fill(0); nozzle.fill(0);
    accumulator = 0; time = 0;
  };
  function tick(dt: number) {
    time += dt;
    for (let lane = 0; lane < 2; lane++) {
      // The forming pendant is part of the conserved liquid, not a decorative extra particle.
      const amount = Math.min(remaining[lane], dt * (lane ? 0.55 : 0.59));
      if (drops.length < 96) { nozzle[lane] += amount; remaining[lane] -= amount; }
      if (nozzle[lane] >= threshold[lane] || (remaining[lane] === 0 && nozzle[lane] > 0)) {
        drops.push({ x: lane ? 300 : 100, y: 177, vx: 0, vy: 2, volume: nozzle[lane], lane, contact: -1, departed: -1, wobble: 0.2 });
        nozzle[lane] = 0;
        threshold[lane] = 0.85 + random() * 0.3;
      }
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      const radius = timerRadius(d.volume);
      const oldX = d.x, oldY = d.y;
      d.wobble *= Math.exp(-dt * 5);
      if (d.contact >= 0) {
        const ramp = TIMER_RAMPS[d.contact];
        const dx = ramp.endX - ramp.x, dy = ramp.endY - ramp.y;
        const length = Math.hypot(dx, dy), tx = dx / length, ty = dy / length;
        let speed = d.vx * tx + d.vy * ty;
        speed = (speed + 125 * ty * dt) * Math.exp(-dt * 1.4);
        d.vx = tx * speed; d.vy = ty * speed;
        d.x += d.vx * dt; d.y += d.vy * dt;
        const along = (d.x - ramp.x) * tx + (d.y + radius * 0.7 - ramp.y) * ty;
        if (along > length + radius * 0.25 || along < -radius) { d.departed = d.contact; d.contact = -1; d.wobble = 0.55; }
      } else {
        d.vy = (d.vy + 125 * dt) * Math.exp(-dt * 2.2);
        d.vx *= Math.exp(-dt * 1.5);
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.y < 170 + radius) { d.y = 170 + radius; d.vy = Math.abs(d.vy) * .25; }
        // Sealed channel sidewalls redirect drops at the two staircase hairpins.
        const left = 89 + radius, right = 311 - radius;
        if (d.x < left) { d.x = left; d.vx = Math.abs(d.vx) * 0.22; }
        if (d.x > right) { d.x = right; d.vx = -Math.abs(d.vx) * 0.22; }
        // Swept contact: catch the crossing, including at low display frame rates.
        for (let k = 0; k < TIMER_RAMPS.length; k++) {
          const r = TIMER_RAMPS[k];
          if (r.lane !== d.lane || k <= d.departed || d.x < Math.min(r.x, r.endX) - radius * 0.75 || d.x > Math.max(r.x, r.endX) + radius * 0.75) continue;
          const slope = (r.endY - r.y) / (r.endX - r.x);
          const surface = r.y + (d.x - r.x) * slope;
          const oldSurface = r.y + (oldX - r.x) * slope;
          if (oldY + radius * 0.7 <= oldSurface && d.y + radius * 0.7 >= surface && d.vy > 0) {
            d.y = surface - radius * 0.7; d.contact = k; d.wobble = 1;
            const sign = Math.sign(r.endX - r.x);
            d.vx = sign * Math.max(4, Math.abs(d.vx) * 0.4); d.vy = d.vx * slope;
            break;
          }
        }
      }
      if (d.y >= 546 - collected[d.lane] * TIMER_POOL_SCALE - radius * 0.65) {
        collected[d.lane] += d.volume; drops.splice(i, 1);
      }
    }
    // Same-channel coalescence only. Opposite colours cross at separate depths in the sealed toy.
    // At most 96 drops; spatial buckets keep neighbour work local rather than comparing every pair.
    const buckets = new Map<string, TimerDrop[]>();
    const removed = new Set<TimerDrop>();
    for (const d of drops) {
      const bx = Math.floor(d.x / 32), by = Math.floor(d.y / 32);
      let merged = false;
      for (let oy = -1; oy <= 1 && !merged; oy++) for (let ox = -1; ox <= 1 && !merged; ox++) {
        for (const other of buckets.get(`${d.lane}:${bx + ox}:${by + oy}`) ?? []) {
          if (Math.hypot(d.x - other.x, d.y - other.y) > (timerRadius(d.volume) + timerRadius(other.volume)) * 0.7) continue;
          const total = d.volume + other.volume;
          other.x = (other.x * other.volume + d.x * d.volume) / total;
          other.y = (other.y * other.volume + d.y * d.volume) / total;
          other.vx = (other.vx * other.volume + d.vx * d.volume) / total;
          other.vy = (other.vy * other.volume + d.vy * d.volume) / total;
          other.volume = total; other.wobble = 0.8;
          if (other.contact !== d.contact) { other.contact = -1; other.departed = Math.min(other.departed, d.departed); }
          removed.add(d); merged = true; break;
        }
      }
      if (!merged) {
        const key = `${d.lane}:${bx}:${by}`;
        const bucket = buckets.get(key) ?? []; bucket.push(d); buckets.set(key, bucket);
      }
    }
    for (let i = drops.length - 1; i >= 0; i--) if (removed.has(drops[i])) drops.splice(i, 1);
  }
  return {
    drops, remaining, collected, nozzle,
    get time() { return time; },
    reset,
    /** Swept cursor stirs existing liquid only. Holding attracts; a moving cursor transfers momentum. */
    stir(x0: number, y0: number, x: number, y: number, pressed: boolean, dt: number, strength = 1) {
      if (!Number.isFinite(x0 + y0 + x + y + dt + strength) || dt <= 0 || strength <= 0) return;
      if (x < 75 || x > 325 || y < 170 || y > 545) return;
      const dx = x - x0, dy = y - y0, length2 = dx * dx + dy * dy;
      const vx = Math.max(-500, Math.min(500, dx / dt)), vy = Math.max(-500, Math.min(500, dy / dt));
      const step = Math.min(.05, dt), power = Math.min(2, strength);
      for (const d of drops) {
        const t = length2 ? Math.max(0, Math.min(1, ((d.x - x0) * dx + (d.y - y0) * dy) / length2)) : 1;
        const distance = Math.hypot(d.x - x0 - dx * t, d.y - y0 - dy * t);
        const weight = Math.max(0, 1 - distance / (pressed ? 46 : 34)) ** 2 * power;
        if (!weight || (!pressed && length2 < .01)) continue;
        const ax = vx * 7 + (pressed ? (x - d.x) * 32 : 0);
        const ay = vy * 7 + (pressed ? (y - d.y) * 32 - 125 : 0);
        d.vx = Math.max(-160, Math.min(160, d.vx + ax * weight * step));
        d.vy = Math.max(-160, Math.min(160, d.vy + ay * weight * step));
        d.wobble = Math.min(1, d.wobble + weight);
        if (d.contact >= 0) { d.contact = -1; d.departed = -1; }
      }
    },
    update(dt: number) {
      if (!Number.isFinite(dt)) return;
      // Bound catch-up after backgrounding; slow simulation time rather than teleport through shelves.
      accumulator += Math.max(0, Math.min(dt, 0.1));
      while (accumulator + 1e-10 >= TIMER_STEP) { tick(TIMER_STEP); accumulator -= TIMER_STEP; }
    },
  };
}
