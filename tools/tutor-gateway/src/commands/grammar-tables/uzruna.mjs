import { sel } from './shared/pronoun.mjs';

/**
 * uzruna — «Обращение и группа обращения» (TableUzruna): two definitions, a table (rows: position of the address
 * in the sentence; columns: Uzruna | Uzrunas grupa) and a note about commas.
 * Component classes: rows tt-pos-start | tt-pos-middle | tt-pos-end, cells tt-single | tt-group;
 * existing uz-addr (the address itself) and uz-comma.
 */
export default {
  tableKey: 'uzruna',
  summaryRu:
    'Обращение (uzruna) — одно слово, которым обращаются к человеку, всегда в звательном падеже (Kārli! Anna! tēv! māt!). Группа обращения (uzrunas grupa) — обращение + поясняющее слово (Godātie viesi! Mīļais brāli!). Таблица показывает, где стоит обращение. В начале: Kārli, nāc vakariņās! / Godātie viesi, laipni lūdzam! В середине: Vai tu, Anna, zini atbildi? / Priecājos, mīļais brāli, tevi redzēt! В конце: Paldies, tēv! / Uz redzēšanos, dārgie klausītāji! Правило: обращение отделяют запятыми с обеих сторон (в начале и в конце — с одной).',
  notesRu: ['Само обращение в примерах выделено цветом, запятые тоже выделены отдельно.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица про обращение', selectors: sel('.card.table-uzruna') },
    title: { labelRu: 'Заголовок «Обращение и группа обращения»', selectors: sel('.vs-head') },
    definitions: { labelRu: 'Определения Uzruna и Uzrunas grupa', selectors: sel('.uz-defs') },
    definition_uzruna: { labelRu: 'Определение Uzruna (одно слово в звательном падеже)', selectors: sel('.tt-def-uzruna') },
    definition_group: { labelRu: 'Определение Uzrunas grupa (обращение + поясняющее слово)', selectors: sel('.tt-def-group') },
    header: { labelRu: 'Шапка таблицы: Где стоит | Uzruna | Uzrunas grupa', selectors: sel('.uz-table thead') },
    position_labels: { labelRu: 'Колонка «где стоит» (в начале, в середине, в конце)', selectors: sel('.uz-rowhead') },
    single_column: { labelRu: 'Колонка Uzruna (одно слово)', selectors: sel('td.tt-single') },
    group_column: { labelRu: 'Колонка Uzrunas grupa', selectors: sel('td.tt-group') },
    row_start: { labelRu: 'Обращение в начале предложения', selectors: sel('tr.tt-pos-start') },
    row_middle: { labelRu: 'Обращение в середине предложения', selectors: sel('tr.tt-pos-middle') },
    row_end: { labelRu: 'Обращение в конце предложения', selectors: sel('tr.tt-pos-end') },
    addresses: { labelRu: 'Сами обращения в примерах (выделены)', selectors: sel('.uz-addr') },
    commas: { labelRu: 'Запятые вокруг обращений', selectors: sel('.uz-comma') },
    translations: { labelRu: 'Русские переводы примеров', selectors: sel('.uz-ru') },
    note: { labelRu: 'Вывод: обращение отделяют запятыми с обеих сторон', selectors: sel('.uz-note') },
  },
};
