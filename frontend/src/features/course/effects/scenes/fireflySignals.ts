/** Local pulses, not a global phase average. Positions are CSS pixels; z is normalized depth. */
export type SignalFly = { x: number; y: number; z: number };
export function createFireflySignals(count: number, random: () => number) {
  const age = new Float64Array(count).fill(10);
  const echo = Float64Array.from({ length: count }, () => .2 + random() * .11);
  const pending = new Float64Array(count).fill(Infinity);
  const source = new Int32Array(count).fill(-1);
  const wave = new Uint32Array(count), scheduledWave = new Uint32Array(count);
  const hops = new Uint8Array(count), scheduledHops = new Uint8Array(count);
  const flash = new Float32Array(count);
  const bursts = new Uint32Array(count);
  const started: number[] = [];
  let time = 0, accumulator = 0, sequence = 0;
  const distance = (a: SignalFly, b: SignalFly, radius: number) => Math.hypot(a.x-b.x, a.y-b.y, (a.z-b.z)*radius*1.5);
  return {
    flash, bursts,
    trigger(index: number) {
      if (index < 0 || index >= count) return;
      scheduledWave[index] = ++sequence; scheduledHops[index] = 0;
      pending[index] = time; source[index] = -1;
    },
    update(dt: number, flies: readonly SignalFly[], radius: number) {
      if (!Number.isFinite(dt) || dt <= 0 || radius <= 0) return;
      accumulator += Math.min(dt, .1);
      while (accumulator + 1e-9 >= 1 / 60) {
        accumulator -= 1 / 60; time += 1 / 60;
        started.length = 0;
        for (let i = 0; i < count; i++) {
          age[i] += 1 / 60;
          if (pending[i] <= time) {
            pending[i] = Infinity;
            const inRange = source[i] < 0 || distance(flies[source[i]], flies[i], radius) <= radius;
            if (inRange && (age[i] >= 2.4 || source[i] < 0)) {
              age[i] = 0; wave[i] = scheduledWave[i]; hops[i] = scheduledHops[i]; bursts[i]++; started.push(i);
            }
          }
          const pulse = (a: number) => a < 0 || a > .9 ? 0 : a < .07 ? a / .07 : Math.exp(-(a - .07) * 5.5);
          // Individual double/triple lantern pulses travel with the main wave; not drawn connecting lines.
          flash[i] = Math.min(1, pulse(age[i]) + .42 * pulse(age[i] - echo[i]) + .18 * pulse(age[i] - echo[i] * 2.1)) * Math.pow(.86, hops[i]);
        }
        // Snapshot emitters first: an impulse cannot traverse the entire chain in one frame.
        for (const i of started) for (let j = 0; j < count; j++) {
          if (i === j || age[j] < 2.4 || wave[j] === wave[i] || hops[i] >= 6) continue;
          const a = flies[i], b = flies[j];
          const d = distance(a, b, radius), arrival = time + .24 + .65 * d / radius;
          if (d <= radius && arrival < pending[j]) {
            pending[j] = arrival; source[j] = i; scheduledWave[j] = wave[i]; scheduledHops[j] = hops[i] + 1;
          }
        }
      }
    },
  };
}
