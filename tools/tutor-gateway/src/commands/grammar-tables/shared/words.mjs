import { sel } from './pronoun.mjs';

/** Same algorithm as wordId() in frontend/.../components/tutorClasses.js: "citiem vārdiem" -> "citiem-vardiem". */
export const wordId = (lv) =>
  lv.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

/** One target per [lv, ru] item: the list row carries the class tt-word-<wordId>. */
export function wordTargets(items, prefix = 'word') {
  return Object.fromEntries(
    items.map(([lv, ru]) => [
      `${prefix}_${wordId(lv).replace(/-/g, '_')}`,
      { labelRu: `«${lv}» — ${ru}`, selectors: sel(`.tt-word-${wordId(lv)}`) },
    ]),
  );
}
