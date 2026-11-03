import { sel } from './shared/pronoun.mjs';

/**
 * vienlidzigi2 — «Однородные члены предложения и обобщающее слово» (TableVienlidzigi2): intro, legend (V — обобщающее
 * слово vl-gen, v — однородные члены vl-mem), a table of six patterns (tr.tt-pattern-1 … 6; cells vl-scheme and vl-lv)
 * and a note about "tāds … kā". All examples use dārzeņi (vegetables).
 */
const PATTERNS = [
  ['… V: v, v un v.', 'Tirgū nopirkām dārzeņus: kartupeļus, burkānus un kāpostus.'],
  ['v, v, v — V …', 'Kartupeļi, burkāni, kāposti — tas viss aug mūsu dārzā.'],
  ['… V — v, v, v — …', 'Dārzeņos — kartupeļos, burkānos, kāpostos — ir daudz vitamīnu.'],
  ['V — v, v, v — V …', 'Visur — virtuvē, dārzā, pagrabā — visur bija dārzeņi.'],
  ['V, kā v, v, v, …', 'Dārzeņos, kā kartupeļos, burkānos, kāpostos, ir daudz vitamīnu.'],
  ['Tādā V kā v, v, v …', 'Tādos dārzeņos kā kartupeļos, burkānos, kāpostos ir daudz vitamīnu.'],
];

export default {
  tableKey: 'vienlidzigi2',
  summaryRu:
    'Однородные члены с обобщающим словом. Обобщающее слово (V) объединяет перечисленные однородные члены (v); знаки зависят от того, где оно стоит. Шесть схем: ' +
    PATTERNS.map(([scheme, lv]) => `${scheme} — ${lv}`).join(' | ') +
    ' Последние две строки отличаются одним словом: с tāds … kā запятая перед kā не нужна.',
  notesRu: ['Обобщающее слово в примерах выделено одним цветом, однородные члены — другим; знаки препинания отмечены отдельно.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица про обобщающее слово', selectors: sel('.card.table-vienlidzigi') },
    title: { labelRu: 'Заголовок «Однородные члены предложения и обобщающее слово»', selectors: sel('.vs-head') },
    intro: { labelRu: 'Вступление про обобщающее слово', selectors: sel('.vl-intro') },
    legend: { labelRu: 'Легенда: V — обобщающее слово, v — однородные члены', selectors: sel('.vl-legend') },
    patterns_table: { labelRu: 'Таблица шести схем', selectors: sel('.vl-table') },
    schemes: { labelRu: 'Колонка со схемами (V, v)', selectors: sel('.vl-scheme') },
    examples: { labelRu: 'Колонка с примерами', selectors: sel('td.vl-lv') },
    generalizing_words: { labelRu: 'Обобщающие слова (V), выделены', selectors: sel('.vl-gen') },
    members: { labelRu: 'Однородные члены (v), выделены', selectors: sel('.vl-mem') },
    punctuation: { labelRu: 'Двоеточия, запятые и тире', selectors: sel('.vl-pn') },
    note: { labelRu: 'Примечание про tāds … kā (запятая перед kā не нужна)', selectors: sel('.vl-note') },
    ...Object.fromEntries(
      PATTERNS.map(([scheme, lv], i) => [`pattern_${i + 1}`, { labelRu: `Схема ${i + 1}: ${scheme} — ${lv}`, selectors: sel(`tr.tt-pattern-${i + 1}`) }]),
    ),
  },
};
