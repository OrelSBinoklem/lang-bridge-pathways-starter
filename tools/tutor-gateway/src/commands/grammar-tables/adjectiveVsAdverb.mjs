import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'adjectiveVsAdverb',
  summaryRu: "Dārga jaka · pirkt dārgi. Прилагательное описывает предмет и согласуется: dārgs, dārga, dārgi, dārgas. Наречие описывает действие покупки и не согласуется с предметом: pirkt dārgi, pirkt lēti. Dārgi может быть и прилагательным, и наречием: решает связь в предложении.",
  notesRu: ["Первый этап — положительная степень и неопределённые прилагательные. Dārgāk / dārgāks, lētāk / lētāks и превосходная степень будут отдельным продолжением. Наречие не становится dārga только потому, что покупают jaku.","Кружки подэтапов и личный прогресс не являются частью таблицы."],
  highlightTargets: {
    'all': { labelRu: "Dārga jaka · pirkt dārgi", selectors: sel('.table-adjective-adverb') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'question': { labelRu: "Вопрос", selectors: sel('.tt-question') },
    'noun': { labelRu: "Предмет", selectors: sel('.tt-noun') },
    'sentence': { labelRu: "Фраза", selectors: sel('.tt-sentence') },
    'role': { labelRu: "Роль формы", selectors: sel('.tt-role') },
    'feminine': { labelRu: "kāda? · jaka · Jaka ir dārga. · прилагательное", selectors: sel('.tt-row-feminine') },
    'masculine': { labelRu: "kāds? · krekls · Krekls ir lēts. · прилагательное", selectors: sel('.tt-row-masculine') },
    'fplural': { labelRu: "kādas? · kurpes · Kurpes ir lētas. · прилагательное", selectors: sel('.tt-row-fplural') },
    'mplural': { labelRu: "kādi? · zābaki · Zābaki ir dārgi. · прилагательное", selectors: sel('.tt-row-mplural') },
    'buy': { labelRu: "kā? · jaku · Es pērku jaku dārgi. · наречие", selectors: sel('.tt-row-buy') },
    'buyplural': { labelRu: "kā? · zābakus · Es pērku zābakus lēti. · наречие", selectors: sel('.tt-row-buyplural') },
  },
};

