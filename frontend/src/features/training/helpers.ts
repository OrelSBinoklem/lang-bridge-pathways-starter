export type DictWord = {
  id: number;
  word: string;
  translation_1: string;
  translation_2?: string | null;
  translation_3?: string | null;
  translation_input_variable?: string | null;
  difficult_translation?: string | null;
  translations?: Record<
    string,
    {
      translation_1?: string | null;
      translation_2?: string | null;
      translation_3?: string | null;
      translation_input_variable?: string | null;
      difficult_translation?: string | null;
      info?: string | null;
    }
  >;
  category_ids: number[];
  learn_lang?: string | null;
  level?: number | null;
  max_level?: number | null;
  type?: string | null;
  gender?: string | null;
  is_phrase?: boolean | number | null;
  order?: number | null;
  info?: string | null;
  sound_url?: string | null;
};

export type ProgressRow = {
  dict_word_id: number;
  attempts: number;
  correct_attempts: number;
  attempts_revert: number;
  correct_attempts_revert: number;
  last_shown?: string | null;
  last_shown_revert?: string | null;
  mode_education?: boolean;
  mode_education_revert?: boolean;
  cooldown_tier?: number;
  cooldown_tier_revert?: number;
  easy_correct?: boolean;
  easy_correct_revert?: boolean;
};

export function wordInCategory(word: DictWord, catId: number): boolean {
  return (word.category_ids ?? []).includes(catId);
}

/** Прогресс категории как в WP CategoryTree: единица = направление (прямой/обратный), 100% при ≥2 в обоих */
export function getCategoryProgress(
  words: DictWord[],
  progressByWordId: Record<number, Pick<ProgressRow, 'correct_attempts' | 'correct_attempts_revert'>>,
  categoryId: number,
  childIds: number[] = [],
): { total: number; learned: number; progress: number } {
  const allIds = new Set([categoryId, ...childIds]);
  const seen = new Set<number>();
  const matched: DictWord[] = [];
  for (const w of words) {
    if (seen.has(w.id)) continue;
    if ((w.category_ids ?? []).some((id) => allIds.has(id))) {
      seen.add(w.id);
      matched.push(w);
    }
  }
  const n = matched.length;
  if (!n) return { total: 0, learned: 0, progress: 0 };
  const total = n * 2;
  let learned = 0;
  for (const w of matched) {
    const u = progressByWordId[w.id];
    if ((u?.correct_attempts ?? 0) >= 2) learned += 1;
    if ((u?.correct_attempts_revert ?? 0) >= 2) learned += 1;
  }
  return { total, learned, progress: learned / total };
}

export function collectDescendantIds(node: {
  id: number;
  children?: { id: number; children?: unknown[] }[];
}): number[] {
  if (!node.children?.length) return [];
  return node.children.flatMap((c) => [c.id, ...collectDescendantIds(c as { id: number; children?: { id: number }[] })]);
}

export type QueueItem = {
  word: DictWord;
  mode: boolean;
  phase: 'direct' | 'revert';
};

export type WordTranslationFields = {
  translation_1: string;
  translation_2?: string | null;
  translation_3?: string | null;
  translation_input_variable?: string | null;
  difficult_translation?: string | null;
  info?: string | null;
};

const COOLDOWN_MS = {
  first: 30 * 60 * 1000,
  tiers: [20 * 60 * 60 * 1000, 30 * 60 * 1000, 3 * 60 * 60 * 1000] as const,
};

export function normalizeString(str: string): string {
  return (str || '')
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]/g, '')
    .replace(/\s+/g, ' ');
}

