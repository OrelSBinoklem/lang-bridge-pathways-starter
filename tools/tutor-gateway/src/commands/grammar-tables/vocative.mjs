import { sel } from './shared/pronoun.mjs';

/**
 * vocative — Uzrunas forma (звательный падеж). Two sections, singular and plural; each has
 * six cells (three masculine, three feminine). A cell shows the ending and example words.
 * Classes: tt-singular / tt-plural on the section header and the row; on every cell
 * tt-masculine | tt-feminine and tt-ending-<s|i|u|a|e|as|es|is>; tt-zero-ending on examples
 * that drop the ending (tēv!, mās!, māt!).
 */
const cells = (number, gender, ending) =>
  sel(`.vocative-row.tt-${number} .tt-${gender}.tt-ending-${ending}`);

export default {
  tableKey: 'vocative',
  summaryRu:
    'Звательный падеж (uzrunas forma) — форма слова при обращении. Таблица разделена на единственное (Vienskaitlis) и множественное (Daudzskaitlis) число; в каждом разделе шесть ячеек: три для мужского и три для женского рода. В ячейке показано окончание и слова-примеры (tēv!, brāli!, Miku!, mās!, māte! …).',
  notesRu: [
    'Единственное число, мужской род: -s или без окончания (tēv!), -i (brāli!), -u (Miku!).',
    'Единственное число, женский род: -a или без окончания (mās!), -e или без окончания (māt!), -s (zivs!).',
    'Множественное число: мужской род заканчивается на -i (tēvi!, brāļi!, Miki!), женский — на -as, -es, -is (mās-as!, ārst-es!, pil-is!).',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица звательного падежа', selectors: sel('.card.table-vocative') },
    sidebar: {
      labelRu: 'Вертикальный заголовок «Uzrunas forma (звательный падеж)»',
      selectors: sel('.vocative-sidebar'),
    },
    singular: { labelRu: 'Единственное число: заголовок раздела и его ячейки', selectors: sel('.tt-singular') },
    plural: { labelRu: 'Множественное число: заголовок раздела и его ячейки', selectors: sel('.tt-plural') },
    masculine: { labelRu: 'Мужской род: все ячейки', selectors: sel('.vocative-cell.tt-masculine') },
    feminine: { labelRu: 'Женский род: все ячейки', selectors: sel('.vocative-cell.tt-feminine') },
    masculine_singular: {
      labelRu: 'Мужской род, единственное число: три ячейки',
      selectors: sel('.vocative-row.tt-singular .tt-masculine'),
    },
    feminine_singular: {
      labelRu: 'Женский род, единственное число: три ячейки',
      selectors: sel('.vocative-row.tt-singular .tt-feminine'),
    },
    masculine_plural: {
      labelRu: 'Мужской род, множественное число: три ячейки',
      selectors: sel('.vocative-row.tt-plural .tt-masculine'),
    },
    feminine_plural: {
      labelRu: 'Женский род, множественное число: три ячейки',
      selectors: sel('.vocative-row.tt-plural .tt-feminine'),
    },
    masculine_s: { labelRu: 'Ед. число, м.р.: окончание -s или без окончания (tēv!)', selectors: cells('singular', 'masculine', 's') },
    masculine_i: { labelRu: 'Ед. число, м.р.: окончание -i (brāli!)', selectors: cells('singular', 'masculine', 'i') },
    masculine_u: { labelRu: 'Ед. число, м.р.: окончание -u (Miku!)', selectors: cells('singular', 'masculine', 'u') },
    feminine_a: { labelRu: 'Ед. число, ж.р.: окончание -a или без окончания (mās!)', selectors: cells('singular', 'feminine', 'a') },
    feminine_e: { labelRu: 'Ед. число, ж.р.: окончание -e или без окончания (māt!)', selectors: cells('singular', 'feminine', 'e') },
    feminine_s: { labelRu: 'Ед. число, ж.р.: окончание -s (zivs!)', selectors: cells('singular', 'feminine', 's') },
    plural_masculine_i: {
      labelRu: 'Мн. число, м.р.: окончание -i во всех трёх ячейках (tēvi!, brāļi!, Miki!)',
      selectors: sel('.vocative-row.tt-plural .tt-masculine.tt-ending-i'),
    },
    plural_feminine_as: { labelRu: 'Мн. число, ж.р.: окончание -as (mās-as!)', selectors: cells('plural', 'feminine', 'as') },
    plural_feminine_es: { labelRu: 'Мн. число, ж.р.: окончание -es (ārst-es!)', selectors: cells('plural', 'feminine', 'es') },
    plural_feminine_is: { labelRu: 'Мн. число, ж.р.: окончание -is (pil-is!)', selectors: cells('plural', 'feminine', 'is') },
    endings: {
      labelRu: 'Все окончания (выделены цветом)',
      selectors: sel('.vocative-ending-masc', '.vocative-ending-fem'),
    },
    endings_masculine: { labelRu: 'Окончания мужского рода', selectors: sel('.vocative-ending-masc') },
    endings_feminine: { labelRu: 'Окончания женского рода', selectors: sel('.vocative-ending-fem') },
    examples: { labelRu: 'Слова-примеры (tēv!, brāli!, mās! …)', selectors: sel('.vocative-example') },
    zero_ending: {
      labelRu: 'Примеры без окончания: обращение без -s / -a / -e (tēv!, mās!, māt!)',
      selectors: sel('.tt-zero-ending'),
    },
  },
};
