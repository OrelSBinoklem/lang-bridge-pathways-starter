import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'genitiveVsAdjective',
  summaryRu: "Vilnas jaka · silta jaka. В этих сочетаниях материал, сезон или назначение выражены существительным в генитиве: vilnas, ziemas, sporta. При смене падежа главного слова этот генитив сохраняется. Прилагательное согласуется с главным словом в роде, числе и падеже.",
  notesRu: ["Здесь тренируем неопределённые окончания прилагательных: silta → siltā, jauni → jaunos. Определённые формы siltajā и jaunajos существуют, но относятся к следующему этапу. Не распространяй неизменность зависимого генитива на любые конструкции.","Кружки подэтапов и личный прогресс не являются частью таблицы."],
  highlightTargets: {
    'all': { labelRu: "Vilnas jaka · silta jaka", selectors: sel('.table-genitive-adjective') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'meaning': { labelRu: "Признак", selectors: sel('.tt-meaning') },
    'nom': { labelRu: "Kas?", selectors: sel('.tt-nom') },
    'loc': { labelRu: "Kur?", selectors: sel('.tt-loc') },
    'change': { labelRu: "Изменение", selectors: sel('.tt-change') },
    'material': { labelRu: "материал · vilnas jaka · vilnas jakā · vilnas не меняется", selectors: sel('.tt-row-material') },
    'season': { labelRu: "сезон · ziemas mētelis · ziemas mētelī · ziemas не меняется", selectors: sel('.tt-row-season') },
    'purpose': { labelRu: "назначение · sporta krekls · sporta kreklā · sporta не меняется", selectors: sel('.tt-row-purpose') },
    'rubber': { labelRu: "материал · gumijas zābaki · gumijas zābakos · gumijas не меняется", selectors: sel('.tt-row-rubber') },
    'adjective': { labelRu: "качество · silta jaka · siltā jakā · прилагательное согласуется", selectors: sel('.tt-row-adjective') },
    'both': { labelRu: "два признака · jauni vilnas cimdi · jaunos vilnas cimdos · меняется только jauni", selectors: sel('.tt-row-both') },
  },
};

