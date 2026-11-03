import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'determinerNounAgreement',
  summaryRu: "Tas · tā · tie · tās. Колонки: падеж, род/число, форма определителя, целая группа. Указательное слово согласуется с существительным в роде, числе и падеже. Винительный: to / to / tos / tās. Основные учебные формы местного: tajā / tajā / tajos / tajās.",
  notesRu: ["Здесь модель tas / tā. Šis / šī и mans / mana изучаются отдельно. Окончания определителя и существительного не обязательно совпадают; у местного есть допустимые альтернативные формы.", 'Кнопки тренировок и индикаторы прогресса не являются содержимым таблицы.'],
  highlightTargets: {
    'all': { labelRu: "Tas · tā · tie · tās", selectors: sel('.table-determiner-noun') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'case': { labelRu: "Падеж", selectors: sel('.tt-case') },
    'features': { labelRu: "Род / число", selectors: sel('.tt-features') },
    'form': { labelRu: "Форма", selectors: sel('.tt-form') },
    'phrase': { labelRu: "Группа", selectors: sel('.tt-phrase') },
    'nom-m': { labelRu: "Именительный · муж. ед. · tas · tas koks", selectors: sel('.tt-row-nom-m') },
    'nom-f': { labelRu: "Именительный · жен. ед. · tā · tā māja", selectors: sel('.tt-row-nom-f') },
    'nom-mp': { labelRu: "Именительный · муж. мн. · tie · tie koki", selectors: sel('.tt-row-nom-mp') },
    'nom-fp': { labelRu: "Именительный · жен. мн. · tās · tās mājas", selectors: sel('.tt-row-nom-fp') },
    'acc': { labelRu: "Винительный · муж. мн. · tos · Es redzu tos kokus.", selectors: sel('.tt-row-acc') },
    'loc': { labelRu: "Местный · жен. мн. · tajās · Es dzīvoju tajās mājās.", selectors: sel('.tt-row-loc') },
  },
};
