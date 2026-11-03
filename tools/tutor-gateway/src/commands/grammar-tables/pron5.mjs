import { caseTargets, endingTargets, genderNumberTargets, introTarget, sel } from './shared/pronoun.mjs';

/** pron5 — "kurš" (который): case rows x gender/number columns. */
export default {
  tableKey: 'pron5',
  summaryRu:
    'Местоимение kurš, kura, kuri, kuras («который, которая, которые»). Строки — падежи Kas? Kā? Kam? Ko? Kur?, колонки — мужской и женский род в единственном и множественном числе. Основа kur- одинакова, меняется цветное окончание.',
  notesRu: [
    'Порядок колонок: мужской род ед. (kurš), мужской род мн. (kuri), женский род ед. (kura), женский род мн. (kuras).',
    'Форма именительного падежа мужского рода единственного числа — kurš (с -š), остальные формы строятся от основы kur-.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица kurš / kura', selectors: sel('.card.table-pron5') },
    ...introTarget('pron5', 'Строка с формами kurš, kura, kuri, kuras и переводом'),
    ...genderNumberTargets(),
    ...caseTargets('.pron5-row'),
    ...endingTargets('pron5'),
  },
};
