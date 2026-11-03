/**
 * Helpers shared by the pronoun table docs (pron1 … pron13). They only build target
 * objects; each table still has its own doc file with its own summary, notes and any
 * extra targets. Selectors rely on the `tt-*` classes the components put on their tags
 * (see frontend/src/features/grammar-component-tables/components/tutorClasses.js):
 *   rows:   tt-nominative | tt-genitive | tt-dative | tt-accusative | tt-locative
 *   cells:  the row class + tt-masculine|tt-feminine + tt-singular|tt-plural
 *           (pron1: the row class + tt-person-<id> + tt-singular|tt-plural)
 *   heads:  tt-gender-head, tt-number-head, tt-person-head, tt-case-head
 */

/** [{selector}, …] from plain selector strings. */
export const sel = (...selectors) => selectors.map((selector) => ({ selector }));

/** The intro strip above the table (`.pronN-intro`) that lists the pronoun forms. */
export function introTarget(prefix, labelRu) {
  return { intro: { labelRu, selectors: sel(`.${prefix}-intro`) } };
}

/** Case rows (one target per case) plus the column of case questions. */
export function caseTargets(rowSelector) {
  const row = (name) => sel(`${rowSelector}.tt-${name}`);
  return {
    nominative: { labelRu: 'Именительный падеж (Kas?): кто, что', selectors: row('nominative') },
    genitive: { labelRu: 'Родительный падеж (Kā?): чей, кого, чего', selectors: row('genitive') },
    dative: { labelRu: 'Дательный падеж (Kam?): кому, чему', selectors: row('dative') },
    accusative: { labelRu: 'Винительный падеж (Ko?): кого, что', selectors: row('accusative') },
    locative: { labelRu: 'Местный падеж (Kur?): где, в ком, в чём', selectors: row('locative') },
    case_questions: {
      labelRu: 'Колонка с вопросами падежей: Kas? Kā? Kam? Ko? Kur?',
      selectors: sel('.tt-case-head'),
    },
  };
}

/** Gender x number grid used by the four-column pronoun tables. */
export function genderNumberTargets() {
  return {
    masculine: { labelRu: 'Мужской род: заголовок и обе колонки', selectors: sel('.tt-masculine') },
    feminine: { labelRu: 'Женский род: заголовок и обе колонки', selectors: sel('.tt-feminine') },
    singular: { labelRu: 'Единственное число: подзаголовки и колонки', selectors: sel('.tt-singular') },
    plural: { labelRu: 'Множественное число: подзаголовки и колонки', selectors: sel('.tt-plural') },
    masculine_singular: {
      labelRu: 'Мужской род, единственное число (ячейки)',
      selectors: sel('.tt-masculine.tt-singular'),
    },
    masculine_plural: {
      labelRu: 'Мужской род, множественное число (ячейки)',
      selectors: sel('.tt-masculine.tt-plural'),
    },
    feminine_singular: {
      labelRu: 'Женский род, единственное число (ячейки)',
      selectors: sel('.tt-feminine.tt-singular'),
    },
    feminine_plural: {
      labelRu: 'Женский род, множественное число (ячейки)',
      selectors: sel('.tt-feminine.tt-plural'),
    },
  };
}

/** Colored endings: masculine, feminine, and both (`.pronN-ending-masc|fem`). */
export function endingTargets(prefix) {
  return {
    endings: {
      labelRu: 'Все окончания (выделены цветом)',
      selectors: sel(`.${prefix}-ending-masc`, `.${prefix}-ending-fem`),
    },
    endings_masculine: {
      labelRu: 'Окончания мужского рода',
      selectors: sel(`.${prefix}-ending-masc`),
    },
    endings_feminine: {
      labelRu: 'Окончания женского рода',
      selectors: sel(`.${prefix}-ending-fem`),
    },
  };
}

/** Example nouns printed next to the endings in pron2-pron4 (brālis, māsa, …). */
export const exampleNounTarget = {
  example_nouns: {
    labelRu: 'Примеры существительных рядом с окончаниями (brālis, māsa …)',
    selectors: sel('.tt-example-noun'),
  },
};
