import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'butIdentity',
  summaryRu: "Būt · nebūt. Es esmu, tu esi, viņš/viņa ir, mēs esam, jūs esat, viņi/viņas ir. Название профессии здесь стоит в именительном и соответствует роду и числу людей.",
  notesRu: ["В третьем лице отрицание ir → nav, не neir. Viņa nav profesore — «она не профессор»; это не конструкция принадлежности Man nav profesora.", 'Кнопки тренировок и индикаторы прогресса не являются содержимым таблицы.'],
  highlightTargets: {
    'all': { labelRu: "Būt · nebūt", selectors: sel('.table-but-identity') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'subject': { labelRu: "Кто?", selectors: sel('.tt-subject') },
    'form': { labelRu: "Есть", selectors: sel('.tt-form') },
    'negative': { labelRu: "Отрицание", selectors: sel('.tt-negative') },
    'identity': { labelRu: "Кто / кем является", selectors: sel('.tt-identity') },
    'es': { labelRu: "es · esmu · neesmu · Es esmu profesors.", selectors: sel('.tt-row-es') },
    'tu': { labelRu: "tu · esi · neesi · Tu esi profesore.", selectors: sel('.tt-row-tu') },
    'vins': { labelRu: "viņš / viņa · ir · nav · Viņa ir profesore.", selectors: sel('.tt-row-vins') },
    'mes': { labelRu: "mēs · esam · neesam · Mēs esam profesori.", selectors: sel('.tt-row-mes') },
    'jus': { labelRu: "jūs · esat · neesat · Jūs esat profesores.", selectors: sel('.tt-row-jus') },
    'vini': { labelRu: "viņi / viņas · ir · nav · Viņas nav profesores.", selectors: sel('.tt-row-vini') },
  },
};

