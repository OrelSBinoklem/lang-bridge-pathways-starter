import { sel } from './shared/pronoun.mjs';

/**
 * darbibasLaiki — «Времена глагола» (TableDarbibasLaiki): a 3x2 matrix. Rows tr.tt-row-present | past | future,
 * columns simple (Vienkāršie laiki, dl-th--simple / cells dl-cell--simple) and compound (Saliktie laiki,
 * dl-th--compound / dl-cell--compound). Every cell: name (dl-name), function (dl-func), sample (dl-sample with the
 * form marked dl-hit), Russian gloss (dl-gloss). One verb and object (izlasīt grāmatu) in every example.
 */
const CELLS = {
  present_simple: ['present', 'simple', 'Vienkāršā tagadne — происходит сейчас, повторяется или вообще: Es lasu grāmatu. (Я читаю книгу.)'],
  present_compound: ['present', 'compound', 'Saliktā tagadne — действие завершено, результат виден сейчас: Es esmu izlasījis grāmatu. (Я прочитал книгу — она прочитана.)'],
  past_simple: ['past', 'simple', 'Vienkāršā pagātne — действие происходило раньше: Vakar es lasīju grāmatu. (Вчера я читал книгу.)'],
  past_compound: ['past', 'compound', 'Saliktā pagātne — завершилось раньше другого действия в прошлом: Es jau biju izlasījis grāmatu, kad viņš to ieteica.'],
  future_simple: ['future', 'simple', 'Vienkāršā nākotne — действие произойдёт потом: Rīt es lasīšu grāmatu. (Завтра я буду читать книгу.)'],
  future_compound: ['future', 'compound', 'Saliktā nākotne — завершится раньше другого действия в будущем: Kad es būšu izlasījis grāmatu, iedošu tev.'],
};

export default {
  tableKey: 'darbibasLaiki',
  summaryRu:
    'Времена глагола: матрица «простые / сложные × настоящее / прошедшее / будущее» на одном примере (читать книгу). Простые: Es lasu grāmatu. (сейчас, повторяется), Vakar es lasīju grāmatu. (раньше), Rīt es lasīšu grāmatu. (потом). Сложные — būt в нужном времени + причастие izlasījis: Es esmu izlasījis grāmatu. (результат виден сейчас), Es jau biju izlasījis grāmatu, kad viņš to ieteica. (завершилось раньше другого действия в прошлом), Kad es būšu izlasījis grāmatu, iedošu tev. (завершится раньше другого действия в будущем). Причастие не меняется — меняется только вспомогательный глагол (esmu / biju / būšu).',
  notesRu: ['В примерах цветом выделена форма, которая иллюстрирует время: окончание или вспомогательный глагол.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица «Времена глагола»', selectors: sel('.card.table-darbibas-laiki') },
    title: { labelRu: 'Заголовок «Времена глагола»', selectors: sel('.vs-head') },
    header: { labelRu: 'Шапка: простые и сложные времена', selectors: sel('.dl-table thead') },
    header_simple: { labelRu: 'Заголовок колонки Vienkāršie laiki (простые)', selectors: sel('.dl-th--simple') },
    header_compound: { labelRu: 'Заголовок колонки Saliktie laiki (сложные)', selectors: sel('.dl-th--compound') },
    row_heads: { labelRu: 'Названия времён (Tagadne, Pagātne, Nākotne)', selectors: sel('.dl-rowhead') },
    row_present: { labelRu: 'Строка настоящего времени (Tagadne)', selectors: sel('tr.tt-row-present') },
    row_past: { labelRu: 'Строка прошедшего времени (Pagātne)', selectors: sel('tr.tt-row-past') },
    row_future: { labelRu: 'Строка будущего времени (Nākotne)', selectors: sel('tr.tt-row-future') },
    column_simple: { labelRu: 'Колонка простых времён (ячейки)', selectors: sel('td.dl-cell--simple') },
    column_compound: { labelRu: 'Колонка сложных времён (ячейки)', selectors: sel('td.dl-cell--compound') },
    cell_names: { labelRu: 'Названия времён в ячейках', selectors: sel('.dl-name') },
    functions: { labelRu: 'Пояснения, когда используется время', selectors: sel('.dl-func') },
    samples: { labelRu: 'Примеры предложений', selectors: sel('.dl-sample') },
    marked_forms: { labelRu: 'Выделенные формы в примерах (u, īju, īšu, esmu, biju, būšu)', selectors: sel('.dl-hit') },
    translations: { labelRu: 'Русские переводы', selectors: sel('.dl-gloss') },
    note: { labelRu: 'Вывод: сложное время = būt + причастие', selectors: sel('.dl-note') },
    ...Object.fromEntries(
      Object.entries(CELLS).map(([key, [row, kind, ru]]) => [`cell_${key}`, { labelRu: ru, selectors: sel(`tr.tt-row-${row} td.dl-cell--${kind}`) }]),
    ),
  },
};
