/**
 * Highlight doc for the "declensions" table (TableDeclensions.jsx).
 *
 * Selectors use the named `tt-*` classes that the component puts on its tags:
 *   rows:    tt-singular | tt-plural, tt-nominative | tt-genitive | tt-dative | tt-accusative | tt-locative
 *   cells:   tt-decl-1 … tt-decl-6, tt-masculine (1-3) | tt-feminine (4-6), plus the row classes
 *   headers: tt-masculine | tt-feminine (the V / S cells), tt-case-head (case question cell)
 * Classes may combine, e.g. `.tt-decl-3.tt-genitive` is one cell of the grid.
 */
const declension = (column, gender, ru) => ({
  labelRu: ru,
  selectors: [{ selector: `th.tt-${gender}` }, { selector: `td.tt-decl-${column}` }],
});

const sixth = {
  labelRu: '6-е склонение: женский род, шестая колонка окончаний -s',
  selectors: [{ selector: 'th.tt-feminine' }, { selector: 'td.tt-decl-6' }],
};

export default {
  tableKey: 'declensions',
  tableId: 1,
  title: 'Locijumi (M+F) / Склонения существительных',
  route: { name: 'navigate', params: { route: 'grammar' } },
  summaryRu:
    'HTML-таблица обычных склонений существительных мужского и женского рода. Колонки показывают род и доминирующую гласную, строки показывают вопросы падежей в единственном и множественном числе.',
  highlightTargets: {
    all: {
      labelRu: 'Вся таблица склонений',
      selectors: [{ selector: '.card.table-declensions' }],
    },
    masculine: {
      labelRu: 'Мужской род: V, первые три колонки',
      selectors: [{ selector: 'th.tt-masculine' }, { selector: 'td.tt-masculine' }],
    },
    feminine: {
      labelRu: 'Женский род: S, последние три колонки',
      selectors: [{ selector: 'th.tt-feminine' }, { selector: 'td.tt-feminine' }],
    },
    declension_1: declension(1, 'masculine', '1-е склонение: мужской род, колонка -s/-š'),
    declension_2: declension(2, 'masculine', '2-е склонение: мужской род, колонка -is'),
    declension_3: declension(3, 'masculine', '3-е склонение: мужской род, колонка -us'),
    declension_4: declension(4, 'feminine', '4-е склонение: женский род, колонка -a'),
    declension_5: declension(5, 'feminine', '5-е склонение: женский род, колонка -e'),
    declension_6: sixth,
    declension_vi: { ...sixth, labelRu: 'VI склонение: то же, что 6-е склонение' },
    sixth_column: { ...sixth, labelRu: 'Шестой столбик/шестая колонка в таблице склонений' },
    feminine_declension_6: { ...sixth, labelRu: 'Женский род, 6-е склонение' },
    dominant_vowels: {
      labelRu: 'Доминирующие гласные над колонками',
      selectors: [{ selector: 'tr.domrow' }],
    },
    singular: {
      labelRu: 'Единственное число',
      selectors: [{ selector: 'tr.tt-singular' }],
    },
    plural: {
      labelRu: 'Множественное число',
      selectors: [{ selector: 'tr.tt-plural' }],
    },
    nominative: {
      labelRu: 'Именительный падеж: kas?',
      selectors: [{ selector: 'tr.tt-nominative' }],
    },
    genitive: {
      labelRu: 'Родительный падеж: kā?',
      selectors: [{ selector: 'tr.tt-genitive' }],
    },
    dative: {
      labelRu: 'Дательный падеж: kam?',
      selectors: [{ selector: 'tr.tt-dative' }],
    },
    accusative: {
      labelRu: 'Винительный падеж: ko?',
      selectors: [{ selector: 'tr.tt-accusative' }],
    },
    locative: {
      labelRu: 'Местный падеж: kur? kad?',
      selectors: [{ selector: 'tr.tt-locative' }],
    },
    long_vowel_mark: {
      labelRu: 'Места, где доминирующая гласная становится долгой',
      selectors: [{ selector: '.garumzime' }],
    },
    group_ii_pattern: {
      labelRu: 'Повторяющийся основной паттерн окончаний',
      selectors: [{ selector: '.group-ii' }],
    },
  },
};
