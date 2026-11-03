import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'patikObjectAction',
  summaryRu: "Patīk · priekšmets vai darbība. Кому нравится — дательный. Если нравится предмет, его название в именительном: Man patīk grāmata / grāmatas. Если нравится действие — инфинитив: Man patīk lasīt. В этой модели patīk не меняется при смене человека и числа предмета; отрицание — nepatīk.",
  notesRu: ["Это продолжение таблицы patīk + инфинитив, а не её замена. Формы patīku и patīc существуют в других конструкциях, но не вместо patīk в показанной схеме. После инфинитива его собственный объект может быть винительным: patīk lasīt grāmatu.", 'Кружки подэтапов и личный прогресс не являются частью таблицы.'],
  highlightTargets: {
    'all': { labelRu: "Patīk · priekšmets vai darbība", selectors: sel('.table-patik-object-action') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'holder': { labelRu: "Кому?", selectors: sel('.tt-holder') },
    'verb': { labelRu: "Нравится", selectors: sel('.tt-verb') },
    'form': { labelRu: "Что / делать что", selectors: sel('.tt-form') },
    'meaning': { labelRu: "Смысл", selectors: sel('.tt-meaning') },
    'book': { labelRu: "man · patīk · grāmata · мне нравится книга", selectors: sel('.tt-row-book') },
    'books': { labelRu: "tev · patīk · grāmatas · тебе нравятся книги", selectors: sel('.tt-row-books') },
    'music': { labelRu: "māsai · patīk · mūzika · сестре нравится музыка", selectors: sel('.tt-row-music') },
    'read': { labelRu: "brālim · patīk · lasīt · брату нравится читать", selectors: sel('.tt-row-read') },
    'dance': { labelRu: "meitai · patīk · dejot · дочери нравится танцевать", selectors: sel('.tt-row-dance') },
    'negative': { labelRu: "mums · nepatīk · dziedāt · нам не нравится петь", selectors: sel('.tt-row-negative') },
  },
};
