import type { World } from './world';
const periods = new WeakMap<World, number>();
/** Offline baking only; archived 3D speeds remain unchanged. */
export function setCarnivalLoop(world: World, seconds: number) { periods.set(world, seconds); }
export function carnivalRate(world: World, rate: number) {
  const period = periods.get(world);
  return period ? Math.max(1, Math.round(rate * period / (Math.PI * 2))) * Math.PI * 2 / period : rate;
}
