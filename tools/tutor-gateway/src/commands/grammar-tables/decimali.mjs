import { sel } from './shared/pronoun.mjs';

/**
 * decimali — «Десятичные дроби» (component TableDecimali): a formula (veselā daļa + komats + daļa), a rule,
 * two examples (3,5 and 20,35) and a schema note. Classes: existing td-* plus tt-example-3-5 / tt-example-20-35.
 */
export default {
  tableKey: 'decimali',
  summaryRu:
    'Десятичные дроби по-латышски. Схема: veselā daļa (целая часть, например 20) + komats (запятая) + daļa (дробная часть, 35). Обычно дроби пишут цифрами; если произносят или пишут словами, между частями ставят существительное komats (выделяют его запятыми). Примеры: 3,5 — trīs, komats, pieci (три, запятая, пять); 20,35 — divdesmit, komats, trīsdesmit pieci (двадцать, запятая, тридцать пять). Схема: pamata skaitļa vārds (целая) + komats + pamata skaitļa vārds (дробная), например 3,5.',
  notesRu: ['Слово komats в примерах выделено отдельным цветом.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица о десятичных дробях', selectors: sel('.card.table-decimali') },
    title: { labelRu: 'Заголовок «Десятичные дроби»', selectors: sel('.vs-head') },
    formula: { labelRu: 'Схема десятичного числа: целая часть + запятая + дробная часть', selectors: sel('.td-formula') },
    whole_part: { labelRu: 'Целая часть (veselā daļa)', selectors: sel('.td-part--whole') },
    komats_part: { labelRu: 'Запятая (komats) в схеме', selectors: sel('.td-part--komats') },
    fraction_part: { labelRu: 'Дробная часть (daļa)', selectors: sel('.td-part--frac') },
    rule: { labelRu: 'Правило: пишут цифрами, словами между частями komats', selectors: sel('.td-rule') },
    examples: { labelRu: 'Оба примера', selectors: sel('.td-examples') },
    example_3_5: { labelRu: 'Пример 3,5 — trīs, komats, pieci', selectors: sel('.tt-example-3-5') },
    example_20_35: { labelRu: 'Пример 20,35 — divdesmit, komats, trīsdesmit pieci', selectors: sel('.tt-example-20-35') },
    komats_word: { labelRu: 'Слово komats внутри примеров', selectors: sel('.td-komats') },
    digits: { labelRu: 'Числа цифрами в примерах', selectors: sel('.td-ex-digits') },
    note: { labelRu: 'Схема внизу: pamata skaitļa vārds + komats + pamata skaitļa vārds', selectors: sel('.td-note') },
  },
};
