import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'necessityVajag',
  summaryRu: "Man vajag mācīties. Кому нужна деятельность — дательный падеж: man, tev, viņam, viņai, mums, jums, viņiem, viņām. Действие после vajag — инфинитив, в том числе возвратный. Vajag не меняется по лицам: Man vajag mācīties. Mums vajag mācīties.",
  notesRu: ["Время выражается vajag / vajadzēja / vajadzēs; отрицание — nevajag / nevajadzēja / nevajadzēs. В заданиях запрошена литературная форма настоящего vajag; разговорное vajaga существует. Существительное без инфинитива и конструкция с jā- — отдельные модели.","Кружки подэтапов и личный прогресс не являются частью таблицы."],
  highlightTargets: {
    'all': { labelRu: "Man vajag mācīties", selectors: sel('.table-necessity-vajag') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'person': { labelRu: "Кому?", selectors: sel('.tt-person') },
    'need': { labelRu: "Когда?", selectors: sel('.tt-need') },
    'action': { labelRu: "Действие", selectors: sel('.tt-action') },
    'phrase': { labelRu: "Связь", selectors: sel('.tt-phrase') },
    'first': { labelRu: "man · vajag · mācīties · man + vajag + инфинитив", selectors: sel('.tt-row-first') },
    'second': { labelRu: "tev · vajag · atpūsties · tev + vajag + инфинитив", selectors: sel('.tt-row-second') },
    'we': { labelRu: "mums · vajag · tīrīt istabu · лицо не меняет vajag", selectors: sel('.tt-row-we') },
    'past': { labelRu: "viņai · vajadzēja · celties · прошедшее", selectors: sel('.tt-row-past') },
    'future': { labelRu: "jums · vajadzēs · doties mājās · будущее", selectors: sel('.tt-row-future') },
    'negative': { labelRu: "viņam · nevajag · gaidīt · отрицание", selectors: sel('.tt-row-negative') },
  },
};

