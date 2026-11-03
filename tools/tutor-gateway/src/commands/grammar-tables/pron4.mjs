import { caseTargets, endingTargets, exampleNounTarget, genderNumberTargets, introTarget, sel } from './shared/pronoun.mjs';

/** pron4 — reflexive possessive pronoun "savs" (свой): same layout as pron2/pron3. */
export default {
  tableKey: 'pron4',
  summaryRu:
    'Возвратное притяжательное местоимение savs, sava, savi, savas («свой, своя, свои»). Строки — падежи Kas? Kā? Kam? Ko? Kur?, колонки — род и число. Основа sav- одинакова, меняется цветное окончание; рядом с ним стоит пример существительного.',
  notesRu: [
    'Порядок колонок: мужской род ед. (savs), мужской род мн. (savi), женский род ед. (sava), женский род мн. (savas).',
    'Окончания те же, что у mans и tavs; savs указывает на владельца, который является подлежащим предложения.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица savs / sava', selectors: sel('.card.table-pron4') },
    ...introTarget('pron4', 'Строка с формами savs, sava, savi, savas и переводом'),
    ...genderNumberTargets(),
    ...caseTargets('.pron4-row'),
    ...endingTargets('pron4'),
    ...exampleNounTarget,
  },
};
