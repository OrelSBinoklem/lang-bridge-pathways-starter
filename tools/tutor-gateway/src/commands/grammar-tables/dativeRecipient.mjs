import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'dativeRecipient',
  summaryRu: "Kas dod? · Kam? · Ko?. В этой модели dot получатель отвечает на kam? и стоит в дательном; передаваемый предмет отвечает на ko? и стоит в винительном: Es dodu māsai tēju. Личная форма dot зависит от того, кто даёт.",
  notesRu: ["Не путай получателя и предмет: māsai — кому, tēju — что. Порядок слов может меняться; только в заданиях на сборку задан порядок «кому → что». Другие значения dot и конструкции с предлогами здесь не обобщаются.", 'Кнопки подэтапов и личный прогресс не являются частью таблицы.'],
  highlightTargets: {
    'all': { labelRu: "Kas dod? · Kam? · Ko?", selectors: sel('.table-dative-recipient') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'subject': { labelRu: "Кто?", selectors: sel('.tt-subject') },
    'action': { labelRu: "Действие", selectors: sel('.tt-action') },
    'recipient': { labelRu: "Кому?", selectors: sel('.tt-recipient') },
    'object': { labelRu: "Что?", selectors: sel('.tt-object') },
    'sister': { labelRu: "Es · dodu · māsai · tēju", selectors: sel('.tt-row-sister') },
    'brother': { labelRu: "Tu · dod · brālim · maizi", selectors: sel('.tt-row-brother') },
    'mother': { labelRu: "Viņa · dod · mātei · pienu", selectors: sel('.tt-row-mother') },
    'father': { labelRu: "Mēs · dodam · tēvam · sulu", selectors: sel('.tt-row-father') },
    'grandmother': { labelRu: "Jūs · dodat · vecmāmiņai · zupu", selectors: sel('.tt-row-grandmother') },
    'parents': { labelRu: "Viņi · dod · vecākiem · minerālūdeni", selectors: sel('.tt-row-parents') },
  },
};

