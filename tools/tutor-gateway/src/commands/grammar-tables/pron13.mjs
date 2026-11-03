import { endingTargets, genderNumberTargets, introTarget, sel } from './shared/pronoun.mjs';

/**
 * pron13 — possessives mūsu, jūsu, viņa, viņas, viņu. A real <table>: each body row has one
 * possessive (a genitive form of a personal pronoun that never changes), its case question and
 * four example nouns (masc sg, masc pl, fem sg, fem pl) that DO change. The rows carry the case
 * class (tt-nominative … tt-locative); the noun cells also carry gender/number classes.
 */
const row = (name) => sel(`tr.tt-${name}`);

export default {
  tableKey: 'pron13',
  summaryRu:
    'Притяжательные mūsu, jūsu, viņa, viņas, viņu («наш, ваш, его, её, их»). Это родительный падеж (Kā?) личных местоимений: сами слова не изменяются. Меняются только существительные рядом с ними; таблица показывает существительное в пяти падежах, в единственном и множественном числе, мужского и женского рода.',
  notesRu: [
    'Слева одна ячейка «Kā?» на все строки: местоимения стоят в форме Kā? (родительный).',
    'Колонки существительных: мужской род ед., мужской род мн., женский род ед., женский род мн.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица притяжательных', selectors: sel('.card.table-pron13') },
    ...introTarget('pron13', 'Строка с формами mūsu, jūsu, viņa, viņas, viņu и переводом'),
    possessive_forms: {
      labelRu: 'Колонка с притяжательными формами (mūsu, jūsu, viņa, viņas, viņu): они не изменяются',
      selectors: sel('.pron13-pronoun'),
    },
    possessive_endings: {
      labelRu: 'Цветные окончания притяжательных (-u, -a, -as)',
      selectors: sel('.pron13-pronoun-ending'),
    },
    noun_forms: {
      labelRu: 'Ячейки с существительными: здесь меняются падеж, род и число',
      selectors: sel('.pron13-noun-data'),
    },
    noun_header: { labelRu: 'Заголовок «Lietvārds» над колонками существительных', selectors: sel('.pron13-noun-cell') },
    case_questions: {
      labelRu: 'Колонка с вопросами падежей: Kas? Kā? Kam? Ko? Kur?',
      selectors: sel('.pron13-left-cell'),
    },
    nominative: { labelRu: 'Именительный падеж (Kas?)', selectors: row('nominative') },
    genitive: { labelRu: 'Родительный падеж (Kā?)', selectors: row('genitive') },
    dative: { labelRu: 'Дательный падеж (Kam?)', selectors: row('dative') },
    accusative: { labelRu: 'Винительный падеж (Ko?)', selectors: row('accusative') },
    locative: { labelRu: 'Местный падеж (Kur?)', selectors: row('locative') },
    ...genderNumberTargets(),
    ...endingTargets('pron13'),
  },
};
