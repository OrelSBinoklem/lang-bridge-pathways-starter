import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'transitiveObject',
  summaryRu: "Kas pērk? · Ko pērk?. В модели pirkt покупаемый предмет отвечает на ko? и стоит в винительном: piens → pienu, maize → maizi. Прилагательное согласуется с предметом: lētu maizi, lētus burkānus, lētas plūmes.",
  notesRu: ["Не любое дополнение любого глагола — винительный. Здесь только покупка pirkt. У части существительных форма винительного совпадает с именительным; это не отменяет роли объекта. Прилагательные здесь неопределённые.", 'Кнопки подэтапов и личный прогресс не являются частью таблицы.'],
  highlightTargets: {
    'all': { labelRu: "Kas pērk? · Ko pērk?", selectors: sel('.table-transitive-object') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'subject': { labelRu: "Кто?", selectors: sel('.tt-subject') },
    'action': { labelRu: "Действие", selectors: sel('.tt-action') },
    'form': { labelRu: "Что покупают?", selectors: sel('.tt-form') },
    'base': { labelRu: "Исходное слово", selectors: sel('.tt-base') },
    'milk': { labelRu: "Es · pērku · pienu · piens", selectors: sel('.tt-row-milk') },
    'bread': { labelRu: "Tu · pērc · maizi · maize", selectors: sel('.tt-row-bread') },
    'tea': { labelRu: "Viņa · pērk · tēju · tēja", selectors: sel('.tt-row-tea') },
    'carrots': { labelRu: "Mēs · pērkam · burkānus · burkāni", selectors: sel('.tt-row-carrots') },
    'plums': { labelRu: "Jūs · pērkat · plūmes · plūmes", selectors: sel('.tt-row-plums') },
    'adjective': { labelRu: "Viņi · pērk · lētas plūmes · lēts + plūmes", selectors: sel('.tt-row-adjective') },
  },
};

