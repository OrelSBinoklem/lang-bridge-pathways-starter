import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'subjectPredicateAgreement',
  summaryRu: "Kas dara?. Форма глагола зависит от лица подлежащего. Для отрицания: ne- + личная форма, например mēs nemazgājam. Третье лицо имеет одну форму в обоих числах.",
  notesRu: ["Это не универсальные окончания всех глаголов. Формы разных глаголов сверяются со своим спряжением; отрицание būt имеет особую форму nav.", 'Кнопки тренировок и индикаторы прогресса не являются содержимым таблицы.'],
  highlightTargets: {
    'all': { labelRu: "Kas dara?", selectors: sel('.table-subject-predicate') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'subject': { labelRu: "Кто?", selectors: sel('.tt-subject') },
    'person': { labelRu: "Лицо / число", selectors: sel('.tt-person') },
    'form': { labelRu: "Глагол", selectors: sel('.tt-form') },
    'sentence': { labelRu: "Предложение", selectors: sel('.tt-sentence') },
    'es': { labelRu: "es · 1-е, ед. · mazgāju · Es mazgāju traukus.", selectors: sel('.tt-row-es') },
    'tu': { labelRu: "tu · 2-е, ед. · mazgā · Tu mazgā traukus.", selectors: sel('.tt-row-tu') },
    'vins': { labelRu: "viņš / viņa · 3-е, ед. · mazgā · Viņa mazgā traukus.", selectors: sel('.tt-row-vins') },
    'mes': { labelRu: "mēs · 1-е, мн. · mazgājam · Mēs mazgājam traukus.", selectors: sel('.tt-row-mes') },
    'jus': { labelRu: "jūs · 2-е, мн. · mazgājat · Jūs mazgājat traukus.", selectors: sel('.tt-row-jus') },
    'vini': { labelRu: "viņi / viņas · 3-е, мн. · mazgā · Viņi mazgā traukus.", selectors: sel('.tt-row-vini') },
  },
};

