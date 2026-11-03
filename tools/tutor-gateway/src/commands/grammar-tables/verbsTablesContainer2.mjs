import { sel } from './shared/pronoun.mjs';
import { buildIrregularVerbTargets, commonIrregularVerbTargets } from './shared/irregularVerbs.mjs';

/**
 * verbsTablesContainer2 — «Нерегулярные глаголы 2» (irregular-verb-6, A2): 10 cards, two columns.
 * Structure and classes are described in shared/irregularVerbs.mjs. Cell texts below must match the component.
 */
const VERBS = [
  { id: 'satikt', lemma: 'satikt', ru: 'встретить', rows: { es: { present: 'satieku' }, tu: { present: 'satiec' } } },
  { id: 'nakt', lemma: 'nākt', ru: 'приходить', rows: { es: { past: 'nācu' }, tu: { present: 'nāc' } } },
  { id: 'nemt', lemma: 'ņemt', ru: 'брать', rows: { es: { past: 'ņēmu' } } },
  { id: 'prast', lemma: 'prast', ru: 'уметь', rows: { es: { past: 'pratu', present: 'protu', future: 'pratīšu' } } },
  { id: 'doties', lemma: 'doties', ru: 'направляться', rows: { es: { past: 'devos', present: 'dodos' } } },
  { id: 'beigties', lemma: 'beigties', ru: '(за)кончиться', rows: { es: { past: 'beidzos', present: 'beidzos' } } },
  { id: 'sakties', lemma: 'sākties', ru: 'начаться', rows: { tu: { present: 'sācies' } } },
  { id: 'lugt', lemma: 'lūgt', ru: 'просить (пригласить)', rows: { es: { past: 'lūdzu', present: 'lūdzu' } } },
  { id: 'atrasties', lemma: 'atrasties', ru: 'находиться', rows: { es: { past: 'atrados', present: 'atrodos', future: 'atradīšos' } } },
  { id: 'dot', lemma: 'dot', ru: 'давать', rows: { es: { past: 'devu', present: 'dodu' } } },
];

export default {
  tableKey: 'verbsTablesContainer2',
  summaryRu:
    'Нерегулярные глаголы 2 (A2) — 10 карточек. В каждой заголовок (инфинитив и перевод) и строки с лицами, где форма нерегулярная (es / tu / 3 pers. / mēs / jūs). В строке три колонки без подписей: прошедшее, настоящее, будущее время. Глаголы: satikt (встретить: satieku, satiec), nākt (приходить: nācu, nāc), ņemt (брать: ņēmu), prast (уметь: pratu, protu, pratīšu), doties (направляться: devos, dodos), beigties ((за)кончиться: beidzos, beidzos), sākties (начаться: sācies), lūgt (просить (пригласить): lūdzu, lūdzu), atrasties (находиться: atrados, atrodos, atradīšos), dot (давать: devu, dodu).',
  notesRu: [
    'У колонок нет заголовков: слева направо идут прошедшее, настоящее и будущее время; пустая ячейка — формы в таблице нет.',
    'Цветом выделены отдельные части форм.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица «Нерегулярные глаголы 2»', selectors: sel(':scope') },
    ...commonIrregularVerbTargets(),
    ...buildIrregularVerbTargets(VERBS),
  },
};
