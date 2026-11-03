import type { CourseLevelSummary } from '@/features/course/course-level-progress';

export const HOME_DESIGNS = ['studio', 'atlas', 'exam', 'workspace', 'journal', 'route', 'riga', 'signal', 'unified', 'glass-daybreak', 'glass-nocturne', 'glass-mosaic', 'glass-daybreak-original', 'glass-nocturne-original', 'glass-mosaic-original', 'liquid-atlas', 'prism-theatre', 'chromatic-studio', 'glass-mosaic-illustrated', 'glass-mosaic-animated', 'glass-mosaic-rounded'] as const;
export type HomeDesign = typeof HOME_DESIGNS[number];
export type GlassHomeDesign = 'glass-daybreak' | 'glass-nocturne' | 'glass-mosaic' | 'glass-mosaic-illustrated' | 'glass-mosaic-animated' | 'glass-mosaic-rounded';
export type OriginalGlassHomeDesign = Extract<HomeDesign, `${string}-original`>;
export type KineticHomeDesign = 'liquid-atlas' | 'prism-theatre' | 'chromatic-studio';
export type PreviewDictionary = {
  id: number;
  name: string;
  words: number;
  level: number;
  max_level: number;
  sound: boolean;
};
export type PreviewExam = {
  id: number;
  level: string;
  best_score: number | null;
  passed: boolean;
  durations: Record<string, number>;
};
export type HomePreviewData = {
  levels: CourseLevelSummary[];
  dictionaries: PreviewDictionary[];
  exams: PreviewExam[];
  errors: string[];
};
