import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'modalInfinitive',
  summaryRu: "Хочу / могу + действие. Gribēt и varēt меняются по лицу и времени. Следующее действие — в инфинитиве: Es gribu braukt; Mēs varam braukt.",
  notesRu: ["Не общее правило любого второго глагола. Сравнивать с Man patīk braukt: у patīk человек в дательном, здесь подлежащее es/mēs.", 'Прогресс и кнопки подэтапов не относятся к содержимому таблицы.'],
  highlightTargets: {
    all: { labelRu: "Хочу / могу + действие", selectors: sel('.table-modal-infinitive') },
    rule: { labelRu: 'Правило', selectors: sel('.tt-rule') },
    warning: { labelRu: 'Ограничение модели', selectors: sel('.tt-warning') },
    subject: { labelRu: "Кто?", selectors: sel('.tt-subject') },
    modal: { labelRu: "Личная форма", selectors: sel('.tt-modal') },
    infinitive: { labelRu: "Что делать?", selectors: sel('.tt-infinitive') },
    translation: { labelRu: "Смысл", selectors: sel('.tt-translation') },
    'es-gribu': { labelRu: "es · gribu · ceļot · Я хочу путешествовать.", selectors: sel('.tt-row-es-gribu') },
    'tu-vari': { labelRu: "tu · vari · braukt · Ты можешь ехать.", selectors: sel('.tt-row-tu-vari') },
    'vina-grib': { labelRu: "viņa · grib · nakšņot · Она хочет переночевать.", selectors: sel('.tt-row-vina-grib') },
    'mes-varam': { labelRu: "mēs · varam · rezervēt · Мы можем забронировать.", selectors: sel('.tt-row-mes-varam') },
    'jus-gribat': { labelRu: "jūs · gribat · zvanīt · Вы хотите позвонить.", selectors: sel('.tt-row-jus-gribat') },
    'vini-nevar': { labelRu: "viņi · nevar · braukt · Они не могут ехать.", selectors: sel('.tt-row-vini-nevar') },
  },
};
