import { sel } from './shared/pronoun.mjs';

/**
 * prepositions — Prievārdi (предлоги и падежи). Two tables side by side: the left one lists
 * prepositions with the genitive (ģenitīvs), the right one those with the dative (datīvs) and, below,
 * the accusative (akuzatīvs). Every row is: preposition | Russian meaning | [case label] | examples.
 * Component classes (TablePrepositions.jsx):
 *   rows:  tt-genitive | tt-dative | tt-accusative + tt-prep-<id>
 *   cells: tt-prep-word | tt-prep-meaning | tt-prep-example ; case label cell: tt-case-cell + case
 * Keep PREPOSITIONS in sync with the rows of the component.
 */
const PREPOSITIONS = [
  // id (class suffix), Latvian, Russian meaning, case
  ['aiz', 'aiz', 'за', 'genitive'],
  ['pie', 'pie', 'у, к', 'genitive'],
  ['virs', 'virs', 'над, поверх, сверх', 'genitive'],
  ['zem', 'zem', 'под', 'genitive'],
  ['pirms', 'pirms', 'перед, до', 'genitive'],
  ['pec', 'pēc', 'после', 'genitive'],
  ['kops', 'kopš', 'с (какого-то времени)', 'genitive'],
  ['no', 'no', 'с, из', 'genitive'],
  ['arpus', 'ārpus', 'вне', 'genitive'],
  ['uz', 'uz', 'на', 'genitive'],
  ['bez', 'bez', 'без', 'genitive'],
  ['lidz', 'līdz', 'до', 'dative'],
  ['blakus', 'blakus', 'рядом', 'dative'],
  ['pari', 'pāri', 'через, свыше, сверх', 'dative'],
  ['preti', 'pretī', 'напротив, навстречу', 'dative'],
  ['ap', 'ap', 'около, вокруг', 'accusative'],
  ['pa', 'pa', 'по', 'accusative'],
  ['gar', 'gar', 'вдоль', 'accusative'],
  ['par-over', 'pār', 'через, над', 'accusative'],
  ['pret', 'pret', 'против, к', 'accusative'],
  ['uz', 'uz', 'в, на', 'accusative'],
  ['starp', 'starp', 'между', 'accusative'],
  ['ar', 'ar', 'с', 'accusative'],
  ['par-about', 'par', 'о', 'accusative'],
  ['caur', 'caur', 'через, сквозь', 'accusative'],
];

const CASE_RU = { genitive: 'родительный (ģenitīvs)', dative: 'дательный (datīvs)', accusative: 'винительный (akuzatīvs)' };
const rows = (...ids) => ids.map((id) => ({ selector: `.tt-prep-${id}` }));

const prepositionTargets = {};
for (const [id, lv, ru, grammarCase] of PREPOSITIONS) {
  // "uz" appears in two cases: the plain target covers both rows, the case ones one each.
  const duplicated = PREPOSITIONS.filter((p) => p[0] === id).length > 1;
  const key = `prep_${id.replace(/-/g, '_')}`;
  if (duplicated) {
    prepositionTargets[key] = {
      labelRu: `${lv} (обе строки): ${PREPOSITIONS.filter((p) => p[0] === id).map((p) => `${p[2]} — ${CASE_RU[p[3]]}`).join('; ')}`,
      selectors: rows(id),
    };
    prepositionTargets[`${key}_${grammarCase}`] = {
      labelRu: `${lv} — ${ru} (${CASE_RU[grammarCase]})`,
      selectors: sel(`.tt-${grammarCase}.tt-prep-${id}`),
    };
  } else {
    prepositionTargets[key] = { labelRu: `${lv} — ${ru} (${CASE_RU[grammarCase]})`, selectors: rows(id) };
  }
}

export default {
  tableKey: 'prepositions',
  summaryRu:
    'Предлоги (prievārdi) и падежи, которых они требуют. Слева предлоги с родительным падежом (aiz, pie, virs, zem, pirms, pēc, kopš, no, ārpus, uz, bez), справа сверху с дательным (līdz, blakus, pāri, pretī), справа снизу с винительным (ap, pa, gar, pār, pret, uz, starp, ar, par, caur). В каждой строке предлог, русский перевод и, где есть, примеры.',
  notesRu: [
    'Предлог uz встречается дважды: с родительным падежом («на») и с винительным («в, на»).',
    'В примечании под таблицей: во множественном числе существительные и прилагательные с этими предлогами всегда стоят в дательном падеже.',
    'Похожие по написанию, но разные предлоги: pār («через, над») и par («о»).',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица предлогов', selectors: sel('.card.table-prepositions') },
    genitive: { labelRu: 'Предлоги с родительным падежом (ģenitīvs): левая таблица', selectors: sel('tr.tt-genitive') },
    dative: { labelRu: 'Предлоги с дательным падежом (datīvs)', selectors: sel('tr.tt-dative') },
    accusative: { labelRu: 'Предлоги с винительным падежом (akuzatīvs)', selectors: sel('tr.tt-accusative') },
    case_labels: {
      labelRu: 'Ячейки с названиями падежей (ģenitīvs, datīvs, akuzatīvs)',
      selectors: sel('.loc-case'),
    },
    prepositions: { labelRu: 'Колонка с самими предлогами', selectors: sel('.tt-prep-word') },
    meanings: { labelRu: 'Колонка с русским переводом предлогов', selectors: sel('.tt-prep-meaning') },
    examples: { labelRu: 'Колонки с примерами', selectors: sel('.tt-prep-example') },
    plural_note: {
      labelRu: 'Примечание: во множественном числе с этими предлогами всегда дательный падеж',
      selectors: sel('.prepositions-note'),
    },
    time_prepositions: {
      labelRu: 'Предлоги времени по переводам в таблице: pirms (перед, до), pēc (после), kopš (с какого-то времени), līdz (до)',
      selectors: rows('pirms', 'pec', 'kops', 'lidz'),
    },
    through_prepositions: {
      labelRu: 'Предлоги со значением «через»: pāri, pār, caur',
      selectors: rows('pari', 'par-over', 'caur'),
    },
    above_prepositions: { labelRu: 'Предлоги со значением «над»: virs и pār', selectors: rows('virs', 'par-over') },
    ...prepositionTargets,
  },
};
