import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'reasonResultSentence',
  summaryRu: 'Jo · tāpēc, A2: результат, jo причина; причина, tāpēc результат. Четыре колонки: факт, направление, связка, предложение. Шесть строк: три пары о дожде, экзамене и твёрдом ржаном хлебе.',
  notesRu: [
    'Jo вводит причину, одиночное tāpēc вводит результат. Перед ними в этих моделях стоит запятая.',
    'В каждой паре строк одна и та же причинная связь выражена в двух направлениях. Бот не должен объявлять произвольные соседние факты причиной и результатом.',
    'Tāpēc ka вводит причину; отмечено в ограничении, но не является одной из двух проверяемых связок. Цель с lai и хронологический порядок событий не тренируются.',
    'Кнопки тренировок и индикаторы прогресса не являются содержимым таблицы.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица Jo · tāpēc', selectors: sel('.table-reason-result-sentence') },
    rule: { labelRu: 'Правило: направление причины и результата, запятая', selectors: sel('.tt-rule') },
    warning: { labelRu: 'Ограничение: явная причинность; tāpēc ka, lai и хронология', selectors: sel('.tt-warning') },
    fact: { labelRu: 'Факт: Līst; Rīt ir eksāmens; Rupjmaize ir cieta', selectors: sel('.tt-fact') },
    meaning: { labelRu: 'Направление: результат, затем причина; причина, затем результат', selectors: sel('.tt-meaning') },
    link: { labelRu: 'Связка jo или tāpēc', selectors: sel('.tt-link') },
    sentence: { labelRu: 'Полные предложения с jo и tāpēc', selectors: sel('.tt-sentence') },
    'rain-reason': { labelRu: 'Es ņemu lietussargu, jo līst: дождь объясняет выбор зонта', selectors: sel('.tt-row-rain-reason') },
    'rain-result': { labelRu: 'Līst, tāpēc es ņemu lietussargu: зонт как результат', selectors: sel('.tt-row-rain-result') },
    'exam-reason': { labelRu: 'Es mācos, jo rīt ir eksāmens: экзамен как причина', selectors: sel('.tt-row-exam-reason') },
    'exam-result': { labelRu: 'Rīt ir eksāmens, tāpēc es mācos: учёба как результат', selectors: sel('.tt-row-exam-result') },
    'bread-reason': { labelRu: 'Es nepērku rupjmaizi, jo tā ir cieta: твёрдость как причина', selectors: sel('.tt-row-bread-reason') },
    'bread-result': { labelRu: 'Rupjmaize ir cieta, tāpēc es to nepērku: отказ от покупки как результат', selectors: sel('.tt-row-bread-result') },
  },
};
