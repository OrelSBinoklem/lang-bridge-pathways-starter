import { caseTargets, endingTargets, introTarget, sel } from './shared/pronoun.mjs';

/**
 * pron10 — "pats, pati" (сам, сама). Four columns: masculine sg, masculine pl, feminine sg,
 * feminine pl; the top header of this table only groups them by number, the gender is shown by
 * the colored endings (pron10-ending-masc / pron10-ending-fem), so there are number classes only.
 */
export default {
  tableKey: 'pron10',
  summaryRu:
    'Местоимение pats, pati («сам, сама»). Строки — падежи Kas? Kā? Kam? Ko? Kur?, колонки — единственное и множественное число (мужской и женский род). Основа pat- есть только в именительном падеже единственного числа, во всех остальных формах она paš-.',
  notesRu: [
    'Именительный падеж: pats, pati (основа pat-), но во множественном числе уже paši, pašas (основа paš-).',
    'Чередование t → š в основе: pat- → paš- во всех формах, кроме pats и pati.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица pats / pati', selectors: sel('.card.table-pron10') },
    ...introTarget('pron10', 'Строка с формой pats, pati и переводом'),
    singular: { labelRu: 'Единственное число: подзаголовки и ячейки', selectors: sel('.tt-singular') },
    plural: { labelRu: 'Множественное число: подзаголовки и ячейки', selectors: sel('.tt-plural') },
    stem_alternation: {
      labelRu: 'Ячейки именительного падежа, где основа pat- меняется на paš-',
      selectors: sel('.pron10-row.tt-nominative .pron10-cell.tt-singular', '.pron10-row.tt-nominative .pron10-cell.tt-plural'),
    },
    ...caseTargets('.pron10-row'),
    ...endingTargets('pron10'),
  },
};
