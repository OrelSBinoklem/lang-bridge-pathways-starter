import { sel } from './pronoun.mjs';

/**
 * Shared builder for the irregular-verb tables (VerbsTablesContainer, 2 … 5). Every verb is a card:
 * a header (lemma + Russian translation) and one row per listed person; a row has the person label and
 * three form cells — past, present, future (the tables have no column headings, this is our naming).
 * Component classes (see codemod-verbs-container in .tmp or the components themselves):
 *   card:  tt-verb + tt-verb-<ascii lemma>          header: tt-verb-head, spans tt-verb-word / tt-verb-translation
 *   rows:  tt-verb-row + tt-person-es | tu | third | mes | jus
 *   cells: tt-person-label | tt-past | tt-present | tt-future
 * The parts of a form that differ from the regular pattern are wrapped in .c3 (es of esmu also .c3-es).
 */
export const PERSON_RU = {
  es: 'es (я)',
  tu: 'tu (ты)',
  third: '3 лицо (он, она, они)',
  mes: 'mēs (мы)',
  jus: 'jūs (вы)',
};
const TENSE_RU = { past: 'прошедшее', present: 'настоящее', future: 'будущее' };

/**
 * verbs: [{ id, lemma, ru, rows: { es: { past, present, future }, tu: {…} } }] — forms are the text shown
 * in the table (omit or '' for an empty cell). `id` is the class suffix (ascii lemma).
 */
export function buildIrregularVerbTargets(verbs) {
  const targets = {};
  for (const verb of verbs) {
    const card = `.tt-verb-${verb.id}`;
    const persons = Object.keys(verb.rows);
    const tenses = ['past', 'present', 'future'].filter((tense) => persons.some((p) => verb.rows[p][tense]));
    targets[`verb_${verb.id}`] = {
      labelRu: `Глагол ${verb.lemma} — ${verb.ru}: вся карточка`,
      selectors: sel(card),
    };
    targets[`verb_${verb.id}_head`] = {
      labelRu: `Заголовок карточки: ${verb.lemma} — ${verb.ru}`,
      selectors: sel(`${card} .tt-verb-head`),
    };
    for (const tense of tenses) {
      const forms = persons.filter((p) => verb.rows[p][tense]).map((p) => verb.rows[p][tense]).join(', ');
      targets[`verb_${verb.id}_${tense}`] = {
        labelRu: `${verb.lemma}: ${TENSE_RU[tense]} время (${forms})`,
        selectors: sel(`${card} .tt-${tense}`),
      };
    }
    for (const person of persons) {
      targets[`verb_${verb.id}_${person}`] = {
        labelRu: `${verb.lemma}: строка ${PERSON_RU[person]} (${['past', 'present', 'future'].map((t) => verb.rows[person][t]).filter(Boolean).join(', ')})`,
        selectors: sel(`${card} .tt-person-${person}`),
      };
      for (const tense of tenses) {
        if (!verb.rows[person][tense]) continue;
        targets[`verb_${verb.id}_${person}_${tense}`] = {
          labelRu: `${verb.lemma}: ${PERSON_RU[person]}, ${TENSE_RU[tense]} время — ${verb.rows[person][tense]}`,
          selectors: sel(`${card} .tt-person-${person} .tt-${tense}`),
        };
      }
    }
  }
  return targets;
}

/** Targets common to every irregular-verb table. */
export function commonIrregularVerbTargets() {
  return {
    all_verbs: { labelRu: 'Все карточки с глаголами', selectors: sel('.tt-verb') },
    verb_words: { labelRu: 'Все глаголы в инфинитиве (заголовки карточек)', selectors: sel('.tt-verb-word') },
    translations: { labelRu: 'Русские переводы глаголов', selectors: sel('.tt-verb-translation') },
    persons: { labelRu: 'Все ячейки с местоимениями (es, tu, 3 pers., mēs, jūs)', selectors: sel('.tt-person-label') },
    past_forms: { labelRu: 'Все формы прошедшего времени', selectors: sel('.tt-past') },
    present_forms: { labelRu: 'Все формы настоящего времени', selectors: sel('.tt-present') },
    future_forms: { labelRu: 'Все формы будущего времени', selectors: sel('.tt-future') },
    irregular_parts: { labelRu: 'Цветом выделены части форм, отличающиеся от правильного спряжения', selectors: sel('.tt-verb .c3') },
  };
}
