import { caseTargets, genderNumberTargets, introTarget, sel } from './shared/pronoun.mjs';

/**
 * pron7 — "šis" (указательное, ближнее). Cells hold whole forms, often two or three variants
 * separated by commas (šīs, šās; šinī, šajā, šai), so there are no separately colored endings.
 */
export default {
  tableKey: 'pron7',
  summaryRu:
    'Указательное местоимение šis, šī, šie, šīs («этот, эта, эти»). Строки — падежи Kas? Kā? Kam? Ko? Kur?, колонки — мужской и женский род в единственном и множественном числе. В ячейках готовые формы; в некоторых через запятую перечислены варианты (например, для местного падежа).',
  notesRu: [
    'Порядок колонок: мужской род ед. (šis), мужской род мн. (šie), женский род ед. (šī), женский род мн. (šīs).',
    'В строке Kur? для каждой ячейки даны три варианта формы, разделённые запятыми.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица šis / šī', selectors: sel('.card.table-pron7') },
    ...introTarget('pron7', 'Строка с формами šis, šī, šie, šīs и переводом'),
    ...genderNumberTargets(),
    ...caseTargets('.pron7-row'),
  },
};
