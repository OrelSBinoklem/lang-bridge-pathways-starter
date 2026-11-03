export const DROP_IMPULSE_LIMIT = 8;
export type DropImpulse = { x: number; y: number; z: number; age: number; strength: number };

/** Bounded interaction state; only real presses create impulses, never the idle wandering pointer. */
export function createDropState() {
  const impulses: DropImpulse[] = [];
  const center = { x: 0, y: 0, vx: 0, vy: 0 };
  let clock = 0;
  let accumulator = 0;
  return {
    impulses, center,
    get time() { return clock; },
    poke(x: number, y: number, strength = 1) {
      if (!Number.isFinite(x + y + strength) || x * x + y * y > 1.12 ** 2) return false;
      const length = Math.hypot(x, y);
      const factor = length > 0.97 ? 0.97 / length : 1;
      x *= factor; y *= factor;
      if (impulses.length >= DROP_IMPULSE_LIMIT) impulses.shift();
      const power = Math.max(0, Math.min(1.5, strength));
      impulses.push({ x, y, z: Math.sqrt(Math.max(0, 1 - x * x - y * y)), age: 0, strength: power });
      center.vx = Math.max(-0.8, Math.min(0.8, center.vx - x * 0.28 * power));
      center.vy = Math.max(-0.8, Math.min(0.8, center.vy - y * 0.28 * power));
      return true;
    },
    update(dt: number) {
      if (!Number.isFinite(dt)) return;
      accumulator += Math.max(0, Math.min(0.1, dt));
      while (accumulator + 1e-10 >= 1 / 120) {
        const step = 1 / 120; accumulator -= step; clock += step;
        center.vx += (-center.x * 3.8 - center.vx * 1.8) * step;
        center.vy += (-center.y * 3.8 - center.vy * 1.8) * step;
        center.x += center.vx * step; center.y += center.vy * step;
        for (let i = impulses.length - 1; i >= 0; i--) {
          impulses[i].age += step;
          if (impulses[i].age > 18) impulses.splice(i, 1);
        }
      }
    },
  };
}
