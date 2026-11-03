import { sel } from './shared/pronoun.mjs';

/**
 * reportedSimple — «Atstāstījuma izteiksme vienkāršie laiki» (простые времена пересказного наклонения),
 * component TableReportedV78. Header: Kas? | Tagadne 1. persona | Nākotne 1. persona | Tagadne -ot, -oties | Nākotne -ot, -oties.
 * Two rows: domāt (domā-u, domāš-u → domāt, domāšot) and skatīties (skat-os, skatīš-os → skatoties, skatīšoties).
 * Component classes (TableReportedV78.jsx): rows tt-row-plain | tt-row-reflexive; cells (and th)
 * tt-col-person | tt-col-present-first | tt-col-future-first | tt-col-present-ot | tt-col-future-ot.
 */
export default {
  tableKey: 'reportedSimple',
  summaryRu:
    'Простые времена пересказного наклонения (atstāstījuma izteiksme). Вопрос Kas? — «любое лицо»: форма не меняется по лицам. Слева формы 1-го лица (Tagadne 1. persona, Nākotne 1. persona), справа получающиеся из них формы на -ot (у возвратных -oties). Невозвратный глагол: domā-u → domā-ot (настоящее), domāš-u → domāš-ot (будущее). Возвратный: skat-os → skat-oties, skatīš-os → skatīš-oties.',
  notesRu: [
    'Окончания -ot и -oties выделены цветом.',
    'Первая строка — невозвратный глагол (domāt), вторая — возвратный (skatīties); ячейка «любое лицо» общая для двух строк.',
    'Свёрнутый блок «Показать как изображение» под таблицей не является содержанием.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица простых времён пересказного наклонения', selectors: sel('.card.table-reported-v78') },
    title: { labelRu: 'Заголовок «Atstāstījuma izteiksme vienkāršie laiki»', selectors: sel('.reported-section-title') },
    header: { labelRu: 'Шапка таблицы', selectors: sel('thead') },
    person: { labelRu: 'Ячейка «Kas?» и «любое лицо»', selectors: sel('.tt-col-person') },
    first_person_forms: { labelRu: 'Колонки исходных форм 1-го лица (Tagadne и Nākotne 1. persona)', selectors: sel('.tt-col-present-first', '.tt-col-future-first') },
    reported_forms: { labelRu: 'Колонки итоговых форм на -ot / -oties', selectors: sel('.tt-col-present-ot', '.tt-col-future-ot') },
    present: { labelRu: 'Настоящее время: 1 лицо и форма на -ot', selectors: sel('.tt-col-present-first', '.tt-col-present-ot') },
    future: { labelRu: 'Будущее время: 1 лицо и форма на -ot', selectors: sel('.tt-col-future-first', '.tt-col-future-ot') },
    present_ot: { labelRu: 'Настоящее время на -ot, -oties (domāt, skatoties)', selectors: sel('.tt-col-present-ot') },
    future_ot: { labelRu: 'Будущее время на -ot, -oties (domāšot, skatīšoties)', selectors: sel('.tt-col-future-ot') },
    row_plain: { labelRu: 'Строка невозвратного глагола domāt', selectors: sel('tr.tt-row-plain') },
    row_reflexive: { labelRu: 'Строка возвратного глагола skatīties', selectors: sel('tr.tt-row-reflexive') },
    endings: { labelRu: 'Окончания -ot и -oties (выделены цветом)', selectors: sel('.reported-ending') },
  },
};
