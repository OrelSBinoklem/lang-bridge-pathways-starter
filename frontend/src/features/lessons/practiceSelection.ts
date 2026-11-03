export type PracticeSelections = Record<string, number>;

export function practiceSelectionKey(userId: number) {
  return `lbp:practice-selection:v1:${userId}`;
}

export function isPracticeSelections(value: unknown): value is PracticeSelections {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.entries(value).every(([key, number]) => /^[a-z-]+:\d+$/.test(key)
      && Number.isInteger(number) && Number(number) >= 1 && Number(number) <= 3);
}

type PracticePage = {
  course_group_id: number | null;
  learn_lang: string;
  skill?: string;
  blocks: { id: number; practice_variants?: boolean; variants?: { id: number }[] | null }[];
};

export function resolvePracticeSelection(page: PracticePage, saved: PracticeSelections) {
  if (page.course_group_id === null || !['listening', 'reading', 'writing', 'speaking'].includes(page.skill ?? '')) return null;
  const scope = `${page.learn_lang}:${page.course_group_id}`;
  const number = saved[scope] ?? 1;
  const variants: Record<number, number> = {};
  for (const block of page.blocks) {
    const variant = block.practice_variants ? block.variants?.[number - 1] : null;
    if (variant) variants[block.id] = variant.id;
  }
  return { scope, number, variants };
}
