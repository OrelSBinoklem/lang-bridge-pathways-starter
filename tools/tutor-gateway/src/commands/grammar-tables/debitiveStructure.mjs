import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'debitiveStructure',
  summaryRu: "Man ir jālasa grāmata. Кому необходимо действие — дательный падеж. У большинства глаголов форма jā- образуется от третьего лица настоящего: raksta → jāraksta, mācās → jāmācās. Исключение būt → jābūt. Время выражается ir / bija / būs, отрицание необходимости — nav / nebija / nebūs. В этой прямой конструкции существительное, называющее объект действия, стоит в именительном.",
  notesRu: ["Здесь только прямая конструкция с существительным. Личные местоимения mani/tevi и объект после добавленного инфинитива — отдельные случаи. Не переносим именительный на любую фразу с jā-. Nav jā- означает отсутствие необходимости, не запрет. В настоящем ir можно опустить; в отрицании nav сохраняется.","Кружки подэтапов и личный прогресс не являются частью таблицы."],
  highlightTargets: {
    'all': { labelRu: "Man ir jālasa grāmata", selectors: sel('.table-debitive-structure') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'person': { labelRu: "Кому?", selectors: sel('.tt-person') },
    'time': { labelRu: "Время", selectors: sel('.tt-time') },
    'action': { labelRu: "Действие", selectors: sel('.tt-action') },
    'object': { labelRu: "Что?", selectors: sel('.tt-object') },
    'present': { labelRu: "man · ir · jālasa · grāmata", selectors: sel('.tt-row-present') },
    'past': { labelRu: "tev · bija · jāraksta · apsveikums", selectors: sel('.tt-row-past') },
    'future': { labelRu: "viņai · būs · jāmeklē · darbs", selectors: sel('.tt-row-future') },
    'negative': { labelRu: "mums · nav · jāņem · dokumenti", selectors: sel('.tt-row-negative') },
    'reflexive': { labelRu: "jums · ir · jāmācās · действие без объекта", selectors: sel('.tt-row-reflexive') },
    'exception': { labelRu: "viņam · ir · jābūt · būt → jābūt", selectors: sel('.tt-row-exception') },
  },
};

