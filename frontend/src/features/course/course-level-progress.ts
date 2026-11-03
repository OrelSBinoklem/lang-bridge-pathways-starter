export const COURSE_LEVEL_IDS = ['A1', 'A2', 'B1', 'B2'] as const;

export type CourseRank = 'bronze' | 'silver' | 'gold' | 'diamond';

export function courseRankIcon(rank: CourseRank): string {
  return { bronze: 'pi-star', silver: 'pi-star-fill', gold: 'pi-trophy', diamond: 'pi-sparkles' }[rank];
}

export type CourseLevelSummary = {
  id: string;
  completed: number;
  total: number;
  status: 'completed' | 'active' | 'locked';
  perfect: boolean;
};

export function getCourseLevelProgress(level: Pick<CourseLevelSummary, 'completed' | 'total'> | undefined) {
  if (!level || level.total <= 0) return { percent: 0, rank: null as CourseRank | null };

  const percent = Math.min(100, Math.max(0, Math.floor(100 * level.completed / level.total)));
  const rank: CourseRank | null = percent === 100 ? 'diamond'
    : percent >= 90 ? 'gold'
      : percent >= 80 ? 'silver'
        : percent >= 60 ? 'bronze' : null;

  return { percent, rank };
}

export function courseRankLabel(rank: CourseRank, uk: boolean): string {
  const labels = uk
    ? { bronze: 'Бронза', silver: 'Срібло', gold: 'Золото', diamond: 'Діамант' }
    : { bronze: 'Бронза', silver: 'Серебро', gold: 'Золото', diamond: 'Бриллиант' };
  return labels[rank];
}
