import { sel } from './shared/pronoun.mjs';
import { wordTargets } from './shared/words.mjs';

/**
 * iespraudumi — «Вводные слова и выражения» (TableIespraudumi): intro, three columns ie-col--word | group | part
 * (word, word group, clause fragment), each with head (ie-col-head), list (ie-items, every li ie-item + tt-word-<id>)
 * and a sample sentence (ie-sample) where the parenthetical is marked ie-hit and commas ie-comma.
 */
const WORDS = [
  ['protams', 'конечно'], ['manuprāt', 'по-моему'], ['pirmkārt', 'во-первых'], ['šķiet', 'кажется'], ['iespējams', 'возможно'],
];
const GROUPS = [
  ['citiem vārdiem', 'другими словами'], ['taisnību sakot', 'по правде говоря'], ['pēc manām domām', 'по моему мнению'], ['paldies Dievam', 'слава богу'],
];
const PARTS = [
  ['ja atmiņa neviļ', 'если память не изменяет'], ['tas sen zināms', 'это давно известно'], ['tas nevar būt', 'не может быть'],
];

export default {
  tableKey: 'iespraudumi',
  summaryRu:
    'Вводные слова и выражения — три типа. 1) Iesprausti vārdi (вводные слова): protams — конечно, manuprāt — по-моему, pirmkārt — во-первых, šķiet — кажется, iespējams — возможно; пример Viņš, protams, nāks. 2) Vārdu grupas (вводные сочетания): citiem vārdiem — другими словами, taisnību sakot — по правде говоря, pēc manām domām — по моему мнению, paldies Dievam — слава богу; пример Citiem vārdiem, mēs nokavējām. 3) Teikuma daļas (вводные предложения): ja atmiņa neviļ — если память не изменяет, tas sen zināms — это давно известно, tas nevar būt — не может быть; пример Viņš, ja atmiņa neviļ, dzīvo Cēsīs. Вводные слова показывают отношение говорящего к сказанному, их отделяют запятыми, реже скобками.',
  notesRu: ['В примерах вводная часть выделена цветом, запятые — отдельно.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица вводных слов и выражений', selectors: sel('.card.table-iespraudumi') },
    title: { labelRu: 'Заголовок «Вводные слова и выражения»', selectors: sel('.vs-head') },
    intro: { labelRu: 'Вступление: что показывают вводные слова', selectors: sel('.ie-intro') },
    column_word: { labelRu: 'Колонка «вводные слова» (Iesprausti vārdi)', selectors: sel('.ie-col--word') },
    column_group: { labelRu: 'Колонка «вводные сочетания» (Vārdu grupas)', selectors: sel('.ie-col--group') },
    column_part: { labelRu: 'Колонка «вводные предложения» (Teikuma daļas)', selectors: sel('.ie-col--part') },
    column_heads: { labelRu: 'Названия трёх колонок', selectors: sel('.ie-col-head') },
    items: { labelRu: 'Все слова и выражения списков', selectors: sel('.ie-item') },
    items_word: { labelRu: 'Список вводных слов', selectors: sel('.ie-col--word .ie-items') },
    items_group: { labelRu: 'Список вводных сочетаний', selectors: sel('.ie-col--group .ie-items') },
    items_part: { labelRu: 'Список вводных предложений', selectors: sel('.ie-col--part .ie-items') },
    samples: { labelRu: 'Все примеры предложений', selectors: sel('.ie-sample') },
    sample_word: { labelRu: 'Пример: Viņš, protams, nāks.', selectors: sel('.ie-col--word .ie-sample') },
    sample_group: { labelRu: 'Пример: Citiem vārdiem, mēs nokavējām.', selectors: sel('.ie-col--group .ie-sample') },
    sample_part: { labelRu: 'Пример: Viņš, ja atmiņa neviļ, dzīvo Cēsīs.', selectors: sel('.ie-col--part .ie-sample') },
    parentheticals: { labelRu: 'Вводные части в примерах (выделены)', selectors: sel('.ie-hit') },
    commas: { labelRu: 'Запятые в примерах (выделены)', selectors: sel('.ie-comma') },
    ...wordTargets([...WORDS, ...GROUPS, ...PARTS]),
  },
};
