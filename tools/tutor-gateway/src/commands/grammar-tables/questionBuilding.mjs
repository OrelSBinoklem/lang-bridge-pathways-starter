import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'questionBuilding',
  summaryRu: "Kas? · Kā? · Kur? · Kad? · Vai?. Выбирай вопрос по смыслу ответа. В Kā tevi sauc? лицо стоит в винительном: mani, tevi, viņu, mūs, jūs, viņus, viņas. Vai задаёт вопрос с ответом да / нет.",
  notesRu: ["Kas tevi sauc? значит «кто тебя зовёт?», не «как тебя зовут?». Порядок слов в латышском гибкий: здесь показаны нейтральные учебные модели, не единственно возможный порядок.", 'Кнопки тренировок и индикаторы прогресса не являются содержимым таблицы.'],
  highlightTargets: {
    'all': { labelRu: "Kas? · Kā? · Kur? · Kad? · Vai?", selectors: sel('.table-question-building') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'meaning': { labelRu: "Смысл", selectors: sel('.tt-meaning') },
    'form': { labelRu: "Начало", selectors: sel('.tt-form') },
    'question': { labelRu: "Вопрос", selectors: sel('.tt-question') },
    'answer': { labelRu: "Ответ", selectors: sel('.tt-answer') },
    'who': { labelRu: "Кто / профессия · kas · Kas viņa ir? · Viņa ir profesore.", selectors: sel('.tt-row-who') },
    'name': { labelRu: "Как зовут · kā · Kā tevi sauc? · Mani sauc Anna.", selectors: sel('.tt-row-name') },
    'where': { labelRu: "Где · kur · Kur viņš ir? · Viņš ir te.", selectors: sel('.tt-row-where') },
    'when': { labelRu: "Когда · kad · Kad tiksimies? · Citreiz.", selectors: sel('.tt-row-when') },
    'yes-no': { labelRu: "Да / нет · vai · Vai tu esi profesors? · Jā, es esmu profesors.", selectors: sel('.tt-row-yes-no') },
    'plural': { labelRu: "Как зовут вас · kā · Kā jūs sauc? · Mūs sauc Anna un Līga.", selectors: sel('.tt-row-plural') },
  },
};

