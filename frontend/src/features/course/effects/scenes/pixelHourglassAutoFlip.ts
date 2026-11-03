const TURN_SECONDS = 1.2;
const SETTLE_SECONDS = .65;
const MANUAL_GRACE_SECONDS = 1.5;

/** The gravity-side chamber must contain every grain, not just a temporarily blocked neck. */
export function pixelHourglassDrained(cells: Uint8Array, angle: number): boolean {
  const gravityY = Math.cos(angle);
  if (Math.abs(gravityY) < .25) return false;
  const half = cells.length / 2;
  let source = 0, destination = 0;
  for (let i = 0; i < cells.length; i++) {
    const upper = i < half;
    if (upper === (gravityY > 0)) source += cells[i];
    else destination += cells[i];
  }
  return source === 0 && destination > 0;
}

/** Manual rotation always wins, including grabbing the case in the middle of an automatic turn. */
export function createPixelHourglassAutoFlip() {
  let quietFor = MANUAL_GRACE_SECONDS, settledFor = 0;
  let turn: { from: number; elapsed: number } | null = null;
  return {
    update(dt: number, angle: number, cells: Uint8Array, manipulating: boolean): number {
      if (manipulating) {
        quietFor = settledFor = 0;
        turn = null;
        return angle;
      }
      const step = Math.max(0, dt);
      quietFor += step;
      if (turn) {
        turn.elapsed += step;
        const t = Math.min(1, turn.elapsed / TURN_SECONDS);
        const eased = t * t * t * (t * (t * 6 - 15) + 10);
        const next = turn.from + Math.PI * eased;
        if (t === 1) { turn = null; settledFor = 0; }
        return next;
      }
      settledFor = pixelHourglassDrained(cells, angle) ? settledFor + step : 0;
      if (settledFor >= SETTLE_SECONDS && quietFor >= MANUAL_GRACE_SECONDS) {
        turn = { from: angle, elapsed: 0 };
        settledFor = 0;
      }
      return angle;
    },
  };
}
