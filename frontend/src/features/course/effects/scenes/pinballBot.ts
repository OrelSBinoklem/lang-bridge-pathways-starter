import type { PinballControl } from './pinballPhysics';

type Table = { activeBalls: number; balls: readonly { active: boolean; x: number; y: number; vx: number; vy: number }[] };

/** A small attract-mode player: operates the real launcher/flippers, never places or steers a ball. */
export function createPinballBot(table: Table) {
  let clock = 0, waiting = 0;
  return {
    update(dt: number): PinballControl {
      const step = Math.max(0, Math.min(dt, .05));
      clock += step;
      if (!table.activeBalls) {
        waiting += step;
        const launch = waiting >= .8;
        if (launch) waiting = 0;
        return { launch, left: false, right: false };
      }
      waiting = 0;
      let left = false, right = false;
      // Release between taps so the moving flippers can transfer an impulse on the next descending ball.
      if (Math.sin(clock * 13) > -.35) for (const ball of table.balls) {
        if (!ball.active || ball.y < 1.08 || ball.vy < .05) continue;
        const predictedX = ball.x + ball.vx * .12;
        left ||= predictedX < .6;
        right ||= predictedX > .4;
      }
      return { launch: false, left, right };
    },
  };
}
