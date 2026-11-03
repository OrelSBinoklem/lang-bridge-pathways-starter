import { sel } from './shared/pronoun.mjs';

/**
 * numbersChart — Числа (numbers). Five columns: units 1-9, teens 11-19, tens 10-90,
 * hundreds 100-900 and an "extra" column (1000 and two compound examples, 25 and 31).
 * Component classes: tt-units | tt-teens | tt-tens | tt-hundreds | tt-extra on the columns and
 * tt-n-<number> on every number row, so the bot can point at one exact number.
 */
const STEMS = { 1: 'vien', 2: 'div', 3: 'trīs', 4: 'četr', 5: 'piec', 6: 'seš', 7: 'septiņ', 8: 'astoņ', 9: 'deviņ' };
const UNITS = { 1: 'viens', 2: 'divi', 3: 'trīs', 4: 'četri', 5: 'pieci', 6: 'seši', 7: 'septiņi', 8: 'astoņi', 9: 'deviņi' };

/** number -> Latvian word as written in the table */
function wordOf(n) {
  if (n <= 9) return UNITS[n];
  if (n > 10 && n < 20) return `${STEMS[n - 10]}padsmit`;
  if (n === 10) return 'desmit';
  if (n < 100) return n % 10 === 0 ? `${STEMS[n / 10]}desmit` : `${STEMS[Math.floor(n / 10)]}desmit ${UNITS[n % 10]}`;
  if (n === 100) return 'simts';
  if (n < 1000) return n / 100 === 3 ? 'trīs simti' : `${UNITS[n / 100]} simti`;
  return 'tūkstotis';
}

const shown = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9],
  ...[11, 12, 13, 14, 15, 16, 17, 18, 19],
  ...[10, 20, 30, 40, 50, 60, 70, 80, 90],
  ...[100, 200, 300, 400, 500, 600, 700, 800, 900],
  1000, 25, 31,
];

const numberTargets = Object.fromEntries(
  shown.map((n) => [
    `number_${n}`,
    { labelRu: `Число ${n}: ${wordOf(n)}`, selectors: sel(`.tt-n-${n}`) },
  ]),
);

export default {
  tableKey: 'numbersChart',
  summaryRu:
    'Числительные (skaitļa vārdi): пять колонок — единицы 1–9 (vien-s, div-i, trīs, četr-i …), «-надцать» 11–19 (основа + padsmit), десятки 10–90 (основа + desmit), сотни 100–900 (simt-s, div-i simt-i …) и колонка с числом 1000 (tūkstot-is) и двумя составными примерами: 25 (divdesmit pieci) и 31 (trīsdesmit viens).',
  notesRu: [
    'Слова состоят из основы и окончания: vien-s, div-i, četr-i (окончания выделены цветом), trīs окончания не имеет.',
    '11–19 образуются от основы единицы + padsmit (piecpadsmit), десятки от основы + desmit (piecdesmit).',
    'Составные числа пишутся двумя словами: десятки, затем единицы (divdesmit pieci, trīsdesmit viens).',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица чисел', selectors: sel('.card.table-numbers-chart') },
    units: { labelRu: 'Колонка единиц 1–9', selectors: sel('.tt-units') },
    teens: { labelRu: 'Колонка 11–19 (основа + padsmit)', selectors: sel('.tt-teens') },
    tens: { labelRu: 'Колонка десятков 10–90 (основа + desmit)', selectors: sel('.tt-tens') },
    hundreds: { labelRu: 'Колонка сотен 100–900', selectors: sel('.tt-hundreds') },
    extra_column: { labelRu: 'Колонка с 1000 и составными примерами 25 и 31', selectors: sel('.tt-extra') },
    digits: { labelRu: 'Все числа цифрами', selectors: sel('.num-digit') },
    words: { labelRu: 'Все числа словами', selectors: sel('.num-word') },
    endings: { labelRu: 'Окончания числительных (-s, -i, -is), выделены цветом', selectors: sel('.num-end') },
    padsmit: { labelRu: 'Часть padsmit в числах 11–19', selectors: sel('.num-padsmit') },
    desmit: { labelRu: 'Часть desmit в числах 10–90', selectors: sel('.num-desmit') },
    compound_examples: {
      labelRu: 'Составные числа 25 и 31: десятки и единицы отдельными словами',
      selectors: sel('.num-row-compound'),
    },
    ...numberTargets,
  },
};
