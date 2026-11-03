import { sel } from './shared/pronoun.mjs';

/**
 * uzrunasFormas — «Формы обращения» (TableUzrunasFormas): intro, three columns uf-col--voc | nom | acc
 * (Vokatīvs, Nominatīvs, Akuzatīvs), each with head (uf-col-head), a "when" line (uf-when) and words (uf-word:
 * dictionary form → address form, cut ending uf-cut, new ending uf-new), then a note.
 */
export default {
  tableKey: 'uzrunasFormas',
  summaryRu:
    'В обращении в латышском используют три падежа. 1) Vokatīvs (звательный) — основная форма: окончание отпадает или сокращается: tēvs → tēv!, Pēteris → Pēteri!, māte → māt! 2) Nominatīvs (именительный) — слово остаётся как есть, часто у женских имён, во множественном числе и в группах: Anna → Anna!, draugs → draugs!, bērni → bērni! 3) Akuzatīvs (винительный) — у слов 2-го и 3-го склонения, в основном в разговорной речи: Ingus → Ingu!, Mikus → Miku! Внизу пояснение: звательный падеж бывает не только у существительных, его получают и прилагательные или причастия, употреблённые вместо существительного.',
  notesRu: ['Отпадающее окончание в примерах зачёркнуто (uf-cut), новое окончание выделено цветом (uf-new).'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица форм обращения', selectors: sel('.card.table-uzrunas-formas') },
    title: { labelRu: 'Заголовок «Формы обращения»', selectors: sel('.vs-head') },
    intro: { labelRu: 'Вступление: три падежа в обращении', selectors: sel('.uf-intro') },
    column_vocative: { labelRu: 'Колонка Vokatīvs (звательный)', selectors: sel('.uf-col--voc') },
    column_nominative: { labelRu: 'Колонка Nominatīvs (именительный)', selectors: sel('.uf-col--nom') },
    column_accusative: { labelRu: 'Колонка Akuzatīvs (винительный)', selectors: sel('.uf-col--acc') },
    column_heads: { labelRu: 'Названия трёх падежей', selectors: sel('.uf-col-head') },
    when: { labelRu: 'Пояснения, когда используется каждый падеж', selectors: sel('.uf-when') },
    words: { labelRu: 'Все примеры слов', selectors: sel('.uf-word') },
    vocative_words: { labelRu: 'Примеры звательного: tēvs → tēv, Pēteris → Pēteri, māte → māt', selectors: sel('.uf-col--voc .uf-word') },
    nominative_words: { labelRu: 'Примеры именительного: Anna, draugs, bērni', selectors: sel('.uf-col--nom .uf-word') },
    accusative_words: { labelRu: 'Примеры винительного: Ingus → Ingu, Mikus → Miku', selectors: sel('.uf-col--acc .uf-word') },
    cut_endings: { labelRu: 'Отпадающие окончания (зачёркнуты)', selectors: sel('.uf-cut') },
    new_endings: { labelRu: 'Новые окончания обращения (выделены)', selectors: sel('.uf-new') },
    forms: { labelRu: 'Готовые формы обращения со знаком !', selectors: sel('.uf-form') },
    note: { labelRu: 'Вывод: звательный есть и у прилагательных и причастий', selectors: sel('.uf-note') },
  },
};
