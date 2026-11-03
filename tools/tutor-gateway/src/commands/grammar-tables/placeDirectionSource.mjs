import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'placeDirectionSource',
  summaryRu: "Где, куда и откуда. Для этих названий в единственном числе: где — местный без предлога; куда — uz + винительный; откуда — no + родительный.",
  notesRu: ["Не всякое направление выражается через uz. Для названий во множественном числе, например Cēsis, нужна отдельная модель; здесь только единственное число.", 'Прогресс и кнопки подэтапов не относятся к содержимому таблицы.'],
  highlightTargets: {
    all: { labelRu: "Где, куда и откуда", selectors: sel('.table-place-direction-source') },
    rule: { labelRu: 'Правило', selectors: sel('.tt-rule') },
    warning: { labelRu: 'Ограничение модели', selectors: sel('.tt-warning') },
    question: { labelRu: "Вопрос", selectors: sel('.tt-question') },
    meaning: { labelRu: "Значение", selectors: sel('.tt-meaning') },
    form: { labelRu: "Форма", selectors: sel('.tt-form') },
    example: { labelRu: "Пример", selectors: sel('.tt-example') },
    'city-place': { labelRu: "Kur? · Где? · Rīgā · Es esmu Rīgā.", selectors: sel('.tt-row-city-place') },
    'city-direction': { labelRu: "Uz kurieni? · Куда? · uz Rīgu · Es braucu uz Rīgu.", selectors: sel('.tt-row-city-direction') },
    'city-source': { labelRu: "No kurienes? · Откуда? · no Rīgas · Es braucu no Rīgas.", selectors: sel('.tt-row-city-source') },
    'station-place': { labelRu: "Kur? · Где? · stacijā · Es esmu stacijā.", selectors: sel('.tt-row-station-place') },
    'station-direction': { labelRu: "Uz kurieni? · Куда? · uz staciju · Es braucu uz staciju.", selectors: sel('.tt-row-station-direction') },
    'station-source': { labelRu: "No kurienes? · Откуда? · no stacijas · Es braucu no stacijas.", selectors: sel('.tt-row-station-source') },
  },
};
