import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'patikInfinitive',
  summaryRu: 'Краткая таблица: после gribu, varu, vajag и patīk следующий глагол остаётся в начальной форме. Примеры: Es gribu lasīt, Es varu runāt, Man vajag mācīties, Man patīk ceļot. На экзамене такие конструкции помогают говорить, не спрягая следующий глагол.',
  notesRu: [
    'Правило относится к показанным конструкциям, а не к любому сочетанию двух глаголов.',
    'Gribu и varu меняются по лицам и времени; с vajag и patīk в примерах используется man. Не подменять vajag конструкцией с jā-.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица: хочу, могу, нужно, нравится', selectors: sel('.table-patik-infinitive') },
    pattern: { labelRu: 'После этих слов следующий глагол не спрягается', selectors: sel('.tt-pattern') },
    modal_want: { labelRu: 'Es gribu lasīt — я хочу читать', selectors: sel('.tt-modal-want') },
    modal_can: { labelRu: 'Es varu runāt — я могу говорить', selectors: sel('.tt-modal-can') },
    vajag: { labelRu: 'Man vajag mācīties — мне нужно учиться', selectors: sel('.tt-vajag-man') },
    patik: { labelRu: 'Man patīk ceļot — мне нравится путешествовать', selectors: sel('.tt-person-man') },
    dative: { labelRu: 'Кому: man', selectors: sel('.tt-dative') },
    verb: { labelRu: 'Gribu, varu, vajag и patīk', selectors: sel('.tt-verb') },
    infinitive: { labelRu: 'Следующий глагол в начальной форме', selectors: sel('.tt-infinitive') },
    translation: { labelRu: 'Переводы примеров', selectors: sel('.tt-translation') },
    rule: { labelRu: 'Правило начальной формы', selectors: sel('.tt-rule') },
    exam: { labelRu: 'Как использовать конструкции на экзамене', selectors: sel('.tt-exam') },
  },
};
