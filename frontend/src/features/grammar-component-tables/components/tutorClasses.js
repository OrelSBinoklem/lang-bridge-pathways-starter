/**
 * Named `tt-*` classes ("tutor target") that grammar table components put on their
 * tags so the tutor bot can highlight parts of a table. They carry no styles: the
 * bot's per-table docs (tools/tutor-gateway/src/commands/grammar-tables/<key>.mjs)
 * select them by name, and several classes on one tag form a grid (a cell is in a
 * case row AND a gender/number column at the same time).
 */

const CASE_BY_QUESTION = {
  'kas?': 'nominative',
  'kā?': 'genitive',
  'kam?': 'dative',
  'ko?': 'accusative',
  'kur?': 'locative',
  'kur? kad?': 'locative',
};

/** Case class for a case-question row such as "Kā?" -> "tt-genitive". */
export function caseClass(question) {
  const name = CASE_BY_QUESTION[String(question || '').trim().toLowerCase()];
  return name ? `tt-${name}` : 'tt-other-case';
}

/** Column order of the pronoun tables: masculine sg, masculine pl, feminine sg, feminine pl. */
export const GENDER_NUMBER_CLASSES = [
  'tt-masculine tt-singular',
  'tt-masculine tt-plural',
  'tt-feminine tt-singular',
  'tt-feminine tt-plural',
];

/** Column order of the personal pronoun table: es tu viņš viņa | mēs jūs viņi viņas. */
export const PERSON_CLASSES = [
  'tt-person-es tt-singular',
  'tt-person-tu tt-singular',
  'tt-person-vins tt-singular',
  'tt-person-vina tt-singular',
  'tt-person-mes tt-plural',
  'tt-person-jus tt-plural',
  'tt-person-vini tt-plural',
  'tt-person-vinas tt-plural',
];

/** Class suffix for one word/phrase: "citiem vārdiem" -> "citiem-vardiem". */
export const wordId = (lv) => lv.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
