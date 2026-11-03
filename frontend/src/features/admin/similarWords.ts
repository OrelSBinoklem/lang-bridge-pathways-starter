import type { CategoryNode } from '@/features/dictionaries/category-tree';
import type { DictWord } from '@/features/training/helpers';

const SIMILAR_DICT_MIN_SCORE = 48;
const SIMILAR_DICT_MAX_RESULTS = 3;

export type CategoryMeta = { name: string; depth: number; parentId: number | null };

export function normalizeWord(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[.,;:!?()[\]{}"'`]/g, '')
    .replace(/\s+/g, ' ');
}

export function getWordCategoryIds(
  word: Pick<DictWord, 'category_ids'> & { category_id?: number | string | null },
): number[] {
  const ids: number[] = [];
  for (const v of word.category_ids ?? []) {
    const id = Number(v);
    if (Number.isFinite(id) && id > 0) ids.push(id);
  }
  if (word.category_id != null && String(word.category_id) !== '') {
    const id = Number(word.category_id);
    if (Number.isFinite(id) && id > 0) ids.push(id);
  }
  return [...new Set(ids)];
}

export function buildCategoryMetaMap(tree: CategoryNode[]): Map<number, CategoryMeta> {
  const map = new Map<number, CategoryMeta>();
  const walk = (nodes: CategoryNode[], depth: number, parentId: number | null) => {
    for (const node of nodes) {
      map.set(node.id, { name: String(node.name || ''), depth, parentId });
      if (node.children?.length) walk(node.children, depth + 1, node.id);
    }
  };
  walk(tree, 0, null);
  return map;
}

export function buildCategoryPath(metaMap: Map<number, CategoryMeta>, categoryId: number): string {
  const parts: string[] = [];
  let currentId: number | null = categoryId;
  const guard = new Set<number>();
  while (currentId && !guard.has(currentId)) {
    guard.add(currentId);
    const meta = metaMap.get(currentId);
    if (!meta?.name) break;
    parts.unshift(meta.name);
    currentId = meta.parentId;
  }
  return parts.join(' > ');
}

export function getDeepestCategoryPaths(
  metaMap: Map<number, CategoryMeta>,
  word: Pick<DictWord, 'category_ids'> & { category_id?: number | null },
): string[] {
  const ids = getWordCategoryIds(word);
  if (!ids.length) return [];
  const entries = ids
    .map((id) => ({ id, meta: metaMap.get(id) }))
    .filter((e): e is { id: number; meta: CategoryMeta } => !!e.meta?.name);
  if (!entries.length) return [];
  const maxDepth = Math.max(...entries.map((e) => e.meta.depth));
  return [
    ...new Set(
      entries.filter((e) => e.meta.depth === maxDepth).map((e) => buildCategoryPath(metaMap, e.id)),
    ),
  ].filter(Boolean);
}

/** Deepest category id, or 0. */
export function getDeepestCategoryId(
  metaMap: Map<number, CategoryMeta>,
  word: Pick<DictWord, 'category_ids'> & { category_id?: number | null },
): number {
  const ids = getWordCategoryIds(word);
  if (!ids.length) return 0;
  let best = 0;
  let bestDepth = -1;
  for (const id of ids) {
    const meta = metaMap.get(id);
    const depth = meta ? meta.depth : 0;
    if (depth >= bestDepth) {
      bestDepth = depth;
      best = id;
    }
  }
  return best;
}

/**
 * Category id for opening training from search: L2 (depth 1).
 * If the word sits in L3+, walk up to the L2 parent. Falls back to L1 if no L2.
 */
export function getTrainingCategoryId(
  metaMap: Map<number, CategoryMeta>,
  word: Pick<DictWord, 'category_ids'> & { category_id?: number | null },
): number {
  let id = getDeepestCategoryId(metaMap, word);
  if (!id) return 0;
  const guard = new Set<number>();
  while (id && !guard.has(id)) {
    guard.add(id);
    const meta = metaMap.get(id);
    if (!meta) return id;
    if (meta.depth <= 1) return id;
    id = meta.parentId ?? 0;
  }
  return 0;
}

function levenshtein(a: string, b: string): number {
  const s = normalizeWord(a);
  const t = normalizeWord(b);
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function similarityScore(query: string, candidate: string): number {
  const q = normalizeWord(query);
  const c = normalizeWord(candidate);
  if (!q || !c) return -1;
  if (q === c) return 1000;
  if (c.startsWith(q)) return 700 - (c.length - q.length);
  if (c.includes(q)) return 500 - (c.length - q.length);
  const dist = levenshtein(q, c);
  const maxLen = Math.max(q.length, c.length);
  const ratio = maxLen > 0 ? 1 - dist / maxLen : 0;
  return Math.round(ratio * 100);
}

export type SimilarMatch = {
  id: number;
  word: string;
  translation_1: string;
  category_ids: number[];
  _score?: number;
};

export function getMatchesForQuery(
  dictionaryWords: DictWord[],
  queryValue: string,
  excludeWordId: number | null = null,
): { exact: SimilarMatch[]; similar: SimilarMatch[] } {
  const q = normalizeWord(queryValue);
  if (!q || dictionaryWords.length === 0) return { exact: [], similar: [] };

  const ex = excludeWordId != null ? String(excludeWordId) : null;
  const words: SimilarMatch[] = dictionaryWords
    .map((w) => ({
      id: w.id,
      word: w.word,
      translation_1: w.translation_1 || '',
      category_ids: getWordCategoryIds(w),
    }))
    .filter((w) => normalizeWord(w.word).length > 0);

  const exact = words.filter((w) => normalizeWord(w.word) === q && (!ex || String(w.id) !== ex));
  if (exact.length > 0) return { exact, similar: [] };

  const similar = words
    .filter((w) => !ex || String(w.id) !== ex)
    .map((w) => ({ ...w, _score: similarityScore(q, w.word) }))
    .filter((w) => (w._score ?? 0) >= SIMILAR_DICT_MIN_SCORE)
    .sort((a, b) => (b._score ?? 0) - (a._score ?? 0))
    .slice(0, SIMILAR_DICT_MAX_RESULTS);

  return { exact: [], similar };
}

export type CategorySimilarRow = {
  sourceId: number;
  sourceWord: string;
  sourceTranslation: string;
  exact: SimilarMatch[];
  similar: SimilarMatch[];
};

export function buildCategorySimilarReport(
  categoryWords: DictWord[],
  dictionaryWords: DictWord[],
): CategorySimilarRow[] {
  return categoryWords
    .filter((cw) => normalizeWord(cw.word).length > 0)
    .map((cw) => {
      const { exact, similar } = getMatchesForQuery(dictionaryWords, cw.word, cw.id);
      return {
        sourceId: cw.id,
        sourceWord: cw.word,
        sourceTranslation: cw.translation_1 || '',
        exact,
        similar,
      };
    });
}
