import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'nounAdjAgreement',
  summaryRu: 'Согласование неопределённого прилагательного liels с существительными dārzs и māja. Три падежа: именительный Kas?, винительный Ko?, местный Kur?. Четыре колонки: мужской единственный, мужской множественный, женский единственный, женский множественный. Прилагательное повторяет род, число и падеж существительного, но окончания не обязаны совпадать.',
  notesRu: [
    'Lielā mājā — местный падеж неопределённого прилагательного. Не путать с определённым lielajā mājā.',
    'Женский винительный множественного: lielas mājas, без долгой ā. Местный множественного: lielās mājās.',
    'Таблица содержит примеры форм, а не правила всех склонений. Формы liels сверены с https://tezaurs.lv/liels:1.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица согласования', selectors: sel('.table-noun-adj-agreement') },
    adjective: { labelRu: 'Формы прилагательного', selectors: sel('.tt-adjective') },
    noun: { labelRu: 'Формы существительного', selectors: sel('.tt-noun') },
    question: { labelRu: 'Падежные вопросы', selectors: sel('.tt-question') },
    rule: { labelRu: 'Правило согласования', selectors: sel('.tt-rule') },
    warning: { labelRu: 'Неопределённое и определённое окончания в местном падеже', selectors: sel('.tt-warning') },
    ...Object.fromEntries(['nominative', 'accusative', 'locative'].map(key => [key, { labelRu: `Падеж: ${key}`, selectors: sel(`.tt-${key}`) }])),
    ...Object.fromEntries(['masculine', 'feminine'].flatMap(gender => ['singular', 'plural'].map(number => [
      `${gender}_${number}`, { labelRu: `${gender} / ${number}`, selectors: sel(`.tt-${gender}.tt-${number}`) },
    ]))),
    ...Object.fromEntries(['nominative', 'accusative', 'locative'].flatMap(caseKey => ['masculine', 'feminine'].flatMap(gender => ['singular', 'plural'].map(number => [
      `${caseKey}_${gender}_${number}`, { labelRu: `${caseKey} / ${gender} / ${number}`, selectors: sel(`.tt-${caseKey} .tt-${gender}.tt-${number}`) },
    ])))),
  },
};
