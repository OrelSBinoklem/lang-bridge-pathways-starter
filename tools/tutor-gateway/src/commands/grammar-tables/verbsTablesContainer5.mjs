import { sel } from './shared/pronoun.mjs';
import { buildIrregularVerbTargets, commonIrregularVerbTargets } from './shared/irregularVerbs.mjs';

/**
 * verbsTablesContainer5 — «Нерегулярные глаголы 5» (irregular-verb-16, B1): 9 cards, two columns.
 * Structure and classes are described in shared/irregularVerbs.mjs. Cell texts below must match the component.
 */
const VERBS = [
  { id: 'sedet', lemma: 'sēdēt', ru: 'сидеть', rows: { es: { present: 'sēžu' }, tu: { present: 'sēdi' } } },
  { id: 'dzit', lemma: 'dzīt', ru: 'гнать', rows: { es: { past: 'dzinu', present: 'dzenu' } } },
  { id: 'kost', lemma: 'kost', ru: 'кусать', rows: { es: { past: 'kodu', present: 'kožu', future: 'kodīšu' }, tu: { present: 'kod' } } },
  { id: 'raut', lemma: 'raut', ru: 'рвать, дёргать', rows: { es: { past: 'rāvu', present: 'rauju' } } },
  { id: 'plest', lemma: 'plest', ru: 'раскрывать, рвать', rows: { es: { past: 'pletu', present: 'plešu', future: 'pletīšu' }, tu: { present: 'plet' } } },
  { id: 'liegt', lemma: 'liegt', ru: 'запрещать', rows: { es: { past: 'liedzu', present: 'liedzu' } } },
  { id: 'spiest', lemma: 'spiest', ru: 'нажимать', rows: { es: { past: 'spiedu', present: 'spiežu', future: 'spiedīšu' }, tu: { present: 'spiedz' } } },
  { id: 'snigt', lemma: 'snigt', ru: 'идти (о снеге)', rows: { third: { present: 'snieg' } } },
  { id: 'rasties', lemma: 'rasties', ru: 'возникать', rows: { es: { past: 'rados', present: 'rodos', future: 'radīšos' }, mes: { present: 'radāmies' }, jus: { present: 'radāties' } } },
];

export default {
  tableKey: 'verbsTablesContainer5',
  summaryRu:
    'Нерегулярные глаголы 5 (B1) — 9 карточек. В каждой заголовок (инфинитив и перевод) и строки с лицами, где форма нерегулярная (es / tu / 3 pers. / mēs / jūs). В строке три колонки без подписей: прошедшее, настоящее, будущее время. Глаголы: sēdēt (сидеть: sēžu, sēdi), dzīt (гнать: dzinu, dzenu), kost (кусать: kodu, kožu, kodīšu, kod), raut (рвать, дёргать: rāvu, rauju), plest (раскрывать, рвать: pletu, plešu, pletīšu, plet), liegt (запрещать: liedzu, liedzu), spiest (нажимать: spiedu, spiežu, spiedīšu, spiedz), snigt (идти (о снеге): snieg), rasties (возникать: rados, rodos, radīšos, radāmies, radāties).',
  notesRu: [
    'У колонок нет заголовков: слева направо идут прошедшее, настоящее и будущее время; пустая ячейка — формы в таблице нет.',
    'Цветом выделены отдельные части форм.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица «Нерегулярные глаголы 5»', selectors: sel(':scope') },
    ...commonIrregularVerbTargets(),
    ...buildIrregularVerbTargets(VERBS),
  },
};
