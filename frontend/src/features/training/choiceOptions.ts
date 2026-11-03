import type { DictWord } from '@/features/training/helpers';
import {
  getWordTranslationFields,
  isFullyLearned,
  type ProgressRow,
} from '@/features/training/helpers';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function modifyVowel(text: string): string {
  const vowelMap: Record<string, string> = {
    a: 'ā',
    ā: 'a',
    e: 'ē',
    ē: 'e',
    i: 'ī',
    ī: 'i',
    u: 'ū',
    ū: 'u',
    A: 'Ā',
    Ā: 'A',
    E: 'Ē',
    Ē: 'E',
    I: 'Ī',
    Ī: 'I',
    U: 'Ū',
    Ū: 'U',
  };
  const positions: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (vowelMap[text[i]]) positions.push(i);
  }
  if (!positions.length) return text;
  const pos = positions[Math.floor(Math.random() * positions.length)];
  return text.slice(0, pos) + vowelMap[text[pos]] + text.slice(pos + 1);
}

/** 6 вариантов для режима «выбор» (упрощённый порт WP choiceOptionsGenerator). */
export function generateChoiceOptions({
  word,
  mode,
  categoryId,
  dictionaryWords,
  progressById,
  learnLang = 'LV',
  translationLang,
}: {
  word: DictWord;
  mode: boolean;
  categoryId: number;
  dictionaryWords: DictWord[];
  progressById: Record<number, ProgressRow>;
  learnLang?: string | null;
  translationLang?: string | null;
}): string[] {
  const getAnswer = (w: DictWord) =>
    (mode ? w.word : getWordTranslationFields(w, translationLang).translation_1 || '').trim();
  const correct = getAnswer(word);
  if (!correct) return [];

  const inCat = (w: DictWord) => (w.category_ids ?? []).includes(categoryId);
  const categoryWords = dictionaryWords.filter(inCat);
  const restWords = dictionaryWords.filter((w) => !inCat(w));
  const used = new Set([correct]);
  const wrong: string[] = [];

  const tryAdd = (list: DictWord[], preferUnlearned: boolean) => {
    const scored = list
      .filter((w) => w.id !== word.id)
      .map((w) => ({
        a: getAnswer(w),
        unlearned: !isFullyLearned(progressById[w.id]),
      }))
      .filter((x) => x.a && !used.has(x.a));
    if (preferUnlearned) scored.sort((a, b) => Number(b.unlearned) - Number(a.unlearned));
    for (const { a } of shuffleArray(scored)) {
      if (wrong.length >= 5) break;
      if (!used.has(a)) {
        used.add(a);
        wrong.push(a);
      }
    }
  };

  tryAdd(categoryWords, true);
  if (wrong.length < 5) tryAdd(restWords, false);
  if (wrong.length < 5) tryAdd(dictionaryWords, false);

  const useLvVowels = (learnLang || 'LV').toUpperCase() === 'LV';
  if (useLvVowels && wrong.length > 0) {
    const pool = shuffleArray([correct, ...wrong.slice(0, 3)]);
    for (const item of pool.slice(0, 2)) {
      const mod = modifyVowel(item);
      if (mod !== item && !used.has(mod) && wrong.length < 5) {
        used.add(mod);
        wrong.push(mod);
      }
    }
  }

  return shuffleArray([correct, ...wrong.slice(0, 5)]);
}
