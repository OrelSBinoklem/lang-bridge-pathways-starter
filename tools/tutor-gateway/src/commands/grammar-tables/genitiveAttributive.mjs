import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'genitiveAttributive',
  summaryRu: "Зависимый родительный падеж. Чьё? Зависимое существительное стоит в родительном перед главным: brāļa māja. Меняем роль главного слова — brāļa сохраняется.",
  notesRu: ["Это не согласование прилагательного: liela māja → lielā mājā, но brāļa māja → brāļa mājā. Не правило всех употреблений генитива.", 'Прогресс и кнопки подэтапов не относятся к содержимому таблицы.'],
  highlightTargets: {
    all: { labelRu: "Зависимый родительный падеж", selectors: sel('.table-genitive-attributive') },
    rule: { labelRu: 'Правило', selectors: sel('.tt-rule') },
    warning: { labelRu: 'Ограничение модели', selectors: sel('.tt-warning') },
    owner: { labelRu: "Чьё? · исходное слово", selectors: sel('.tt-owner') },
    genitive: { labelRu: "Генитив", selectors: sel('.tt-genitive') },
    head: { labelRu: "Главное слово", selectors: sel('.tt-head') },
    example: { labelRu: "Словосочетание", selectors: sel('.tt-example') },
    'brother': { labelRu: "brālis · brāļa · māja · brāļa māja", selectors: sel('.tt-row-brother') },
    'sister': { labelRu: "māsa · māsas · istaba · māsas istaba", selectors: sel('.tt-row-sister') },
    'mother': { labelRu: "māte · mātes · galds · mātes galds", selectors: sel('.tt-row-mother') },
    'father': { labelRu: "tēvs · tēva · krēsls · tēva krēsls", selectors: sel('.tt-row-father') },
    'head-accusative': { labelRu: "brālis · brāļa · māju · Es redzu brāļa māju.", selectors: sel('.tt-row-head-accusative') },
    'head-locative': { labelRu: "brālis · brāļa · mājā · Es esmu brāļa mājā.", selectors: sel('.tt-row-head-locative') },
  },
};
