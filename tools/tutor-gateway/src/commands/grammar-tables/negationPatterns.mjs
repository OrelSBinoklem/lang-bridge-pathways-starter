import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'negationPatterns',
  summaryRu: "Ne- · nav · neesmu. Действие отрицается ne-: strādāju → nestrādāju. У būt в настоящем: neesmu, neesi, nav, neesam, neesat, nav. Профессия в схеме «кто есть кто» остаётся именительной. В схеме отсутствия «кому + nav + чего» предмет стоит в родительном.",
  notesRu: ["Не смешивай ne-, nav и nē. Отрицание глагола само по себе не переводит объект в родительный: nelasu grāmatu. Генитив здесь нужен именно при отсутствии с nav. Будущее и прошедшее отрицание būt, сложные отрицательные местоимения и другие конструкции — следующие этапы.", 'Кружки подэтапов и личный прогресс не являются частью таблицы.', 'Последняя колонка поясняет изменение формы; для сопоставления объекта выделяй строки read и have отдельно.'],
  highlightTargets: {
    'all': { labelRu: "Ne- · nav · neesmu", selectors: sel('.table-negation-patterns') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'model': { labelRu: "Модель", selectors: sel('.tt-model') },
    'positive': { labelRu: "Утверждение", selectors: sel('.tt-positive') },
    'negative': { labelRu: "Отрицание", selectors: sel('.tt-negative') },
    'form': { labelRu: "Что меняется", selectors: sel('.tt-form') },
    'work': { labelRu: "действие · Es strādāju. · Es nestrādāju. · ne- + глагол", selectors: sel('.tt-row-work') },
    'read': { labelRu: "действие · Tu lasi grāmatu. · Tu nelasi grāmatu. · объект остаётся винительным", selectors: sel('.tt-row-read') },
    'first': { labelRu: "профессия · Es esmu pavārs. · Es neesmu pavārs. · esmu → neesmu", selectors: sel('.tt-row-first') },
    'third': { labelRu: "профессия · Viņa ir ārste. · Viņa nav ārste. · ir → nav", selectors: sel('.tt-row-third') },
    'have': { labelRu: "наличие · Man ir grāmata. · Man nav grāmatas. · предмет → генитив", selectors: sel('.tt-row-have') },
    'plural': { labelRu: "наличие · Mums ir darbs. · Mums nav darba. · обладатель — дательный", selectors: sel('.tt-row-plural') },
  },
};
