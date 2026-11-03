import { sel } from './shared/pronoun.mjs';

/**
 * participlesV70V71 — «ПРИЧАСТИЯ V70-V71 (Daļēji lokāmais un nelokāmais divdabis)». Two sections, each with rows
 * of base form | forms. Partly declinable participle (-dams): strādāt, klausīties with singular/plural columns;
 * indeclinable participle (-ot): domāt, gatavoties. The "show as image" block under the table is not content.
 * Component classes (TableParticipleV70v71.jsx): tt-section-partial | tt-section-indeclinable on the section titles,
 * tt-row-strada | klausi | doma | gatavo on rows, tt-col-infinitive on the base-form cell.
 */
const ROWS = {
  strada: 'strādāt: strādā-t → strādādams, strādādama; strādādami, strādādamas',
  klausi: 'klausīties: klausī-ties → klausīdamies, klausīdamās',
  doma: 'domāt: domāj-u → domājot',
  gatavo: 'gatavoties: gatavoj-os → gatavojoties',
};

export default {
  tableKey: 'participlesV70V71',
  summaryRu:
    'Два вида причастий. Частично склоняемое (daļēji lokāmais divdabis): strādā-t → strādādams, strādādama (ед. ч.), strādādami, strādādamas (мн. ч.); klausī-ties → klausīdamies, klausīdamās. Несклоняемое (nelokāmais divdabis): domāj-u → domājot; gatavoj-os → gatavojoties. Колонки первого блока — Vienskaitlis и Daudzskaitlis.',
  notesRu: [
    'Суффиксы -dam- и -ot выделены цветом, окончания -s / -a / -i / -as — отдельными цветами.',
    'Под таблицей есть свёрнутый блок «Показать как изображение», он не часть таблицы.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица причастий V70–V71', selectors: sel('.card.table-participle-v70v71') },
    title: { labelRu: 'Заголовок «ПРИЧАСТИЯ V70-V71»', selectors: sel('.card.table-participle-v70v71 h2') },
    partial_title: { labelRu: 'Заголовок «Daļēji lokāmais divdabis» (частично склоняемое причастие)', selectors: sel('.tt-section-partial') },
    indeclinable_title: { labelRu: 'Заголовок «Nelokāmais divdabis» (несклоняемое причастие)', selectors: sel('.tt-section-indeclinable') },
    number_header: { labelRu: 'Подзаголовок Vienskaitlis / Daudzskaitlis', selectors: sel('.participle-v70v71-subheader') },
    base_forms: { labelRu: 'Колонка базовых форм (strādā-t, klausī-ties, domāj-u, gatavoj-os)', selectors: sel('.tt-col-infinitive') },
    partial_rows: { labelRu: 'Строки частично склоняемого причастия (strādāt, klausīties)', selectors: sel('.tt-row-strada', '.tt-row-klausi') },
    indeclinable_rows: { labelRu: 'Строки несклоняемого причастия (domāt, gatavoties)', selectors: sel('.tt-row-doma', '.tt-row-gatavo') },
    suffix_dam: { labelRu: 'Суффиксы -dam- и -ot (выделены цветом)', selectors: sel('.participle-v70v71-ending-dam-orange') },
    endings_masculine: { labelRu: 'Окончания мужского рода (-s, -i)', selectors: sel('.participle-v70v71-ending-dam') },
    endings_feminine: { labelRu: 'Окончания женского рода (-a, -as)', selectors: sel('.participle-v70v71-ending-dama') },
    ...Object.fromEntries(Object.entries(ROWS).map(([id, ru]) => [`row_${id}`, { labelRu: ru, selectors: sel(`.tt-row-${id}`) }])),
  },
};
