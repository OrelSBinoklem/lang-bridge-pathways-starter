import type { CourseLevelSummary } from '@/features/course/course-level-progress';

export type HomeModalKind = 'grammar' | 'concepts';
export type HomeDictionary = {
  id: number; name: string; lang: string; learn_lang: string;
  words: number; level: number; max_level: number; sound: boolean;
};
export type HomeLayoutProps = {
  dictionaries: HomeDictionary[];
  loading: boolean;
  courseLevels: CourseLevelSummary[];
  courseError: unknown;
  uk: boolean;
  onOpenIntro: (kind: HomeModalKind) => void;
};
