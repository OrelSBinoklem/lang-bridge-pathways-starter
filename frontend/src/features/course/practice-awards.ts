import type { CourseRank } from './course-level-progress';

export type PracticeRound = { passed: number; total: number };
export type PracticeRoundProgress = PracticeRound & { practice_rounds?: PracticeRound[] };

export function getPracticeAwards(progress: (PracticeRoundProgress | null | undefined)[]) {
  return [0, 1, 2].map(index => {
    let passed = 0, total = 0;
    for (const item of progress) {
      if (!item) continue;
      const round = item.practice_rounds?.[index] ?? { passed: index === 0 ? item.passed : 0, total: item.total };
      const count = Number.isFinite(round.total) ? Math.max(0, round.total) : 0;
      total += count;
      passed += Number.isFinite(round.passed) ? Math.min(count, Math.max(0, round.passed)) : 0;
    }
    const percent = total > 0 ? Math.floor(100 * passed / total) : 0;
    const rank: CourseRank | null = percent === 100 ? 'diamond' : percent >= 90 ? 'gold'
      : percent >= 80 ? 'silver' : percent >= 60 ? 'bronze' : null;
    return { passed, total, percent, rank, completed: total > 0 && passed === total };
  });
}
