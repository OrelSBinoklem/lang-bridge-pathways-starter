import { sel } from './shared/pronoun.mjs';

/**
 * sufiksi — «Суффиксы и словообразование» (TableSufiksi): nine cards (sf-card + tt-card-<id>; tone sf-card--noun | adj |
 * adv), each: a flow "from → to" (sf-flow, sf-chip), suffixes (sf-suffixes), meaning (sf-meaning) and three examples
 * (sf-ex: source word sf-word--src → result sf-word--res with the suffix sf-suffix, translation sf-ex-ru).
 * Keep CARDS in sync with the component.
 */
const CARDS = [
  ['doer', 'глагол → сущ.', 'Тот, кто делает', '-tājs · -ējs', 'skolotājs — учитель, lasītājs — читатель, pārdevējs — продавец'],
  ['trade', 'сущ. → сущ.', 'Профессия, занятие', '-nieks', 'zemnieks — крестьянин, dārznieks — садовник, mākslinieks — художник'],
  ['fem', 'сущ. м. → сущ. ж.', 'Женский вариант', '-a · -e · -iece', 'skolotāja — учительница, studente — студентка, dārzniece — садовница'],
  ['action', 'глагол → сущ.', 'Само действие', '-šana', 'lasīšana — чтение, rakstīšana — письмо (процесс), staigāšana — хождение'],
  ['adj', 'сущ. → прил.', 'Признак по предмету', '-īgs · -ains', 'laimīgs — счастливый, spēcīgs — сильный, mežains — лесистый'],
  ['quality', 'прил. → сущ.', 'Качество, свойство', '-ums · -ība', 'skaistums — красота, ātrums — скорость, veselība — здоровье'],
  ['adv', 'прил. → нареч.', 'Как? Каким образом?', '-i', 'labi — хорошо, ātri — быстро, latviski — по-латышски'],
  ['dim', 'сущ. → сущ.', 'Уменьшительное', '-iņš · -iņa · -īte', 'galdiņš — столик, mājiņa — домик, puķīte — цветочек'],
  ['place', 'сущ. / прил. → сущ.', 'Место', '-nīca', 'slimnīca — больница, darbnīca — мастерская, kafejnīca — кафе'],
];

export default {
  tableKey: 'sufiksi',
  summaryRu:
    'Суффиксы и словообразование — девять карточек «откуда → куда, значение, суффиксы, три примера». ' +
    CARDS.map(([, flow, ru, suf, ex]) => `${ru} (${flow}; ${suf}): ${ex}`).join('. ') +
    '. Зелёным выделен суффикс. Перед суффиксом основа часто немного меняется (pārdot → pārdevējs, spēks → spēcīgs) — такие слова полезно запоминать целиком.',
  notesRu: ['Суффикс в каждом результате выделен зелёным; пометки «глагол → сущ.» показывают часть речи исходного и нового слова.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица «Суффиксы и словообразование»', selectors: sel('.card.table-sufiksi') },
    title: { labelRu: 'Заголовок «Суффиксы и словообразование»', selectors: sel('.vs-head') },
    cards: { labelRu: 'Все девять карточек', selectors: sel('.sf-card') },
    cards_noun: { labelRu: 'Карточки, где получается существительное', selectors: sel('.sf-card--noun') },
    cards_adjective: { labelRu: 'Карточка, где получается прилагательное (-īgs · -ains)', selectors: sel('.sf-card--adj') },
    cards_adverb: { labelRu: 'Карточка, где получается наречие (-i)', selectors: sel('.sf-card--adv') },
    flows: { labelRu: 'Стрелки «часть речи → часть речи» в шапках карточек', selectors: sel('.sf-flow') },
    suffix_lists: { labelRu: 'Списки суффиксов в шапках карточек', selectors: sel('.sf-suffixes') },
    meanings: { labelRu: 'Значения суффиксов (Тот, кто делает; Профессия …)', selectors: sel('.sf-meaning') },
    examples: { labelRu: 'Все примеры слов', selectors: sel('.sf-ex') },
    source_words: { labelRu: 'Исходные слова', selectors: sel('.sf-word--src') },
    result_words: { labelRu: 'Получившиеся слова', selectors: sel('.sf-word--res') },
    suffixes: { labelRu: 'Суффиксы внутри слов (выделены зелёным)', selectors: sel('.sf-suffix') },
    translations: { labelRu: 'Русские переводы слов', selectors: sel('.sf-ex-ru') },
    note: { labelRu: 'Примечание: основа часто меняется (pārdot → pārdevējs)', selectors: sel('.sf-note') },
    ...Object.fromEntries(
      CARDS.flatMap(([id, flow, ru, suf, ex]) => [
        [`card_${id}`, { labelRu: `Карточка «${ru}» (${flow}, ${suf}): ${ex}`, selectors: sel(`.tt-card-${id}`) }],
        [`card_${id}_suffixes`, { labelRu: `Суффиксы «${ru}»: ${suf}`, selectors: sel(`.tt-card-${id} .sf-suffixes`) }],
      ]),
    ),
  },
};
