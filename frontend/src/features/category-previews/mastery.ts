export type MasteryTier = 'none' | 'bronze' | 'silver' | 'gold' | 'diamond' | 'unknown';
export type AwardedMasteryTier = Exclude<MasteryTier, 'none' | 'unknown'>;

/** Presentation of the canonical percentage; does not award anything in storage. */
export function getMasteryTier(percent: number | null): MasteryTier {
  if (percent === null || !Number.isFinite(percent) || percent < 0 || percent > 100) return 'unknown';
  if (percent === 100) return 'diamond';
  if (percent >= 90) return 'gold';
  if (percent >= 80) return 'silver';
  if (percent >= 60) return 'bronze';
  return 'none';
}

export const MASTERY_LABELS: Record<AwardedMasteryTier, { ru: string; uk: string }> = {
  bronze: { ru: 'Бронза', uk: 'Бронза' },
  silver: { ru: 'Серебро', uk: 'Срібло' },
  gold: { ru: 'Золото', uk: 'Золото' },
  diamond: { ru: 'Бриллиант', uk: 'Діамант' },
};
