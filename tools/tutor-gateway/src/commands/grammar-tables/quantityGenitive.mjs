import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'quantityGenitive',
  summaryRu: "Cik? · Kā?. В этих сочетаниях содержимое стоит в родительном: glāze piena, krūze tējas. Падеж слова-меры зависит от предложения: glāze piena → Es redzu glāzi piena. Содержимое остаётся в родительном.",
  notesRu: ["Это модель «мера/сосуд + содержимое», не правило «после любого количества только родительный». Слово меры и содержимое имеют разные роли; piena glāze может обозначать стакан для молока, а не количество молока.", 'Кнопки подэтапов и личный прогресс не являются частью таблицы.'],
  highlightTargets: {
    'all': { labelRu: "Cik? · Kā?", selectors: sel('.table-quantity-genitive') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'measure': { labelRu: "Мера", selectors: sel('.tt-measure') },
    'form': { labelRu: "Чего?", selectors: sel('.tt-form') },
    'phrase': { labelRu: "Группа", selectors: sel('.tt-phrase') },
    'meaning': { labelRu: "Смысл", selectors: sel('.tt-meaning') },
    'milk': { labelRu: "glāze · piena · glāze piena · стакан молока", selectors: sel('.tt-row-milk') },
    'tea': { labelRu: "krūze · tējas · krūze tējas · кружка чая", selectors: sel('.tt-row-tea') },
    'juice': { labelRu: "pudele · sulas · pudele sulas · бутылка сока", selectors: sel('.tt-row-juice') },
    'soup': { labelRu: "šķīvis · zupas · šķīvis zupas · тарелка супа", selectors: sel('.tt-row-soup') },
    'sugar': { labelRu: "karote · cukura · karote cukura · ложка сахара", selectors: sel('.tt-row-sugar') },
    'acc': { labelRu: "glāzi · piena · Es redzu glāzi piena. · вижу стакан молока", selectors: sel('.tt-row-acc') },
  },
};

