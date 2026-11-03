import type { Metadata } from 'next';
import { EnglishGrammarGallery } from '@/features/english-grammar/EnglishGrammarGallery';
import { LEVELS, type Level } from '@/features/english-grammar/types';
import { getAuthToken } from '@/lib/auth';

export const metadata: Metadata = { title: 'Английская грамматика A1–B2 — таблицы', description: 'Компактные таблицы английских форм, времён, вопросов и отрицаний с пояснениями на русском.' };
export default async function EnglishGrammarPage({ searchParams }: { searchParams: Promise<{ level?: string | string[] }> }) {
  const { level } = await searchParams;
  const initialLevel = typeof level === 'string' && LEVELS.includes(level as Level) ? level as Level : 'all';
  return <EnglishGrammarGallery key={initialLevel} initialLevel={initialLevel} authenticated={Boolean(await getAuthToken())} />;
}
