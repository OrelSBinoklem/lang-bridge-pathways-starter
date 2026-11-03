import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'possessionIrNav',
  summaryRu: "У кого есть и нет. Обладатель — дательный: man, tev, viņam, viņai, mums, jums, viņiem, viņām. После ir предмет в именительном, после nav — в родительном.",
  notesRu: ["Nav здесь отрицает наличие предмета. Не переносить это управление на любое отрицание: Es neredzu māju — винительный.", 'Прогресс и кнопки подэтапов не относятся к содержимому таблицы.'],
  highlightTargets: {
    all: { labelRu: "У кого есть и нет", selectors: sel('.table-possession-ir-nav') },
    rule: { labelRu: 'Правило', selectors: sel('.tt-rule') },
    warning: { labelRu: 'Ограничение модели', selectors: sel('.tt-warning') },
    holder: { labelRu: "Кому? · Kam?", selectors: sel('.tt-holder') },
    link: { labelRu: "Есть / нет", selectors: sel('.tt-link') },
    object: { labelRu: "Предмет", selectors: sel('.tt-object') },
    example: { labelRu: "Предложение", selectors: sel('.tt-example') },
    'man-ir': { labelRu: "man · ir · brālis · Kas? · Man ir brālis.", selectors: sel('.tt-row-man-ir') },
    'man-nav': { labelRu: "man · nav · brāļa · Kā? · Man nav brāļa.", selectors: sel('.tt-row-man-nav') },
    'tev-ir': { labelRu: "tev · ir · māsa · Tev ir māsa.", selectors: sel('.tt-row-tev-ir') },
    'vinai-nav': { labelRu: "viņai · nav · datora · Viņai nav datora.", selectors: sel('.tt-row-vinai-nav') },
    'mums-ir': { labelRu: "mums · ir · māja · Mums ir māja.", selectors: sel('.tt-row-mums-ir') },
    'jums-nav': { labelRu: "jums · nav · mājas · Jums nav mājas.", selectors: sel('.tt-row-jums-nav') },
  },
};