export function stripParenthesesAndPunctuation(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[.,;:?!]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getWordTranslationFields(
  word: DictWord,
  lang?: string | null,
): WordTranslationFields {
  const code = (lang || '').toLowerCase();
  const localized = code ? word.translations?.[code] : null;
  return {
    translation_1: localized?.translation_1 || word.translation_1 || '',
    translation_2: localized?.translation_2 ?? word.translation_2,
    translation_3: localized?.translation_3 ?? word.translation_3,
    translation_input_variable:
      localized?.translation_input_variable ?? word.translation_input_variable,
    difficult_translation: localized?.difficult_translation ?? word.difficult_translation,
    info: localized?.info ?? word.info,
  };
}

export function getWordTranslationList(word: DictWord, lang?: string | null): string[] {
  const tr = getWordTranslationFields(word, lang);
  return [tr.translation_1, tr.translation_2, tr.translation_3].filter(
    (t): t is string => !!t && t !== '0',
  );
}

export function getCorrectAnswers(
  word: DictWord,
  isReverse = false,
  translationLang?: string | null,
): string[] {
  if (isReverse) return [word.word].filter(Boolean);
  const tr = getWordTranslationFields(word, translationLang);
  const list = getWordTranslationList(word, translationLang);
  if (tr.translation_input_variable?.trim()) {
    list.push(
      ...tr.translation_input_variable
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    );
  }
  return list;
}

/** Варианты ответа со скобками: «ручка (дверная)» → «ручка» и «ручка дверная» */
export function generateAnswerVariants(text: string): string[] {
  if (!text) return [];
  const withoutParen = text.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const withoutBrackets = text.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
  const out: string[] = [];
  if (withoutParen) out.push(withoutParen);
  if (withoutBrackets && withoutBrackets !== withoutParen) out.push(withoutBrackets);
  return out;
}

export function countPhraseWords(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  return text
    .trim()
    .replace(/[\s.,;:!?\-—–'"()[\]{}…]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function removeGarumMarks(text: string): string {
  return normalizeString(text).replace(/[āēīūō]/g, (char) => {
    const map: Record<string, string> = { ā: 'a', ē: 'e', ī: 'i', ū: 'u', ō: 'o' };
    return map[char] || char;
  });
}

/** Ошибка только в гарумзимах (ā/ē/ī/ū) — без доп. попытки для фраз */
export function isGarumOnlyMismatch(typedAnswer: string, acceptableAnswers: string[]): boolean {
  const typed = removeGarumMarks(stripParenthesesAndPunctuation(typedAnswer || ''));
  return acceptableAnswers.some(
    (answer) => removeGarumMarks(stripParenthesesAndPunctuation(answer || '')) === typed,
  );
}

export function evaluateAnswer(
  word: DictWord,
  userAnswer: string,
  isReverse = false,
  translationLang?: string | null,
): { correct: boolean; correctAnswers: string[]; allAcceptableVariants: string[] } {
  const correctAnswers = getCorrectAnswers(word, isReverse, translationLang);
  const allAcceptableVariants = correctAnswers.flatMap((a) => generateAnswerVariants(a));
  const trimmed = (userAnswer || '').trim();
  if (!trimmed) {
    return { correct: false, correctAnswers, allAcceptableVariants };
  }
  const normalizedUser = normalizeString(stripParenthesesAndPunctuation(trimmed));
  const correct = allAcceptableVariants.some(
    (a) => normalizeString(stripParenthesesAndPunctuation(a)) === normalizedUser,
  );
  return { correct, correctAnswers, allAcceptableVariants };
}

export function checkTranslation(word: DictWord, userAnswer: string, isReverse = false): boolean {
  return evaluateAnswer(word, userAnswer, isReverse).correct;
}

export function formatCorrectAnswerDisplay(
  word: DictWord,
  isReverse: boolean,
  translationLang?: string | null,
): string {
  if (isReverse) return word.word;
  return getWordTranslationList(word, translationLang).join(', ');
}

export const PHRASE_WORD_MIN_COUNT = 3;

function parseUtc(value?: string | null): number | null {
  if (!value || value.startsWith('0000')) return null;
  const iso = value.includes('T') ? value : value.replace(' ', 'T') + 'Z';
  const ts = Date.parse(iso);
  return Number.isNaN(ts) ? null : ts;
}

export function getCooldownRemainingMs(
  lastShown: string | null | undefined,
  correctAttempts: number,
  tier = 0,
): number {
  if (correctAttempts >= 2) return 0;
  const ts = parseUtc(lastShown);
  if (ts === null) return 0;
  const duration =
    correctAttempts === 0
      ? COOLDOWN_MS.first
      : COOLDOWN_MS.tiers[Math.max(0, Math.min(2, tier))] ?? COOLDOWN_MS.tiers[0];
  return Math.max(0, ts + duration - Date.now());
}

export function isFullyLearned(p?: ProgressRow | null): boolean {
  if (!p) return false;
  if (p.mode_education || p.mode_education_revert) return false;
  return (p.correct_attempts ?? 0) >= 2 && (p.correct_attempts_revert ?? 0) >= 2;
}

export function isTrainingItemAvailable(item: QueueItem, p?: ProgressRow): boolean {
  if (isFullyLearned(p)) return false;
  const correct = item.mode ? p?.correct_attempts_revert ?? 0 : p?.correct_attempts ?? 0;
  const education = item.mode ? p?.mode_education_revert : p?.mode_education;
  const shown = item.mode ? p?.last_shown_revert : p?.last_shown;
  const tier = item.mode ? p?.cooldown_tier_revert : p?.cooldown_tier;
  return (correct < 2 || !!education) && getCooldownRemainingMs(shown, correct, tier ?? 0) === 0;
}

export function getNextAvailableQueueIndex(
  queue: QueueItem[],
  currentIndex: number,
  progressById: Record<number, ProgressRow>,
): number {
  for (let i = currentIndex + 1; i < queue.length; i += 1) {
    if (isTrainingItemAvailable(queue[i], progressById[queue[i].word.id])) return i;
  }
  return -1;
}

export function buildTrainingQueue(
  words: DictWord[],
  progressById: Record<number, ProgressRow>,
): QueueItem[] {
  const directs: QueueItem[] = [];
  const reverts: QueueItem[] = [];

  for (const word of words) {
    const p = progressById[word.id];
    const direct: QueueItem = { word, mode: false, phase: 'direct' };
    const reverse: QueueItem = { word, mode: true, phase: 'revert' };
    if (isTrainingItemAvailable(direct, p)) directs.push(direct);
    if (isTrainingItemAvailable(reverse, p)) reverts.push(reverse);
  }

  const shuffle = <T,>(arr: T[]) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  return [...shuffle(directs), ...shuffle(reverts)];
}

export function buildDenseQueue(
  wordsById: Record<number, DictWord>,
  denseDirect: number[],
  denseRevert: number[],
): QueueItem[] {
  const shuffle = <T,>(arr: T[]) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const directs = shuffle(denseDirect)
    .map((id) => wordsById[id])
    .filter(Boolean)
    .map((word) => ({ word, mode: false, phase: 'direct' as const }));
  const reverts = shuffle(denseRevert)
    .map((id) => wordsById[id])
    .filter(Boolean)
    .map((word) => ({ word, mode: true, phase: 'revert' as const }));

  return [...directs, ...reverts];
}

export function getWordDifficultyMetrics(p?: ProgressRow | null) {
  if (!p) return null;
  const directAttempts = Math.max(0, Number(p.attempts) || 0);
  const revertAttempts = Math.max(0, Number(p.attempts_revert) || 0);
  const totalAttempts = directAttempts + revertAttempts;
  if (totalAttempts <= 0) return null;
  return { directAttempts, revertAttempts, totalAttempts };
}

/** top percent% слов по числу попыток (как WP pickHardestWordsForDenseTraining) */
export function pickHardestWordsForDenseTraining(
  words: DictWord[],
  progressById: Record<number, ProgressRow>,
  percent = 15,
  excludeWordIds: number[] = [],
) {
  if (words.length === 0) {
    return { wordIds: [] as number[], maxAttempts: 0, targetCount: 0, candidateCount: 0 };
  }
  const targetCount = Math.max(1, Math.ceil((words.length * percent) / 100));
  const exclude = new Set(excludeWordIds.map(Number));
  const scored = words
    .map((w) => {
      const m = getWordDifficultyMetrics(progressById[w.id]);
      if (!m || exclude.has(w.id)) return null;
      return { id: w.id, totalAttempts: m.totalAttempts };
    })
    .filter((x): x is { id: number; totalAttempts: number } => !!x)
    .sort((a, b) => b.totalAttempts - a.totalAttempts || a.id - b.id);

  if (scored.length === 0) {
    return { wordIds: [] as number[], maxAttempts: 0, targetCount, candidateCount: 0 };
  }
  return {
    wordIds: scored.slice(0, Math.min(targetCount, scored.length)).map((s) => s.id),
    maxAttempts: scored[0].totalAttempts,
    targetCount,
    candidateCount: scored.length,
  };
}

export type AttemptChartBar = {
  id: number;
  word: string;
  translation_1: string;
  translation_2?: string | null;
  translation_3?: string | null;
  info?: string | null;
  directAttempts: number;
  revertAttempts: number;
  totalAttempts: number;
  inDense: boolean;
  selected: boolean;
  isMaxTier: boolean;
};

export function getCategoryAttemptChartData(
  words: DictWord[],
  progressById: Record<number, ProgressRow>,
  selectedWordIds: number[] = [],
  denseWordIds: number[] = [],
  translationLang?: string | null,
) {
  if (words.length === 0) return { bars: [] as AttemptChartBar[], maxAttempts: 0, chartMax: 1 };
  const selected = new Set(selectedWordIds.map(Number));
  const inDense = new Set(denseWordIds.map(Number));
  const bars = words
    .map((w) => {
      const m = getWordDifficultyMetrics(progressById[w.id]);
      const tr = getWordTranslationFields(w, translationLang);
      const directAttempts = m?.directAttempts ?? 0;
      const revertAttempts = m?.revertAttempts ?? 0;
      const totalAttempts = m?.totalAttempts ?? 0;
      return {
        id: w.id,
        word: w.word || '',
        translation_1: tr.translation_1 || '',
        translation_2: tr.translation_2,
        translation_3: tr.translation_3,
        info: tr.info,
        directAttempts,
        revertAttempts,
        totalAttempts,
        inDense: inDense.has(w.id),
        selected: selected.has(w.id),
        isMaxTier: false,
      };
    })
    .sort((a, b) => b.totalAttempts - a.totalAttempts || a.word.localeCompare(b.word));
  const maxAttempts = bars.length ? Math.max(...bars.map((b) => b.totalAttempts)) : 0;
  return {
    bars: bars.map((b) => ({
      ...b,
      isMaxTier: maxAttempts > 0 && b.totalAttempts === maxAttempts,
    })),
    maxAttempts,
    chartMax: Math.max(1, maxAttempts),
  };
}

export function promptFor(
  word: DictWord,
  isRevert: boolean,
  translationLang?: string | null,
): string {
  return isRevert ? getWordTranslationFields(word, translationLang).translation_1 : word.word;
}

export function expectedHint(
  word: DictWord,
  isRevert: boolean,
  translationLang?: string | null,
): string {
  return isRevert ? word.word : getWordTranslationFields(word, translationLang).translation_1;
}

/** Word cooldowns use the legacy hours:minutes display. */
export function formatCooldownMs(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Dense-session waits retain their separate minute/second countdown. */
export function formatDenseWaitMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function maskText(text: string): string {
  return (text || '')
    .split('')
    .map((ch) => (ch === ' ' ? ' ' : '█ '))
    .join('');
}

export type WordDisplayStatus = {
  showWord: boolean;
  showTranslation: boolean;
  fullyLearned: boolean;
  hasAttempts: boolean;
  cooldownDirect: number | null;
  cooldownRevert: number | null;
  modeEducation: boolean;
  modeEducationRevert: boolean;
};

/** Логика масок/откатов как getWordDisplayStatusExamen в WP */
export function getWordDisplayStatusExamen(
  p?: ProgressRow | null,
  now = Date.now(),
): WordDisplayStatus {
  if (!p) {
    return {
      showWord: true,
      showTranslation: true,
      fullyLearned: false,
      hasAttempts: false,
      cooldownDirect: null,
      cooldownRevert: null,
      modeEducation: false,
      modeEducationRevert: false,
    };
  }

  const isReset =
    !p.mode_education &&
    !p.mode_education_revert &&
    (p.attempts ?? 0) === 0 &&
    (p.attempts_revert ?? 0) === 0 &&
    (p.correct_attempts ?? 0) === 0 &&
    (p.correct_attempts_revert ?? 0) === 0 &&
    !p.last_shown &&
    !p.last_shown_revert;

  if (isReset) {
    return {
      showWord: true,
      showTranslation: true,
      fullyLearned: false,
      hasAttempts: false,
      cooldownDirect: null,
      cooldownRevert: null,
      modeEducation: !!p.mode_education,
      modeEducationRevert: !!p.mode_education_revert,
    };
  }

  const cdDirect = getCooldownRemainingMs(p.last_shown, p.correct_attempts ?? 0, p.cooldown_tier ?? 0);
  const cdRevert = getCooldownRemainingMs(
    p.last_shown_revert,
    p.correct_attempts_revert ?? 0,
    p.cooldown_tier_revert ?? 0,
  );
  // now reserved for future live clocks; ms already vs Date.now()
  void now;

  const directLearned = (p.correct_attempts ?? 0) >= 2;
  const revertLearned = (p.correct_attempts_revert ?? 0) >= 2;
  const inEasy = !!p.mode_education || !!p.mode_education_revert;

  return {
    showWord: revertLearned,
    showTranslation: directLearned,
    fullyLearned: directLearned && revertLearned && !inEasy,
    hasAttempts: (p.attempts ?? 0) > 0 || (p.attempts_revert ?? 0) > 0,
    cooldownDirect: cdDirect > 0 ? cdDirect : null,
    cooldownRevert: cdRevert > 0 ? cdRevert : null,
    modeEducation: !!p.mode_education,
    modeEducationRevert: !!p.mode_education_revert,
  };
}
