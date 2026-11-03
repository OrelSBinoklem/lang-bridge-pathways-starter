import { caseTargets, endingTargets, exampleNounTarget, genderNumberTargets, introTarget, sel } from './shared/pronoun.mjs';

/** pron3 — possessive pronoun "tavs" (твой): same layout as pron2, with example nouns. */
export default {
  tableKey: 'pron3',
  summaryRu:
    'Притяжательное местоимение tavs, tava, tavi, tavas («твой, твоя, твои»). Строки — падежи Kas? Kā? Kam? Ko? Kur?, колонки — род и число. Основа tav- одинакова, меняется цветное окончание; рядом с ним стоит пример существительного.',
  notesRu: [
    'Порядок колонок: мужской род ед. (tavs), мужской род мн. (tavi), женский род ед. (tava), женский род мн. (tavas).',
    'Окончания те же, что у mans (таблица mans / mana): различается только основа.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица tavs / tava', selectors: sel('.card.table-pron3') },
    ...introTarget('pron3', 'Строка с формами tavs, tava, tavi, tavas и переводом'),
    ...genderNumberTargets(),
    ...caseTargets('.pron3-row'),
    ...endingTargets('pron3'),
    ...exampleNounTarget,
  },
};
