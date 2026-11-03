import { caseTargets, genderNumberTargets, introTarget, sel } from './shared/pronoun.mjs';

/**
 * pron6 — "tas" (указательное). The cells hold whole word forms (tas, tie, tā, tās; some cells
 * list two variants), so there are no separately colored endings here.
 */
export default {
  tableKey: 'pron6',
  summaryRu:
    'Указательное местоимение tas, tā, tie, tās («этот, эта, эти», в таблице так и переведено). Строки — падежи Kas? Kā? Kam? Ko? Kur?, колонки — мужской и женский род в единственном и множественном числе. В ячейках стоят готовые формы слова.',
  notesRu: [
    'Порядок колонок: мужской род ед. (tas), мужской род мн. (tie), женский род ед. (tā), женский род мн. (tās).',
    'Форму tā в единственном числе женского рода берёт и родительный падеж мужского рода: смотри строку Kā?.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица tas / tā', selectors: sel('.card.table-pron6') },
    ...introTarget('pron6', 'Строка с формами tas, tā, tie, tās и переводом'),
    ...genderNumberTargets(),
    ...caseTargets('.pron6-row'),
  },
};
