import { caseTargets, endingTargets, genderNumberTargets, introTarget, sel } from './shared/pronoun.mjs';

/** pron12 — "kāds" (какой): case rows x gender/number columns. */
export default {
  tableKey: 'pron12',
  summaryRu:
    'Местоимение kāds, kāda, kādi, kādas («какой, какая, какие»). Строки — падежи Kas? Kā? Kam? Ko? Kur?, колонки — мужской и женский род в единственном и множественном числе. Основа kād- одинакова, меняется цветное окончание.',
  notesRu: [
    'Порядок колонок: мужской род ед. (kāds), мужской род мн. (kādi), женский род ед. (kāda), женский род мн. (kādas).',
    'Окончания те же, что у kurš (таблица kurš / kura), отличается только основа.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица kāds / kāda', selectors: sel('.card.table-pron12') },
    ...introTarget('pron12', 'Строка с формами kāds, kāda, kādi, kādas и переводом'),
    ...genderNumberTargets(),
    ...caseTargets('.pron12-row'),
    ...endingTargets('pron12'),
  },
};
