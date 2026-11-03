import { sel } from './shared/pronoun.mjs';
import { buildIrregularVerbTargets, commonIrregularVerbTargets } from './shared/irregularVerbs.mjs';

/**
 * verbsTablesContainer4 — «Нерегулярные глаголы 4» (irregular-verb-15, B1): 10 cards, two columns.
 * Structure and classes are described in shared/irregularVerbs.mjs. Cell texts below must match the component.
 */
const VERBS = [
  { id: 'gut', lemma: 'gūt', ru: 'получать, обрести', rows: { es: { past: 'guvu', present: 'gūstu', future: 'gūšu' } } },
  { id: 'klut', lemma: 'kļūt', ru: 'становиться', rows: { es: { past: 'kļuvu', present: 'kļūstu' } } },
  { id: 'just', lemma: 'just', ru: 'чувствовать', rows: { es: { past: 'jutu', present: 'jūtu', future: 'jutīšu' } } },
  { id: 'vest', lemma: 'vest', ru: 'везти', rows: { es: { past: 'vedu', present: 'vedu', future: 'vedīšu' } } },
  { id: 'mest', lemma: 'mest', ru: 'бросать', rows: { es: { past: 'metu', present: 'metu', future: 'metīšu' } } },
  { id: 'zust', lemma: 'zust', ru: 'исчезать', rows: { es: { past: 'zudu', present: 'zūdu', future: 'zudīšu' } } },
  { id: 'zagt', lemma: 'zagt', ru: 'воровать', rows: { es: { present: 'zogu' }, tu: { present: 'zodz' } } },
  { id: 'krist', lemma: 'krist', ru: 'падать', rows: { es: { past: 'kritu', present: 'krītu', future: 'kritīšu' } } },
  { id: 'laist', lemma: 'laist', ru: 'пускать, отпускать', rows: { es: { past: 'laidu', present: 'laižu', future: 'laidīšu' }, tu: { present: 'laid' } } },
  { id: 'kliegt', lemma: 'kliegt', ru: 'кричать', rows: { es: { past: 'kliedzu', present: 'kliedzu' } } },
];

export default {
  tableKey: 'verbsTablesContainer4',
  summaryRu:
    'Нерегулярные глаголы 4 (B1) — 10 карточек. В каждой заголовок (инфинитив и перевод) и строки с лицами, где форма нерегулярная (es / tu / 3 pers. / mēs / jūs). В строке три колонки без подписей: прошедшее, настоящее, будущее время. Глаголы: gūt (получать, обрести: guvu, gūstu, gūšu), kļūt (становиться: kļuvu, kļūstu), just (чувствовать: jutu, jūtu, jutīšu), vest (везти: vedu, vedu, vedīšu), mest (бросать: metu, metu, metīšu), zust (исчезать: zudu, zūdu, zudīšu), zagt (воровать: zogu, zodz), krist (падать: kritu, krītu, kritīšu), laist (пускать, отпускать: laidu, laižu, laidīšu, laid), kliegt (кричать: kliedzu, kliedzu).',
  notesRu: [
    'У колонок нет заголовков: слева направо идут прошедшее, настоящее и будущее время; пустая ячейка — формы в таблице нет.',
    'Цветом выделены отдельные части форм.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица «Нерегулярные глаголы 4»', selectors: sel(':scope') },
    ...commonIrregularVerbTargets(),
    ...buildIrregularVerbTargets(VERBS),
  },
};
