import { sel } from './shared/pronoun.mjs';

/**
 * vardaSastavs — «Структура слова» (TableVardaSastavs): a table where two words are split into morphemes:
 * ne-pār-rakst-∅-īj-a (nepārrakstīja) and māc-īt-āj-s (mācītājs). Rows: two word rows (vs-word-row + tt-word-neparrakstija |
 * tt-word-macitajs), column heads (priedēklis, priedēklis, sakne, piedēklis, piedēklis, galotne), Russian labels, and
 * two group bars (celms — основа, izskaņa — финальная часть). Cells: vs-m--prefix | root | suffix | ending (vs-m--empty
 * for missing parts). Below: three notes (tt-note-saliktenis | pamatvards | atvasinatais).
 */
export default {
  tableKey: 'vardaSastavs',
  summaryRu:
    'Структура слова (vārda sastāvs) на двух примерах. Слово nepārrakstīja: ne (priedēklis, приставка) + pār (priedēklis) + rakst (sakne, корень) + īj (piedēklis, суффикс) + a (galotne, окончание). Слово mācītājs: māc (sakne) + īt (piedēklis) + āj (piedēklis) + s (galotne); приставок нет. Внизу: celms — основа (всё кроме окончания) и izskaņa — финальная часть (последний суффикс с окончанием). Определения: saliktenis — составное слово с двумя корнями и больше (saules + puķe → saulespuķe); pamatvārds — простое, исходное слово (одна основа без приставок и суффиксов); atvasinātais vārds — производное слово (от основы с приставками или суффиксами).',
  notesRu: [
    'Пустые ячейки (·) означают, что этой части в слове нет.',
    'Цвета: приставки, корень, суффиксы и окончание в таблице выделены разными цветами.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица «Структура слова»', selectors: sel('.card.table-varda-sastavs') },
    title: { labelRu: 'Заголовок «Структура слова»', selectors: sel('.vs-head') },
    word_neparrakstija: { labelRu: 'Разбор слова nepārrakstīja (ne-pār-rakst-īj-a)', selectors: sel('.tt-word-neparrakstija') },
    word_macitajs: { labelRu: 'Разбор слова mācītājs (māc-īt-āj-s)', selectors: sel('.tt-word-macitajs') },
    prefixes: { labelRu: 'Приставки (ne, pār)', selectors: sel('.vs-word-row .vs-m--prefix') },
    roots: { labelRu: 'Корни (rakst, māc)', selectors: sel('.vs-word-row .vs-m--root') },
    suffixes: { labelRu: 'Суффиксы (īj, īt, āj)', selectors: sel('.vs-word-row .vs-m--suffix') },
    endings: { labelRu: 'Окончания (a, s)', selectors: sel('.vs-word-row .vs-m--ending') },
    missing_parts: { labelRu: 'Пустые ячейки, где части в слове нет', selectors: sel('.vs-m--empty') },
    latvian_labels: { labelRu: 'Строка с латышскими названиями частей (priedēklis, sakne, piedēklis, galotne)', selectors: sel('.vs-colheads') },
    russian_labels: { labelRu: 'Строка с русскими названиями (приставка, корень, суффикс, окончание)', selectors: sel('.vs-label-row') },
    stem_bar: { labelRu: 'Полоса «celms — основа»', selectors: sel('.vs-group--stem') },
    tail_bar: { labelRu: 'Полоса «izskaņa — финальная часть»', selectors: sel('.vs-group--tail') },
    notes: { labelRu: 'Все три определения внизу', selectors: sel('.vs-notes') },
    note_compound: { labelRu: 'Определение saliktenis — составное слово', selectors: sel('.tt-note-saliktenis') },
    note_base_word: { labelRu: 'Определение pamatvārds — исходное слово', selectors: sel('.tt-note-pamatvards') },
    note_derived: { labelRu: 'Определение atvasinātais vārds — производное слово', selectors: sel('.tt-note-atvasinatais') },
  },
};
