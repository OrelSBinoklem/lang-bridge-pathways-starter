import { sel } from './shared/pronoun.mjs';

/**
 * participles — «Divdabis» table (component TableParticipleSuper2): a flex grid, not an HTML table.
 * Header: type | base form | participle (singular, plural; each cell holds indefinite and, on a second line, definite forms).
 * Rows (top to bottom): active present (top-u), active past (nes-u), reflexive past (skatīj-os), a note about them,
 * passive present (ved-u), a note about -āms/-āma, passive past (lasī-t).
 * Component classes (TableParticipleSuper2.jsx):
 *   rows:  tt-active-present | tt-active-past | tt-reflexive-row | tt-passive-present | tt-passive-past |
 *          tt-note-row + tt-active-note | tt-passive-present-note ; header rows tt-head-main, tt-head-number
 *   cells: tt-col-type | tt-col-base | tt-col-singular | tt-col-plural | tt-col-note
 */
export default {
  tableKey: 'participles',
  summaryRu:
    'Причастия (divdabji) в действительном и страдательном залоге. Колонки: тип причастия, базовая форма (основа) и сами причастия в единственном (Vienskaitlis) и множественном (Daudzskaitlis) числе, в каждой ячейке неопределённые формы и во второй строке определённые. Действ. залог, наст. время: top-u → topošs, topoša / topošais, topošā; topoši, topošas / topošie, topošās. Действ. залог, прош. время: nes-u → nesis, nesusi / nesušais, nesusī; nesuši, nesušas / nesušie, nesušās; возвратный skatīj-os → skatījies, skatījusies / skatījušies, skatījušās. Страдат. залог, наст. время: ved-u → vedams, vedama / vedamais, vedamā; vedami, vedamas / vedamie, vedamās. Страдат. залог, прош. время: lasī-t → lasīts, lasīta / lasītais, lasītā; lasīti, lasītas / lasītie, lasītās.',
  notesRu: [
    'Примечание к действительному прошедшему: невозвратные склоняются обычно с неопределёнными и определёнными окончаниями и суффиксом uš; возвратные — только с определёнными окончаниями и суффиксом uš, после которого добавляется s.',
    'Примечание к страдательному настоящему: если основа 3-го лица оканчивается на согласную или глагол возвратный, то -āms/-āma.',
    'В таблице цветом выделены суффиксы (oš, uš, am, t) и окончания мужского и женского рода.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица причастий', selectors: sel('.card.table-participle-super') },
    header: { labelRu: 'Заголовок: тип причастия, базовая форма, причастие', selectors: sel('.tt-head-main') },
    number_header: { labelRu: 'Подзаголовок Vienskaitlis / Daudzskaitlis', selectors: sel('.tt-head-number') },
    type_column: { labelRu: 'Колонка с типом причастия (залог и время)', selectors: sel('.tt-col-type') },
    base_column: { labelRu: 'Колонка базовой формы (top-u, nes-u, skatīj-os, ved-u, lasī-t)', selectors: sel('.tt-col-base') },
    singular: { labelRu: 'Колонка единственного числа', selectors: sel('.tt-col-singular') },
    plural: { labelRu: 'Колонка множественного числа', selectors: sel('.tt-col-plural') },
    active_present: { labelRu: 'Действительный залог, настоящее время (topošs …)', selectors: sel('.tt-active-present') },
    active_past: { labelRu: 'Действительный залог, прошедшее время (nesis …), вместе с возвратной строкой', selectors: sel('.tt-active-past') },
    reflexive_past: { labelRu: 'Возвратные причастия прошедшего времени (skatījies …)', selectors: sel('.tt-reflexive-row') },
    passive_present: { labelRu: 'Страдательный залог, настоящее время (vedams …)', selectors: sel('.tt-passive-present') },
    passive_past: { labelRu: 'Страдательный залог, прошедшее время (lasīts …)', selectors: sel('.tt-passive-past') },
    active_voice: { labelRu: 'Все строки действительного залога', selectors: sel('.tt-active-present', '.tt-active-past') },
    passive_voice: { labelRu: 'Все строки страдательного залога', selectors: sel('.tt-passive-present', '.tt-passive-past') },
    notes: { labelRu: 'Обе строки-примечания', selectors: sel('.tt-note-row') },
    active_note: { labelRu: 'Примечание про возвратные и невозвратные причастия', selectors: sel('.tt-active-note .tt-col-note') },
    passive_note: { labelRu: 'Примечание про -āms/-āma', selectors: sel('.tt-passive-present-note .tt-col-note') },
    suffix_os: { labelRu: 'Суффикс -oš- (действ. наст.)', selectors: sel('.participle-super-ending-os') },
    suffix_am: { labelRu: 'Суффиксы -uš-, -am-, -t- (цветом выделены суффиксы причастий)', selectors: sel('.participle-super-ending-am') },
    endings_masculine: { labelRu: 'Окончания мужского рода (-s, -is, -i, -ie, -ais …)', selectors: sel('.participle-super-ending-masc') },
    endings_feminine: { labelRu: 'Окончания женского рода (-usi, -usies …)', selectors: sel('.participle-super-ending-fem') },
  },
};
