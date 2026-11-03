import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'conditionSentence',
  summaryRu: 'M28, первый слой A2: реальное условие и следствие в путешествии. Четыре колонки: условие, связь частей, следствие, пунктуационная граница. Шесть строк: дождь, солнце, задержка автобуса, деньги, тёплая погода, тяжёлый чемодан. В строках money и luggage следствие предшествует условию.',
  notesRu: [
    'Таблица содержит фрагменты частей, а не четыре слова для механического чтения слева направо. Колонка link задаёт порядок; boundary показывает слова по обе стороны запятой. Собирай полное предложение по этой схеме.',
    'Ja вводит условие. Tad может подчёркивать следствие, но не обязательно: строка sun имеет Ja …, …, строка rain имеет Ja …, tad …. Отсутствие tad не является грамматической ошибкой.',
    'Все приведённые личные формы — простое изъявительное настоящее или будущее. Условное наклонение с -tu, гипотетические и контрфактические условия не входят в этот слой.',
    'Условие не утверждает, что уже выполнено. Будущее сообщение без ja может быть фактом о плане, а не условием.',
    'В заданиях сборки порядок двух готовых частей указан явно; не объявляй другой порядок слов в свободной речи неграмматичным.',
    'Кружки подэтапов и личный прогресс не являются частью таблицы. Перед поиском размонтированной таблицы запроси grammar.table.reveal.',
  ],
  highlightTargets: {
    all: { labelRu: 'Ja …, (tad) … · вся таблица', selectors: sel('.table-condition-sentence') },
    rule: { labelRu: 'Правило: ja, запятая, необязательное tad', selectors: sel('.tt-rule') },
    warning: { labelRu: 'Ограничение первого слоя A2', selectors: sel('.tt-warning') },
    condition: { labelRu: 'Условие: līst, spīd saule, autobuss kavē, man ir nauda, rīt būs silts laiks, čemodāns ir smags', selectors: sel('.tt-condition') },
    link: { labelRu: 'Связь: Ja …, tad … / Ja …, … / …, ja …', selectors: sel('.tt-link') },
    result: { labelRu: 'Следствие: действия с багажом, ожидание, бронирование и поездка', selectors: sel('.tt-result') },
    boundary: { labelRu: 'Граница: запятая после условия или перед ja', selectors: sel('.tt-boundary') },
    rain: { labelRu: 'Дождь: Ja līst, tad es ņemu lietussargu', selectors: sel('.tt-row-rain') },
    sun: { labelRu: 'Солнце: Ja spīd saule, es ņemu saulesbrilles · без tad', selectors: sel('.tt-row-sun') },
    delay: { labelRu: 'Задержка: Ja autobuss kavē, tad mēs gaidām autoostā', selectors: sel('.tt-row-delay') },
    money: { labelRu: 'Деньги: Es rezervēšu istabu, ja man ir nauda', selectors: sel('.tt-row-money') },
    warm: { labelRu: 'Будущее: Ja rīt būs silts laiks, mēs brauksim pie jūras', selectors: sel('.tt-row-warm') },
    luggage: { labelRu: 'Багаж: Es ņemšu mazu somu, ja čemodāns ir smags', selectors: sel('.tt-row-luggage') },
  },
};
