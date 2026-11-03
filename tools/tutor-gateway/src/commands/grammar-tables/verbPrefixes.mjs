import { sel } from './shared/pronoun.mjs';

/**
 * verbPrefixes — «Verba nest ar priedēkļiem» (приставка + глагол nest), component TablePrefixVerbs. Columns:
 * prefix | verb | meaning (Russian, the Russian prefix equivalent in bold) | related preposition.
 * Three prefixes (ie-, pār-, pie-) have two verb rows (…nest and …dot) that share the prefix and preposition cells.
 * Component classes (TablePrefixVerbs.jsx):
 *   rows:  tt-prefix-<id> + tt-verb-<ascii verb> + tt-root-nest | tt-root-dot     (pār- is "par", pa- is "pa")
 *   cells: tt-col-prefix | tt-col-verb | tt-col-meaning | tt-col-preposition
 * Keep the list in sync with the rows of the component.
 */
const PREFIXES = [
  ['aiz', 'aiz-', [['aiznest', 'унести (прочь)']], 'aiz — за, позади'],
  ['ap', 'ap-', [['apnest', 'обнести (вокруг), окружить']], 'ap — вокруг, около'],
  ['at', 'at-', [['atnest', 'принести обратно']], null],
  ['ie', 'ie-', [['ienest', 'внести (внутрь)'], ['iedot', 'дать (внутрь / кому-то)']], 'iekš — в, внутрь'],
  ['iz', 'iz-', [['iznest', 'вынести']], null],
  ['no', 'no-', [['nonest', 'снести (вниз, с чего-то)']], 'no — с, от'],
  ['pa', 'pa-', [['panest', 'немного понести / пронести']], 'pa — по, через'],
  ['par', 'pār-', [['pārnest', 'перенести (с одного места на другое)'], ['pārdot', 'продать (не пере-дать)']], 'pār — через, над'],
  ['pie', 'pie-', [['pienest', 'поднести / принести к'], ['piedot', 'простить (дать обратно долг / отпустить вину)']], 'pie — у, к'],
  ['sa', 'sa-', [['sanest', 'наносить (в кучу, собрать)']], null],
  ['uz', 'uz-', [['uznest', 'занести (вверх)']], 'uz — на, в'],
];
const ascii = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '');

const targets = {};
for (const [id, prefix, verbs, preposition] of PREFIXES) {
  const verbList = verbs.map(([v, ru]) => `${v} — ${ru}`).join('; ');
  targets[`prefix_${id}`] = {
    labelRu: `Приставка ${prefix}: ${verbList}${preposition ? `; предлог ${preposition}` : '; предлога нет'}`,
    selectors: sel(`tr.tt-prefix-${id}`),
  };
  targets[`prefix_${id}_cell`] = { labelRu: `Сама приставка ${prefix} (ячейка колонки «приставка»)`, selectors: sel(`tr.tt-prefix-${id} .tt-col-prefix`) };
  for (const [verb, ru] of verbs) {
    targets[`verb_${ascii(verb)}`] = { labelRu: `Глагол ${verb} — ${ru}`, selectors: sel(`tr.tt-verb-${ascii(verb)}`) };
  }
  if (preposition) {
    targets[`preposition_${id}`] = { labelRu: `Предлог, связанный с приставкой ${prefix}: ${preposition}`, selectors: sel(`tr.tt-prefix-${id} .tt-col-preposition`) };
  }
}

export default {
  tableKey: 'verbPrefixes',
  summaryRu:
    'Приставки глаголов на примере глагола nest (нести) и родственных предлогов. Колонки: приставка (aiz-, ap-, at-, ie-, iz-, no-, pa-, pār-, pie-, sa-, uz-), получившийся глагол (aiznest, apnest, atnest, ienest, iznest, nonest, panest, pārnest, pienest, sanest, uznest), значение по-русски (русская приставка выделена жирным: у-, об-, при-, в-, вы-, с-, по-/про-, пере-, под-/при-, на-, за-) и соответствующий предлог (aiz, ap, iekš, no, pa, pār, pie, uz; у at-, iz-, sa- предлога нет). К ie-, pār- и pie- добавлена вторая строка с глаголом dot: iedot, pārdot (продать), piedot (простить).',
  notesRu: [
    'Строки ie-, pār- и pie- состоят из двух глаголов (…nest и …dot): приставка и предлог у них общие (объединённые ячейки).',
    'Русские приставки в колонке значений выделены жирным шрифтом — их можно подсветить целиком.',
    'В таблице есть заголовок «Verba «nest» ar priedēkļiem», подзаголовок «Priedēklis + nest» и пояснение над таблицей.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица приставок глагола nest', selectors: sel('.card.table-prefix-verbs') },
    banner: { labelRu: 'Заголовок «Verba «nest» ar priedēkļiem»', selectors: sel('.title-banner') },
    intro: { labelRu: 'Подзаголовок и пояснение над таблицей', selectors: sel('.table-prefix-verbs > h2', '.table-prefix-verbs > p') },
    header: { labelRu: 'Шапка таблицы «Глагольные приставки (Verbu priedēkļi)»', selectors: sel('.table-prefix-verbs thead') },
    prefixes: { labelRu: 'Колонка приставок', selectors: sel('.tt-col-prefix') },
    verbs: { labelRu: 'Колонка глаголов с приставкой', selectors: sel('.tt-col-verb') },
    meanings: { labelRu: 'Колонка значений по-русски', selectors: sel('.tt-col-meaning') },
    russian_prefixes: { labelRu: 'Русские приставки, выделенные жирным в значениях', selectors: sel('.tt-col-meaning strong') },
    prepositions: { labelRu: 'Колонка связанных предлогов', selectors: sel('.tt-col-preposition') },
    nest_verbs: { labelRu: 'Все глаголы с корнем nest (…nest)', selectors: sel('tr.tt-root-nest') },
    dot_verbs: { labelRu: 'Глаголы с корнем dot: iedot, pārdot, piedot', selectors: sel('tr.tt-root-dot') },
    no_preposition: { labelRu: 'Строки без предлога: at-, iz-, sa-', selectors: sel('tr.tt-prefix-at', 'tr.tt-prefix-iz', 'tr.tt-prefix-sa') },
    ...targets,
  },
};
