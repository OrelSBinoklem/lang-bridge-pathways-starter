import { caseTargets, endingTargets, exampleNounTarget, genderNumberTargets, introTarget, sel } from './shared/pronoun.mjs';

/** pron2 — possessive pronoun "mans" (мой): case rows x gender/number columns, with example nouns. */
export default {
  tableKey: 'pron2',
  summaryRu:
    'Притяжательное местоимение mans, mana, mani, manas («мой, моя, мои»). Строки — падежи Kas? Kā? Kam? Ko? Kur?, колонки — мужской и женский род в единственном и множественном числе. Основа man- одинакова, меняется цветное окончание; рядом с ним стоит пример существительного (brālis, māsa …).',
  notesRu: [
    'Порядок колонок: мужской род ед. (mans), мужской род мн. (mani), женский род ед. (mana), женский род мн. (manas).',
    'Местоимение согласуется с существительным по роду, числу и падежу: man-s brālis, man-a māsa.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица mans / mana', selectors: sel('.card.table-pron2') },
    ...introTarget('pron2', 'Строка с формами mans, mana, mani, manas и переводом'),
    ...genderNumberTargets(),
    ...caseTargets('.pron2-row'),
    ...endingTargets('pron2'),
    ...exampleNounTarget,
  },
};
