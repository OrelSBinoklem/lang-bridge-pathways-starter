import { sel } from './shared/pronoun.mjs';

/**
 * diminutives — Diminutīvi (уменьшительно-ласкательные формы), component TableWord32. One table with columns
 * Dzimte | Deklinācija | Galotne | Piedēklis | Kā to izdarīt? | Piemērs and six rows (declensions I–VI);
 * the gender cell spans three rows (Vīriešu: I–III, Sieviešu: IV–VI). Below is a collapsed
 * "show as image" block that is not part of the table content.
 * Component classes (TableWord32.jsx):
 *   columns (th and td): tt-col-gender | tt-col-declension | tt-col-ending | tt-col-suffix | tt-col-how | tt-col-example
 *   rows: tt-decl-1 … tt-decl-6 ; existing: word32-masculine / word32-feminine, word32-suffix (the suffix inside "how")
 */
const DECLENSIONS = [
  [1, 'I', 'мужской род', '-s, -š', '-iņ-', 'Traktor- + -iņ- + -š', 'traktoriņš'],
  [2, 'II', 'мужской род', '-is', '-īt-', 'Lāc- + -īt- + -is', 'lācītis'],
  [3, 'III', 'мужской род', '-us', '-iņ-', 'Med- + -iņ- + -š', 'mediņš'],
  [4, 'IV', 'женский род', '-a', '-iņ-', 'Ak- + -iņ- + -a', 'aciņa'],
  [5, 'V', 'женский род', '-e', '-īt-', 'Bit- + -īt- + -e', 'bitīte'],
  [6, 'VI', 'женский род', '-s', '-iņ-, -sniņ-, -tiņ-', 'Haiziv- + -tiņ- + -a', 'haizivtiņa'],
];

const rowTargets = {};
for (const [n, roman, gender, ending, suffix, how, example] of DECLENSIONS) {
  rowTargets[`declension_${roman.toLowerCase()}`] = {
    labelRu: `Строка ${roman} склонения (${gender}, окончание ${ending}): суффикс ${suffix}, «${how}» → ${example}`,
    selectors: sel(`tr.tt-decl-${n}`),
  };
  rowTargets[`example_${example}`] = { labelRu: `Пример «${example}» (${roman} склонение)`, selectors: sel(`tr.tt-decl-${n} .tt-col-example`) };
}

export default {
  tableKey: 'diminutives',
  summaryRu:
    'Уменьшительно-ласкательные формы существительных (diminutīvi). Таблица по склонениям: I (окончание -s, -š, суффикс -iņ-: traktoriņš), II (-is, -īt-: lācītis), III (-us, -iņ-: mediņš), IV (-a, -iņ-: aciņa), V (-e, -īt-: bitīte), VI (-s, суффиксы -iņ-, -sniņ-, -tiņ-: haizivtiņa). Колонки: Dzimte (род), Deklinācija, Galotne (окончание), Piedēklis (суффикс), «Kā to izdarīt?» (как образуется), Piemērs (пример).',
  notesRu: [
    'Мужской род (Vīriešu) — I, II и III склонения; женский (Sieviešu) — IV, V и VI; ячейка рода объединяет три строки.',
    'В колонке суффиксов у строк с -iņ- ячейка подкрашена (I и III — синим, IV и VI — жёлтым); сам суффикс в колонке «Kā to izdarīt?» выделен.',
    'Под таблицей есть свёрнутый блок «Показать как изображение» — он не является частью таблицы.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица уменьшительных форм', selectors: sel('.word32-table-wrapper') },
    title: { labelRu: 'Заголовок «Уменьшительно-ласкательные (Diminutīvi)»', selectors: sel('.word32-title', '.word32-section-title') },
    header: { labelRu: 'Строка заголовков таблицы', selectors: sel('.word32-table thead') },
    masculine: { labelRu: 'Мужской род (Vīriešu): склонения I–III', selectors: sel('tr.word32-masculine') },
    feminine: { labelRu: 'Женский род (Sieviešu): склонения IV–VI', selectors: sel('tr.word32-feminine') },
    gender_cells: { labelRu: 'Ячейки «Vīriešu» и «Sieviešu»', selectors: sel('td.word32-gender-cell') },
    declensions: { labelRu: 'Колонка склонений (I–VI)', selectors: sel('.tt-col-declension') },
    endings: { labelRu: 'Колонка окончаний (Galotne)', selectors: sel('.tt-col-ending') },
    suffixes: { labelRu: 'Колонка суффиксов (Piedēklis)', selectors: sel('.tt-col-suffix') },
    how_to: { labelRu: 'Колонка «Kā to izdarīt?» (схема образования)', selectors: sel('.tt-col-how') },
    examples: { labelRu: 'Колонка примеров (Piemērs)', selectors: sel('.tt-col-example') },
    suffix_in_formula: { labelRu: 'Суффиксы, выделенные внутри схемы образования', selectors: sel('.word32-suffix') },
    suffix_in: { labelRu: 'Суффикс -iņ- (I, III, IV и VI склонения)', selectors: sel('tr.tt-decl-1 .tt-col-suffix', 'tr.tt-decl-3 .tt-col-suffix', 'tr.tt-decl-4 .tt-col-suffix', 'tr.tt-decl-6 .tt-col-suffix') },
    suffix_it: { labelRu: 'Суффикс -īt- (II и V склонения)', selectors: sel('tr.tt-decl-2 .tt-col-suffix', 'tr.tt-decl-5 .tt-col-suffix') },
    ...rowTargets,
  },
};
