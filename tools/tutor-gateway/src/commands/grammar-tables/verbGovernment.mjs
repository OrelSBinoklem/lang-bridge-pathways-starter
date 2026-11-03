import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'verbGovernment',
  summaryRu: "Par ko? · Ar ko? · Kas?. Interesēties par — интересоваться темой; nodarboties ar — заниматься деятельностью. В этом наборе после par / ar существительные только в единственном числе, форма совпадает с винительным. После patīk предмет интереса стоит в именительном, а человек — в дательном.",
  notesRu: ["Не меняй предлог по русскому переводу. Увлечение можно любить, не занимаясь им. Формы множественного числа после предлогов имеют другую модель и здесь не проверяются. Другие значения глаголов и инфинитив после patīk — отдельные подэтапы.","Кружки подэтапов и личный прогресс не являются частью таблицы."],
  highlightTargets: {
    'all': { labelRu: "Par ko? · Ar ko? · Kas?", selectors: sel('.table-verb-government') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'verb': { labelRu: "Модель", selectors: sel('.tt-verb') },
    'link': { labelRu: "Связь", selectors: sel('.tt-link') },
    'form': { labelRu: "Форма", selectors: sel('.tt-form') },
    'phrase': { labelRu: "Пример", selectors: sel('.tt-phrase') },
    'interest': { labelRu: "Es interesējos · par · sportu · Es interesējos par sportu.", selectors: sel('.tt-row-interest') },
    'activity': { labelRu: "Es nodarbojos · ar · sportu · Es nodarbojos ar sportu.", selectors: sel('.tt-row-activity') },
    'like': { labelRu: "Man patīk · без предлога · sports · Man patīk sports.", selectors: sel('.tt-row-like') },
    'musicinterest': { labelRu: "Es interesējos · par · mūziku · Es interesējos par mūziku.", selectors: sel('.tt-row-musicinterest') },
    'musicactivity': { labelRu: "Es nodarbojos · ar · mūziku · Es nodarbojos ar mūziku.", selectors: sel('.tt-row-musicactivity') },
    'musiclike': { labelRu: "Man patīk · без предлога · mūzika · Man patīk mūzika.", selectors: sel('.tt-row-musiclike') },
  },
};

