import { sel } from './shared/pronoun.mjs';

/**
 * comparison — SALĪDZINĀMĀS PAKĀPES (степени сравнения прилагательных). Header: title, then
 * Vienskaitlis / Daudzskaitlis, then Pamata | Pārākā | Vispārākā for each number. Four rows:
 * V (masculine) lab, V dārg, S (feminine) lab, S dārg; the V and S cells span two rows.
 * Component classes (TableComparison.jsx):
 *   rows:   tt-masculine | tt-feminine  +  tt-word-lab | tt-word-darg
 *   cells:  tt-singular | tt-plural  +  tt-positive | tt-comparative | tt-superlative ; V/S label: tt-gender-cell
 *   header: th.tt-singular / th.tt-plural (number), th with number + degree (degree row)
 * Inside a form: .comparison-suffix-ak (-āk-), .comparison-prefix-vis (vis-), .comparison-ending-masc / -fem.
 */
const NUMBERS = { singular: 'единственное число (Vienskaitlis)', plural: 'множественное число (Daudzskaitlis)' };
const DEGREES = {
  positive: 'основная степень (Pamata)',
  comparative: 'сравнительная степень (Pārākā)',
  superlative: 'превосходная степень (Vispārākā)',
};
const GENDERS = { masculine: 'мужской род (V)', feminine: 'женский род (S)' };
const WORDS = { lab: 'lab- (хороший)', darg: 'dārg- (дорогой)' };

const forms = {
  'masculine.lab': { singular: ['labs', 'labāks', 'vislabākais'], plural: ['labi', 'labāki', 'vislabākie'] },
  'masculine.darg': { singular: ['dārgs', 'dārgāks', 'visdārgākais'], plural: ['dārgi', 'dārgāki', 'visdārgākie'] },
  'feminine.lab': { singular: ['laba', 'labāka', 'vislabākā'], plural: ['labas', 'labākas', 'vislabākās'] },
  'feminine.darg': { singular: ['dārga', 'dārgāka', 'visdārgākā'], plural: ['dārgas', 'dārgākas', 'visdārgākās'] },
};

const cells = {};
for (const [gender, genderRu] of Object.entries(GENDERS)) {
  for (const [word, wordRu] of Object.entries(WORDS)) {
    for (const [number, numberRu] of Object.entries(NUMBERS)) {
      Object.keys(DEGREES).forEach((degree, i) => {
        cells[`form_${gender}_${word}_${number}_${degree}`] = {
          labelRu: `Форма: ${genderRu}, ${wordRu}, ${numberRu}, ${DEGREES[degree]} — ${forms[`${gender}.${word}`][number][i]}`,
          selectors: sel(`tr.tt-${gender}.tt-word-${word} td.tt-${number}.tt-${degree}`),
        };
      });
    }
  }
}
const rows = {};
for (const [gender, genderRu] of Object.entries(GENDERS)) {
  for (const [word, wordRu] of Object.entries(WORDS)) {
    rows[`row_${gender}_${word}`] = { labelRu: `Строка: ${genderRu}, ${wordRu}`, selectors: sel(`tr.tt-${gender}.tt-word-${word}`) };
  }
}

export default {
  tableKey: 'comparison',
  summaryRu:
    'Степени сравнения прилагательных (salīdzināmās pakāpes) на примерах lab (хороший) и dārgs (дорогой). Столбцы: единственное число (Vienskaitlis) и множественное (Daudzskaitlis), в каждом три степени — Pamata (основная: labs), Pārākā (сравнительная: lab-āk-s) и Vispārākā (превосходная: vis-lab-āk-ais). Строки: V (мужской род) и S (женский род). Сравнительная степень образуется суффиксом -āk-, превосходная добавляет приставку vis- и окончание определённой формы (-ais, -ie, -ā, -ās).',
  notesRu: [
    'Формы: мужской род ед. — labs, labāks, vislabākais; мн. — labi, labāki, vislabākie; женский род ед. — laba, labāka, vislabākā; мн. — labas, labākas, vislabākās. У dārgs всё так же.',
    'Суффикс -āk- и приставка vis- выделены в таблице цветом; окончания мужского и женского рода — своими цветами.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица степеней сравнения', selectors: sel('.card.table-comparison') },
    title: { labelRu: 'Заголовок «SALĪDZINĀMĀS PAKĀPES»', selectors: sel('.comparison-title') },
    singular: { labelRu: 'Единственное число: заголовок и три колонки', selectors: sel('.tt-singular') },
    plural: { labelRu: 'Множественное число: заголовок и три колонки', selectors: sel('.tt-plural') },
    positive: { labelRu: 'Основная степень (Pamata): заголовки и формы', selectors: sel('.tt-positive') },
    comparative: { labelRu: 'Сравнительная степень (Pārākā): заголовки и формы', selectors: sel('.tt-comparative') },
    superlative: { labelRu: 'Превосходная степень (Vispārākā): заголовки и формы', selectors: sel('.tt-superlative') },
    degree_headers: { labelRu: 'Только заголовки степеней: Pamata, Pārākā, Vispārākā', selectors: sel('thead th.tt-positive', 'thead th.tt-comparative', 'thead th.tt-superlative') },
    masculine: { labelRu: 'Мужской род (V): обе строки', selectors: sel('tr.tt-masculine') },
    feminine: { labelRu: 'Женский род (S): обе строки', selectors: sel('tr.tt-feminine') },
    gender_labels: { labelRu: 'Ячейки «V» и «S»', selectors: sel('.tt-gender-cell') },
    word_lab: { labelRu: 'Примеры с прилагательным lab- (хороший)', selectors: sel('tr.tt-word-lab') },
    word_darg: { labelRu: 'Примеры с прилагательным dārg- (дорогой)', selectors: sel('tr.tt-word-darg') },
    suffix_ak: { labelRu: 'Суффикс -āk- (сравнительная степень)', selectors: sel('.comparison-suffix-ak') },
    prefix_vis: { labelRu: 'Приставка vis- (превосходная степень)', selectors: sel('.comparison-prefix-vis') },
    endings_masculine: { labelRu: 'Окончания мужского рода (-s, -i, -ais, -ie)', selectors: sel('.comparison-ending-masc') },
    endings_feminine: { labelRu: 'Окончания женского рода (-a, -as, -ā, -ās)', selectors: sel('.comparison-ending-fem') },
    ...rows,
    ...cells,
  },
};
