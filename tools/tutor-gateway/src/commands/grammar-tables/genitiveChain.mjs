import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'genitiveChain',
  summaryRu: "Tēva brāļa māja. Главное слово называет предмет. Ближайший генитив указывает его владельца, а предыдущий генитив уточняет, о каком владельце речь: māja ← brāļa ← tēva. В этой модели оба зависимых существительных стоят в генитиве единственного числа.",
  notesRu: ["При переходе главного слова в местный зависимые генитивы сохраняются. Не переставляй владельцев: tēva brāļa māja и brāļa tēva māja описывают разные связи. Здесь только заранее заданные семейные и соседские отношения, не любая последовательность трёх существительных.","Кружки подэтапов и личный прогресс не являются частью таблицы."],
  highlightTargets: {
    'all': { labelRu: "Tēva brāļa māja", selectors: sel('.table-genitive-chain') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'first': { labelRu: "Чей?", selectors: sel('.tt-first') },
    'second': { labelRu: "Кто?", selectors: sel('.tt-second') },
    'head': { labelRu: "Предмет", selectors: sel('.tt-head') },
    'phrase': { labelRu: "Полная связь", selectors: sel('.tt-phrase') },
    'uncle': { labelRu: "tēva · brāļa · māja · tēva brāļa māja", selectors: sel('.tt-row-uncle') },
    'aunt': { labelRu: "mātes · māsas · grāmata · mātes māsas grāmata", selectors: sel('.tt-row-aunt') },
    'nephew': { labelRu: "brāļa · dēla · soma · brāļa dēla soma", selectors: sel('.tt-row-nephew') },
    'niece': { labelRu: "māsas · meitas · krēsls · māsas meitas krēsls", selectors: sel('.tt-row-niece') },
    'neighbor': { labelRu: "vecmāmiņas · kaimiņa · gulta · vecmāmiņas kaimiņa gulta", selectors: sel('.tt-row-neighbor') },
    'place': { labelRu: "tēva · brāļa · mājā · tēva brāļa mājā", selectors: sel('.tt-row-place') },
  },
};

