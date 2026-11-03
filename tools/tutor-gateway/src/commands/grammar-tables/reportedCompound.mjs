import { sel } from './shared/pronoun.mjs';

/**
 * reportedCompound — «Atstāstījuma izteiksme saliktie laiki» (сложные времена пересказного наклонения),
 * component TableCompoundV79. Header: Kas? | Tagadne esot + divdabis | Nākotne būšot + divdabis.
 * Four rows: singular persons (es, tu, viņš/viņa) with zināt and skatīties, plural persons (mēs, jūs, viņi/viņas) likewise.
 * Component classes (TableCompoundV79.jsx): rows tt-persons-sg | tt-persons-pl + tt-row-plain | tt-row-reflexive;
 * cells (and th) tt-col-person | tt-col-present | tt-col-future. The person cell is merged over two rows.
 */
export default {
  tableKey: 'reportedCompound',
  summaryRu:
    'Сложные времена пересказного наклонения: вспомогательное esot (настоящее) или būšot (будущее) + причастие. Строки по лицам: es, tu, viņš, viņa — причастие на -is / -usi (возвратное -ies / -usies): esot zinājis, zinājusi; būšot zinājis, zinājusi; esot skatījies, skatījusies; būšot skatījies, skatījusies. mēs, jūs, viņi, viņas — -uši / -ušas (возвратное -ušies / -ušās): esot zinājuši, zinājušas; būšot zinājuši, zinājušas; esot skatījušies, skatījušās; būšot skatījušies, skatījušās.',
  notesRu: [
    'Слова esot и būšot выделены оранжевым, окончания причастий — цветами мужского и женского рода.',
    'В шапке колонок перечислены окончания причастий: -is, -usi, -ies, -usies и множественные формы.',
    'Ячейка с местоимениями объединяет две строки: невозвратный (zināt) и возвратный (skatīties) глагол.',
    'Свёрнутый блок «Показать как изображение» под таблицей не является содержанием.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица сложных времён пересказного наклонения', selectors: sel('.card.table-compound-v79') },
    title: { labelRu: 'Заголовок «Atstāstījuma izteiksme saliktie laiki»', selectors: sel('.compound-section-title') },
    header: { labelRu: 'Шапка таблицы', selectors: sel('thead') },
    persons: { labelRu: 'Ячейки с местоимениями', selectors: sel('tbody .tt-col-person') },
    present_column: { labelRu: 'Колонка настоящего времени (esot + причастие)', selectors: sel('.tt-col-present') },
    future_column: { labelRu: 'Колонка будущего времени (būšot + причастие)', selectors: sel('.tt-col-future') },
    singular_persons: { labelRu: 'Строки для es, tu, viņš, viņa', selectors: sel('tr.tt-persons-sg') },
    plural_persons: { labelRu: 'Строки для mēs, jūs, viņi, viņas', selectors: sel('tr.tt-persons-pl') },
    plain_verb_rows: { labelRu: 'Строки невозвратного глагола zināt', selectors: sel('tr.tt-row-plain') },
    reflexive_verb_rows: { labelRu: 'Строки возвратного глагола skatīties', selectors: sel('tr.tt-row-reflexive') },
    auxiliary_words: { labelRu: 'Слова esot и būšot (оранжевые)', selectors: sel('.tt-auxiliary') },
    endings_masculine: { labelRu: 'Окончания причастий мужского рода (-is, -ies, -uši, -ušies)', selectors: sel('.compound-ending-masc') },
    endings_feminine: { labelRu: 'Окончания причастий женского рода (-usi, -usies, -ušas, -ušās)', selectors: sel('.compound-ending-fem') },
    present_singular_plain: { labelRu: 'esot zinājis, zinājusi', selectors: sel('tr.tt-persons-sg.tt-row-plain .tt-col-present') },
    present_singular_reflexive: { labelRu: 'esot skatījies, skatījusies', selectors: sel('tr.tt-persons-sg.tt-row-reflexive .tt-col-present') },
    present_plural_plain: { labelRu: 'esot zinājuši, zinājušas', selectors: sel('tr.tt-persons-pl.tt-row-plain .tt-col-present') },
    present_plural_reflexive: { labelRu: 'esot skatījušies, skatījušās', selectors: sel('tr.tt-persons-pl.tt-row-reflexive .tt-col-present') },
    future_singular_plain: { labelRu: 'būšot zinājis, zinājusi', selectors: sel('tr.tt-persons-sg.tt-row-plain .tt-col-future') },
    future_singular_reflexive: { labelRu: 'būšot skatījies, skatījusies', selectors: sel('tr.tt-persons-sg.tt-row-reflexive .tt-col-future') },
    future_plural_plain: { labelRu: 'būšot zinājuši, zinājušas', selectors: sel('tr.tt-persons-pl.tt-row-plain .tt-col-future') },
    future_plural_reflexive: { labelRu: 'būšot skatījušies, skatījušās', selectors: sel('tr.tt-persons-pl.tt-row-reflexive .tt-col-future') },
  },
};
