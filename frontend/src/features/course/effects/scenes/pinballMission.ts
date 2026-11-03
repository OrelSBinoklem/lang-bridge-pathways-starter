export const PINBALL_MISSION_SCORE = 3000;
export const PINBALL_MISSION_SHOTS = 5;

type Table = { score: number; shots: number; activeBalls: number; targets: readonly { down: boolean }[] };
export type PinballMissionStatus = 'ready' | 'playing' | 'won' | 'lost';

/** A finite round over the existing physics; multiball belongs to its launch, not an extra life. */
export function createPinballMission(table: Table) {
  let baseScore = table.score, baseShots = table.shots;
  let status: PinballMissionStatus = 'ready';
  let colors = 0, score = 0, shots = 0;
  return {
    get status() { return status; }, get colors() { return colors; },
    get score() { return score; }, get shots() { return shots; },
    get remaining() { return Math.max(0, PINBALL_MISSION_SHOTS - shots); },
    update(): PinballMissionStatus {
      if (status === 'won' || status === 'lost') return status;
      shots = Math.max(0, table.shots - baseShots);
      if (!shots) return status;
      status = 'playing';
      score = Math.max(0, table.score - baseScore);
      table.targets.forEach((target, i) => { if (target.down) colors |= 1 << i; });
      // A winning final contact counts even if the last ball drains in the same frame.
      if (colors === 7 && score >= PINBALL_MISSION_SCORE) status = 'won';
      else if (shots >= PINBALL_MISSION_SHOTS && table.activeBalls === 0) status = 'lost';
      return status;
    },
    reset() {
      baseScore = table.score; baseShots = table.shots;
      status = 'ready'; colors = score = shots = 0;
    },
  };
}
