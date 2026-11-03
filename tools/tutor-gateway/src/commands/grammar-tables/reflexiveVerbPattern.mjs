import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'reflexiveVerbPattern',
  summaryRu: "Vēlēties · vēlos · vēlēšos. Vēlēties — возвратный глагол «хотеть, желать». Окончание зависит от лица и времени. Третье лицо одинаково в единственном и множественном числе. После личной формы можно поставить инфинитив: Es vēlos īrēt dzīvokli.",
  notesRu: ["Это парадигма именно vēlēties, а не универсальные формы всех возвратных глаголов. Обе формы будущего jūs vēlēsieties и jūs vēlēsities засчитываются. Прошедшее ещё не означает, что желание исполнилось.","Кружки подэтапов и личный прогресс не являются частью таблицы."],
  highlightTargets: {
    'all': { labelRu: "Vēlēties · vēlos · vēlēšos", selectors: sel('.table-reflexive-pattern') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'person': { labelRu: "Кто?", selectors: sel('.tt-person') },
    'present': { labelRu: "Сейчас", selectors: sel('.tt-present') },
    'past': { labelRu: "Раньше", selectors: sel('.tt-past') },
    'future': { labelRu: "Потом", selectors: sel('.tt-future') },
    'first': { labelRu: "es · vēlos · vēlējos · vēlēšos", selectors: sel('.tt-row-first') },
    'second': { labelRu: "tu · vēlies · vēlējies · vēlēsies", selectors: sel('.tt-row-second') },
    'third': { labelRu: "viņš / viņa · vēlas · vēlējās · vēlēsies", selectors: sel('.tt-row-third') },
    'we': { labelRu: "mēs · vēlamies · vēlējāmies · vēlēsimies", selectors: sel('.tt-row-we') },
    'you': { labelRu: "jūs · vēlaties · vēlējāties · vēlēsieties / vēlēsities", selectors: sel('.tt-row-you') },
    'they': { labelRu: "viņi / viņas · vēlas · vēlējās · vēlēsies", selectors: sel('.tt-row-they') },
  },
};

