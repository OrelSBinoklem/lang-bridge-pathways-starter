import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'comparisonPattern',
  summaryRu: "Lielāks par · vislielākais. Сравнительная степень: основа + -āk- + окончание по роду и числу. Превосходная: vis- + сравнительная основа + определённое окончание. При сравнении с одним предметом после par нужен винительный: garāka par upi, augstāks par koku.",
  notesRu: ["Сравнение предполагает конкретную величину или признак, а «самый» — обозначенную группу. Здесь после par только единственное число; множественное имеет другую падежную модель. Формы существительных и прилагательных проверяются отдельно.","Кружки подэтапов и личный прогресс не являются частью таблицы."],
  highlightTargets: {
    'all': { labelRu: "Lielāks par · vislielākais", selectors: sel('.table-comparison-pattern') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'object': { labelRu: "Предмет", selectors: sel('.tt-object') },
    'base': { labelRu: "Признак", selectors: sel('.tt-base') },
    'more': { labelRu: "Сравнение", selectors: sel('.tt-more') },
    'most': { labelRu: "В группе", selectors: sel('.tt-most') },
    'forest': { labelRu: "mežs · liels · lielāks · vislielākais", selectors: sel('.tt-row-forest') },
    'river': { labelRu: "upe · gara · garāka · visgarākā", selectors: sel('.tt-row-river') },
    'tree': { labelRu: "koks · augsts · augstāks · visaugstākais", selectors: sel('.tt-row-tree') },
    'path': { labelRu: "taka · gara · garāka · visgarākā", selectors: sel('.tt-row-path') },
    'oak': { labelRu: "ozols · liels · lielāks · vislielākais", selectors: sel('.tt-row-oak') },
    'spruce': { labelRu: "egle · augsta · augstāka · visaugstākā", selectors: sel('.tt-row-spruce') },
  },
};
