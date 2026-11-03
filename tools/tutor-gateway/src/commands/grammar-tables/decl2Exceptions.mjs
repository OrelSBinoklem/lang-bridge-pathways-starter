import { sel } from './shared/pronoun.mjs';

/**
 * decl2Exceptions — «2. DEKLINĀCIJAS LIETVĀRDI (IZŅĒMUMI)»: eight nouns in a row plus a note.
 * Component classes (TableDecl2Exceptions.jsx): tt-noun + tt-noun-<id> on every noun cell, tt-note on the
 * note cell, tt-important on «Важно:». Keep NOUNS in sync with the component.
 */
const NOUNS = [
  ['udens', 'ūdens', 'вода'],
  ['akmens', 'akmens', 'камень'],
  ['asmens', 'asmens', 'лезвие'],
  ['rudens', 'rudens', 'осень'],
  ['zibens', 'zibens', 'молния'],
  ['meness', 'mēness', 'луна'],
  ['sals', 'sāls', 'соль'],
  ['suns', 'suns', 'собака'],
];

export default {
  tableKey: 'decl2Exceptions',
  summaryRu:
    'Исключения 2-го склонения: восемь существительных — ūdens (вода), akmens (камень), asmens (лезвие), rudens (осень), zibens (молния), mēness (луна), sāls (соль), suns (собака). Все они склоняются как существительные на -is. Важно: в родительном падеже единственного числа у слов этого списка происходит смягчение согласной, а у остальных слов в родительном падеже единственного числа смягчения нет (эта фраза выделена в примечании).',
  notesRu: [
    'В таблице только слова и примечание, таблицы падежных форм нет.',
    'Формулировка в примечании про смягчение неполная; при вопросах опирайся на подсказку к таблице.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица исключений 2-го склонения', selectors: sel('.card.table-decl2-exceptions') },
    title: { labelRu: 'Заголовок «2. DEKLINĀCIJAS LIETVĀRDI (IZŅĒMUMI)»', selectors: sel('.decl2-exceptions-title') },
    nouns: { labelRu: 'Все восемь слов-исключений', selectors: sel('.tt-noun') },
    note: { labelRu: 'Примечание под словами', selectors: sel('.tt-note') },
    important: { labelRu: 'Слово «Важно:» в примечании', selectors: sel('.tt-important') },
    highlighted_phrase: {
      labelRu: 'Выделенная фраза: в родительном падеже единственного числа смягчения нет',
      selectors: sel('.decl2-exceptions-highlight'),
    },
    ...Object.fromEntries(
      NOUNS.map(([id, lv, ru]) => [`noun_${id}`, { labelRu: `Слово ${lv} — ${ru}`, selectors: sel(`.tt-noun-${id}`) }]),
    ),
  },
};
