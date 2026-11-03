/** Keep the original fluid speed while avoiding a simulation/render on every high-refresh RAF. */
export function createFountainFrameBudget(unlimited = false) {
  let last = -Infinity;
  let pending = 0;
  return {
    take(now: number, dt: number, hidden = false): number | null {
      if (hidden) { pending = 0; last = -Infinity; return null; }
      pending = Math.min(1/15, pending + Math.max(0,dt));
      if (!unlimited && now-last < 1000/30-1) return null;
      last = now;
      const elapsed = pending;
      pending = 0;
      return elapsed;
    },
  };
}
