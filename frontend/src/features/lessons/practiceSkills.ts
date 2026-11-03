export const PRACTICE_SKILLS = [
  { skill: 'listening', icon: 'pi-volume-up', ru: 'Слушание', uk: 'Слухання' },
  { skill: 'reading', icon: 'pi-file', ru: 'Чтение', uk: 'Читання' },
  { skill: 'writing', icon: 'pi-pencil', ru: 'Письмо', uk: 'Письмо' },
  { skill: 'speaking', icon: 'pi-comments', ru: 'Говорение', uk: 'Говоріння' },
] as const;

export type PracticeSkill = typeof PRACTICE_SKILLS[number]['skill'];
export type PracticeVariantRank = {
  number: number;
  rank: 'bronze' | 'silver' | 'gold' | 'diamond' | null;
  score: number | null;
  passed: number;
  total: number;
  ungraded_total: number;
  completed: boolean;
  skills_passed?: number;
  skills_total?: number;
};
export type PracticeNavigation = { skill: PracticeSkill; slug: string | null; title: string | null; completed: boolean; variant_ranks?: PracticeVariantRank[] };
