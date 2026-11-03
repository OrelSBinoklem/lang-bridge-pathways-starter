/**
 * Hand-written highlight doc for the "alphabet" table: what the bot may highlight and the
 * CSS selectors (inside the table root) that find each target.
 */
export default {
  tableKey: 'alphabet',
  tableId: 0,
  title: 'ALFABETS / Алфавит',
  route: { name: 'navigate', params: { route: 'grammar' } },
  summaryRu:
    'HTML-таблица латышского алфавита: обычные буквы, долгие гласные, мягкие согласные, шипящие, дифтонги, аффрикаты и примечания по чтению.',
  highlightTargets: {
    all: {
      labelRu: 'Вся таблица алфавита',
      selectors: [{ selector: '.card.table-alphabet' }],
    },
    letters: {
      labelRu: 'Все буквы алфавита',
      selectors: [{ selector: '.alphabet-letter' }],
    },
    long_vowels: {
      labelRu: 'Долгие гласные: Ā, Ē, Ī, Ū',
      selectors: [{ selector: '.alphabet-letter.long-letter' }],
    },
    soft_letters: {
      labelRu: 'Шипящие/мягкие буквы: Č, Š, Ž',
      selectors: [{ selector: '.alphabet-letter.soft' }],
    },
    soft_sign_letters: {
      labelRu: 'Мягкие согласные: Ģ, Ķ, Ļ, Ņ',
      selectors: [
        { selector: '.alphabet-letter.soft-sign-g' },
        { selector: '.alphabet-letter.soft-sign-k' },
        { selector: '.alphabet-letter.soft-sign-l' },
        { selector: '.alphabet-letter.soft-sign-n' },
      ],
    },
    diphthongs: {
      labelRu: 'Дифтонги',
      selectors: [{ selector: '.alphabet-diphthongs-table' }],
    },
    valid_diphthongs: {
      labelRu: 'Реальные/выделенные дифтонги',
      selectors: [{ selector: '.alphabet-diphthongs-table-cell.valid' }],
    },
    affricates: {
      labelRu: 'Аффрикаты dz, dž',
      selectors: [{ selector: '#alphabet-affricates' }],
    },
    letter_a: {
      labelRu: 'Буква A',
      selectors: [{ selector: '.alphabet-letter', textStartsWith: 'A' }],
    },
    letter_ā: {
      labelRu: 'Буква Ā',
      selectors: [{ selector: '.alphabet-letter', textStartsWith: 'Ā' }],
    },
    letter_o: {
      labelRu: 'Буква O и примечание про чтение o',
      selectors: [
        { selector: '.alphabet-letter.special-o' },
        { selector: '#alphabet-note-o' },
      ],
    },
  },
};
