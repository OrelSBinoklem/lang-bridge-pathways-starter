import { sel } from './shared/pronoun.mjs';
import { wordTargets } from './shared/words.mjs';

/**
 * iespraudumiKomati — «Пунктуация с вводными словами» (TableIespraudumiKomati): two columns ik-col--with (выделяем
 * запятыми, badge ✓ ,) and ik-col--without (не выделяем, badge ✗), lists of ik-item + tt-word-<id>; "trap" items
 * (ik-item--trap, with ⚠) are words whose Russian equivalents take commas but Latvian ones do not. Then a pair of
 * examples (ik-pair) and a note.
 */
const WITH = [
  ['protams', 'конечно'], ['cerams', 'надеюсь'], ['šķiet', 'кажется'], ['manuprāt', 'по-моему'], ['pirmkārt', 'во-первых'],
  ['proti', 'а именно'], ['tas ir', 'то есть'], ['kā mēdz teikt', 'как говорится'], ['pēc viņa domām', 'по его мнению'],
  ['ja atmiņa neviļ', 'если память не изменяет'],
];
const WITHOUT = [
  ['varbūt', 'может быть'], ['laikam', 'наверное'], ['patiesībā', 'на самом деле'], ['savukārt', 'в свою очередь'],
  ['galvenokārt', 'главным образом'], ['tāpat kā', 'так же как'], ['retāk', 'реже'],
];

export default {
  tableKey: 'iespraudumiKomati',
  summaryRu:
    'Пунктуация с вводными словами. Ar pieturzīmēm atdala (выделяем запятыми): protams, cerams, šķiet, manuprāt, pirmkārt, proti, tas ir, kā mēdz teikt, pēc viņa domām, ja atmiņa neviļ. Ar pieturzīmēm neatdala (не выделяем): varbūt, laikam, patiesībā, savukārt, galvenokārt, tāpat kā, retāk. Пара примеров: Viņš, protams, nāks. (с запятыми) и Viņš varbūt nāks. (без запятых; по-русски «Он, может быть, придёт»). Ловушка: varbūt, laikam, patiesībā, savukārt — в русском их аналоги выделяются запятыми, а в латышском нет (в таблице отмечены значком ⚠).',
  notesRu: ['Слова-ловушки отмечены значком ⚠ в списке «не выделяем».'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица пунктуации с вводными словами', selectors: sel('.card.table-iespraudumi-komati') },
    title: { labelRu: 'Заголовок «Пунктуация с вводными словами»', selectors: sel('.vs-head') },
    column_with: { labelRu: 'Колонка «выделяем запятыми» (Ar pieturzīmēm atdala)', selectors: sel('.ik-col--with') },
    column_without: { labelRu: 'Колонка «не выделяем» (Ar pieturzīmēm neatdala)', selectors: sel('.ik-col--without') },
    column_heads: { labelRu: 'Названия колонок с бейджами ✓ , и ✗', selectors: sel('.ik-col-head') },
    items_with: { labelRu: 'Слова, которые выделяются запятыми', selectors: sel('.ik-col--with .ik-item') },
    items_without: { labelRu: 'Слова, которые не выделяются', selectors: sel('.ik-col--without .ik-item') },
    traps: { labelRu: 'Слова-ловушки ⚠: varbūt, laikam, patiesībā, savukārt', selectors: sel('.ik-item--trap') },
    warning_icons: { labelRu: 'Значки ⚠ у слов-ловушек', selectors: sel('.ik-warn') },
    pair: { labelRu: 'Пара примеров: с запятыми и без', selectors: sel('.ik-pair') },
    pair_with_commas: { labelRu: 'Пример Viņš, protams, nāks.', selectors: sel('.tt-pair-with-commas') },
    pair_without_commas: { labelRu: 'Пример Viņš varbūt nāks.', selectors: sel('.tt-pair-without-commas') },
    marked_words: { labelRu: 'Вводные слова в примерах (выделены)', selectors: sel('.ik-hit') },
    commas: { labelRu: 'Запятые в примерах (выделены)', selectors: sel('.ik-comma') },
    note: { labelRu: 'Предупреждение-ловушка внизу', selectors: sel('.ik-note') },
    ...wordTargets([...WITH, ...WITHOUT]),
  },
};
