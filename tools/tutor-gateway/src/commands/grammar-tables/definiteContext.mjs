import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'definiteContext',
  summaryRu: "Maza dāvana · mazā dāvana. Неопределённое окончание здесь вводит ещё не выделенный предмет, определённое — указывает на уже известный и выделяемый среди других. Сначала читаем ситуацию, затем выбираем окончание и согласуем форму с существительным. Это учебный контраст, не правило «первое упоминание всегда неопределённое»: терминология, превосходная степень и устойчивые сочетания имеют свои условия.",
  notesRu: ["В заданиях нужный тип окончания задан прямо вместе с ситуацией. Без контекста не объявляем одну из двух грамматически возможных форм неверной. Здесь единственное число, именительный и винительный; остальные падежи доступны в общей таблице окончаний.","Кружки подэтапов и личный прогресс не являются частью таблицы."],
  highlightTargets: {
    'all': { labelRu: "Maza dāvana · mazā dāvana", selectors: sel('.table-definite-context') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'context': { labelRu: "Смысл", selectors: sel('.tt-context') },
    'form': { labelRu: "Форма", selectors: sel('.tt-form') },
    'noun': { labelRu: "Предмет", selectors: sel('.tt-noun') },
    'phrase': { labelRu: "Пример", selectors: sel('.tt-phrase') },
    'new-male': { labelRu: "ещё не выделенный · mazs · galds · Te ir mazs galds.", selectors: sel('.tt-row-new-male') },
    'known-male': { labelRu: "тот самый стол · mazais · galds · Mazais galds ir te.", selectors: sel('.tt-row-known-male') },
    'new-female': { labelRu: "ещё не выделенный · maza · dāvana · Te ir maza dāvana.", selectors: sel('.tt-row-new-female') },
    'known-female': { labelRu: "тот самый подарок · mazā · dāvana · Mazā dāvana ir tev.", selectors: sel('.tt-row-known-female') },
    'new-acc': { labelRu: "неопределённый · ko? · mazu · dāvanu · Es redzu mazu dāvanu.", selectors: sel('.tt-row-new-acc') },
    'known-acc': { labelRu: "определённый · ko? · mazo · dāvanu · Es redzu mazo dāvanu.", selectors: sel('.tt-row-known-acc') },
  },
};

