import { sel } from './shared/pronoun.mjs';

/**
 * genitivs — «Генитивный оборот» (TableGenitivs): a definition block (gn-def with two rules tt-rule-noun-as-adjective and
 * tt-rule-head-right), a heading "В русском бывает по-разному", two blocks gn-block + tt-block-right | tt-block-left
 * with rows gn-row + tt-row-<wordId of the two Latvian words> (RU side → LV side; tokens gn-tok--head (main word),
 * gn-tok--gen (genitive noun), gn-tok--adj (Russian adjective)) and a note (gn-note); at the end a check
 * "✗ māja brāļa / ✓ brāļa māja" (gn-check).
 */
const ROWS = [
  ['darba-galds', 'right', 'рабочий стол → darba galds'],
  ['skolas-burtnica', 'right', 'школьная тетрадь → skolas burtnīca'],
  ['brala-maja', 'left', 'дом брата → brāļa māja'],
  ['latvijas-prezidents', 'left', 'президент Латвии → Latvijas prezidents'],
];

export default {
  tableKey: 'genitivs',
  summaryRu:
    'Генитивный оборот — словосочетание из главного слова и слова в родительном падеже («чей? чего?»). По сути это существительное в роли прилагательного: оно отвечает на «какой? чей?», всегда стоит в родительном падеже и не согласуется с главным словом. В латышском главное слово всегда стоит справа, в конце. В русском бывает по-разному. 1) Главное слово справа (прилагательное + существительное): рабочий стол → darba galds, школьная тетрадь → skolas burtnīca; порядок тот же, но прилагательное превращается в существительное в родительном («рабочий» = «работы»). 2) Главное слово слева (существительное + существительное в родительном): дом брата → brāļa māja, президент Латвии → Latvijas prezidents; слова меняются местами: родительный идёт вперёд, главное слово — в конец. Проверка: ✗ māja brāļa, ✓ brāļa māja.',
  notesRu: ['Цвета: главное слово, существительное в родительном и русское прилагательное выделены разными цветами; одинаковые цвета проходят через русскую и латышскую строки.'],
  highlightTargets: {
    head_role: { labelRu: 'Главное слово в примерах', selectors: sel('.tt-head') },
    genitive_role: { labelRu: 'Зависимый генитив в примерах', selectors: sel('.tt-genitive') },
    all: { labelRu: 'Вся таблица «Генитивный оборот»', selectors: sel('.card.table-genitivs') },
    title: { labelRu: 'Заголовок «Генитивный оборот»', selectors: sel('.vs-head') },
    definition: { labelRu: 'Блок с определением и правилами', selectors: sel('.gn-def') },
    definition_text: { labelRu: 'Определение: главное слово + слово в родительном падеже', selectors: sel('.gn-def-text') },
    rule_noun_as_adjective: { labelRu: 'Правило: существительное в роли прилагательного, всегда в родительном, не согласуется', selectors: sel('.tt-rule-noun-as-adjective') },
    rule_head_right: { labelRu: 'Правило: в латышском главное слово всегда справа', selectors: sel('.tt-rule-head-right') },
    russian_variants_heading: { labelRu: 'Заголовок «В русском бывает по-разному»', selectors: sel('.gn-h') },
    block_right: { labelRu: 'Блок «Главное слово справа» (прилагательное + существительное)', selectors: sel('.tt-block-right') },
    block_left: { labelRu: 'Блок «Главное слово слева» (существительное + существительное в родительном)', selectors: sel('.tt-block-left') },
    block_notes: { labelRu: 'Пояснения под обоими блоками', selectors: sel('.gn-note') },
    rows: { labelRu: 'Все четыре пары RU → LV', selectors: sel('.gn-row') },
    main_words: { labelRu: 'Главные слова (выделены)', selectors: sel('.gn-tok--head') },
    genitive_words: { labelRu: 'Существительные в родительном падеже (выделены)', selectors: sel('.gn-tok--gen') },
    russian_adjectives: { labelRu: 'Русские прилагательные (выделены)', selectors: sel('.gn-tok--adj') },
    check: { labelRu: 'Проверка: ✗ māja brāļa и ✓ brāļa māja', selectors: sel('.gn-check') },
    wrong_order: { labelRu: 'Неправильный порядок: māja brāļa', selectors: sel('.gn-bad') },
    right_order: { labelRu: 'Правильный порядок: brāļa māja', selectors: sel('.gn-good') },
    ...Object.fromEntries(ROWS.map(([id, , ru]) => [`row_${id.replace(/-/g, '_')}`, { labelRu: `Пример: ${ru}`, selectors: sel(`.tt-row-${id}`) }])),
  },
};
