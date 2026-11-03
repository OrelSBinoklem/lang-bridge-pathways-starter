import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'prepositionNumber',
  summaryRu: "Ar ko? · Viens / vairāki. После ar в единственном числе форма существительного совпадает с винительным, во множественном — с дательным: ar vilcienu / ar vilcieniem. Прилагательное принимает то же число и падеж: ar jaunu vilcienu / ar jauniem vilcieniem.",
  notesRu: ["Это только модель ar: средство передвижения или спутник. Не переносить правило единственного числа на все предлоги. В традиционном описании сочетание с ar называется инструменталисом; здесь формы сравниваются с винительным и дательным. Для prāmis и brālis во множественном есть чередование: prāmjiem, brāļiem.", 'Кружки подэтапов и личный прогресс не являются частью таблицы.'],
  highlightTargets: {
    'all': { labelRu: "Ar ko? · Viens / vairāki", selectors: sel('.table-preposition-number') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'base': { labelRu: "Исходное слово", selectors: sel('.tt-base') },
    'singular': { labelRu: "Один / одна", selectors: sel('.tt-singular') },
    'plural': { labelRu: "Несколько", selectors: sel('.tt-plural') },
    'role': { labelRu: "Смысл", selectors: sel('.tt-role') },
    'train': { labelRu: "vilciens · ar vilcienu · ar vilcieniem · на поезде / поездах", selectors: sel('.tt-row-train') },
    'bus': { labelRu: "autobuss · ar autobusu · ar autobusiem · на автобусе / автобусах", selectors: sel('.tt-row-bus') },
    'ferry': { labelRu: "prāmis · ar prāmi · ar prāmjiem · на пароме / паромах", selectors: sel('.tt-row-ferry') },
    'brother': { labelRu: "brālis · ar brāli · ar brāļiem · с братом / братьями", selectors: sel('.tt-row-brother') },
    'sister': { labelRu: "māsa · ar māsu · ar māsām · с сестрой / сёстрами", selectors: sel('.tt-row-sister') },
    'adjective': { labelRu: "jauns vilciens · ar jaunu vilcienu · ar jauniem vilcieniem · прилагательное + имя", selectors: sel('.tt-row-adjective') },
  },
};
