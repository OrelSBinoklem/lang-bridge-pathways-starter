import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'timeSequence',
  summaryRu: "Vakar · tagad · rīt. В этих заданиях время задано явно: vakar — прошедшее, tagad — настоящее, rīt — будущее. Затем выбирается лицо. У slēpot, slidot, sportot, vingrot и nūjot в первом лице единственного числа настоящее и прошедшее совпадают; в третьем лице оба числа имеют одну форму.",
  notesRu: ["Это проверенный набор глаголов, а не универсальные окончания всех спряжений. В обычной речи время зависит от контекста, не только от одного наречия. Будущее второго лица множественного принимается с -siet и -sit; настоящее/прошедшее различаются долготой в -jam / -jām.", 'Кружки подэтапов и личный прогресс не являются частью таблицы.'],
  highlightTargets: {
    'all': { labelRu: "Vakar · tagad · rīt", selectors: sel('.table-time-sequence') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'subject': { labelRu: "Кто?", selectors: sel('.tt-subject') },
    'past': { labelRu: "Vakar · вчера", selectors: sel('.tt-past') },
    'present': { labelRu: "Tagad · сейчас", selectors: sel('.tt-present') },
    'future': { labelRu: "Rīt · завтра", selectors: sel('.tt-future') },
    'first': { labelRu: "es · slēpoju · slēpoju · slēpošu", selectors: sel('.tt-row-first') },
    'second': { labelRu: "tu · slēpoji · slēpo · slēposi", selectors: sel('.tt-row-second') },
    'third': { labelRu: "viņš / viņa · slēpoja · slēpo · slēpos", selectors: sel('.tt-row-third') },
    'we': { labelRu: "mēs · slēpojām · slēpojam · slēposim", selectors: sel('.tt-row-we') },
    'you': { labelRu: "jūs · slēpojāt · slēpojat · slēposiet / slēposit", selectors: sel('.tt-row-you') },
    'they': { labelRu: "viņi / viņas · slēpoja · slēpo · slēpos", selectors: sel('.tt-row-they') },
  },
};
