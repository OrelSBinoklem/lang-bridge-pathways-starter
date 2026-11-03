import { sel } from './shared/pronoun.mjs';

/**
 * netiesaRuna — «Косвенная речь» (TableNetiesaRuna): intro, a table with three columns — Tiešā runa (nr-source),
 * Īstenības izteiksme (nr-ist), Atstāstījuma izteiksme (nr-ats) — and two rows (Līga, Toms), then a note.
 * Component classes: rows tt-row-1 | tt-row-2; existing nr-hit (ka, the verb) and nr-end (-ot).
 */
export default {
  tableKey: 'netiesaRuna',
  summaryRu:
    'Косвенная речь (netiešā runa) — пересказ чужих слов: кавычки исчезают, появляется ka, «я» становится «он/она». Три колонки: Tiešā runa (прямая речь), Īstenības izteiksme (уверен, что это правда) и Atstāstījuma izteiksme (передаю с чужих слов). Строка 1: Līga: „Rīt es braukšu uz Rīgu.” → Līga teica, ka viņa rīt brauks uz Rīgu. / Līga teica, ka rīt braukšot uz Rīgu. Строка 2: Toms: „Es strādāju bankā.” → Toms teica, ka viņš strādā bankā. / Toms teica, ka strādājot bankā. Пересказывательное наклонение узнаётся по окончанию -ot (strādājot, braukšot, esot) — «говорят, что…», рассказчик за точность не отвечает.',
  notesRu: [
    'Цветом выделены ka и глагол (что меняется), а также окончание -ot в пересказывательном наклонении.',
    'К каждой прямой речи дан русский перевод.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица про косвенную речь', selectors: sel('.card.table-netiesa-runa') },
    title: { labelRu: 'Заголовок «Косвенная речь»', selectors: sel('.vs-head') },
    intro: { labelRu: 'Вступление: пересказ, ka, «я» → «он/она»', selectors: sel('.nr-intro') },
    header: { labelRu: 'Шапка таблицы с тремя колонками', selectors: sel('.nr-table thead') },
    header_source: { labelRu: 'Заголовок колонки Tiešā runa (прямая речь)', selectors: sel('.nr-th-source') },
    header_realis: { labelRu: 'Заголовок колонки Īstenības izteiksme (уверен, что правда)', selectors: sel('.nr-th-ist') },
    header_reported: { labelRu: 'Заголовок колонки Atstāstījuma izteiksme (с чужих слов)', selectors: sel('.nr-th-ats') },
    column_source: { labelRu: 'Колонка прямой речи (примеры)', selectors: sel('td.nr-source') },
    column_realis: { labelRu: 'Колонка Īstenības izteiksme (примеры)', selectors: sel('td.nr-ist') },
    column_reported: { labelRu: 'Колонка Atstāstījuma izteiksme (примеры)', selectors: sel('td.nr-ats') },
    row_liga: { labelRu: 'Строка 1: Līga — rīt braukšu uz Rīgu', selectors: sel('tr.tt-row-1') },
    row_toms: { labelRu: 'Строка 2: Toms — strādāju bankā', selectors: sel('tr.tt-row-2') },
    changes: { labelRu: 'Слово ka и изменённый глагол (выделены)', selectors: sel('.nr-hit') },
    ending_ot: { labelRu: 'Окончание -ot пересказывательного наклонения', selectors: sel('.nr-end') },
    translations: { labelRu: 'Русские переводы прямой речи', selectors: sel('.nr-ru') },
    note: { labelRu: 'Вывод: -ot — «говорят, что…»', selectors: sel('.nr-note') },
  },
};
