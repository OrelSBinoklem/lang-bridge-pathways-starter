import { sel } from './shared/pronoun.mjs';
import { buildIrregularVerbTargets, commonIrregularVerbTargets } from './shared/irregularVerbs.mjs';

/**
 * verbsTablesContainer3 — «Нерегулярные глаголы 3» (irregular-verb-11, A2): 8 cards, two columns.
 * Structure and classes are described in shared/irregularVerbs.mjs. Cell texts below must match the component.
 */
const VERBS = [
  { id: 'likt', lemma: 'likt', ru: 'класть, ставить', rows: { es: { present: 'lieku' }, tu: { present: 'liec' } } },
  { id: 'tikt', lemma: 'tikt', ru: 'попасть, стать', rows: { es: { present: 'tieku' }, tu: { present: 'tiec' } } },
  { id: 'saukt', lemma: 'saukt', ru: 'звать, называть', rows: { es: { past: 'saucu', present: 'saucu' } } },
  { id: 'teikt', lemma: 'teikt', ru: 'говорить, сказать', rows: { es: { past: 'teicu', present: 'teicu' } } },
  { id: 'vilkt', lemma: 'vilkt', ru: 'тянуть, носить', rows: { es: { present: 'velku' }, tu: { present: 'velc' } } },
  { id: 'nest', lemma: 'nest', ru: 'нести', rows: { es: { future: 'nesīšu' } } },
  { id: 'sniegt', lemma: 'sniegt', ru: 'подавать', rows: { es: { past: 'sniedzu', present: 'sniedzu' } } },
  { id: 'celt', lemma: 'celt', ru: 'поднимать', rows: { es: { past: 'cēlu', present: 'ceļu' }, tu: { present: 'cel' } } },
];

export default {
  tableKey: 'verbsTablesContainer3',
  summaryRu:
    'Нерегулярные глаголы 3 (A2) — 8 карточек. В каждой заголовок (инфинитив и перевод) и строки с лицами, где форма нерегулярная (es / tu / 3 pers. / mēs / jūs). В строке три колонки без подписей: прошедшее, настоящее, будущее время. Глаголы: likt (класть, ставить: lieku, liec), tikt (попасть, стать: tieku, tiec), saukt (звать, называть: saucu, saucu), teikt (говорить, сказать: teicu, teicu), vilkt (тянуть, носить: velku, velc), nest (нести: nesīšu), sniegt (подавать: sniedzu, sniedzu), celt (поднимать: cēlu, ceļu, cel).',
  notesRu: [
    'У колонок нет заголовков: слева направо идут прошедшее, настоящее и будущее время; пустая ячейка — формы в таблице нет.',
    'Цветом выделены отдельные части форм.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица «Нерегулярные глаголы 3»', selectors: sel(':scope') },
    ...commonIrregularVerbTargets(),
    ...buildIrregularVerbTargets(VERBS),
  },
};
