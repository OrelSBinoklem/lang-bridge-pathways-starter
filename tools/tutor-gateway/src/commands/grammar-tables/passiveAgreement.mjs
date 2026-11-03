import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'passiveAgreement',
  summaryRu: 'M31, первый слой B1. Шесть строк и четыре колонки: подлежащее, вспомогательная форма, причастие, род/число и модель. Показаны все четыре окончания именительного и шесть основ: atjaunots, atvērta, celti, pabeigtas, veidots, sarakstīta. Bija/būs иллюстрируют заданные составные времена; tiek — динамическое действие, ir — результат/состояние.',
  notesRu: [
    'При чтении соединяй первые три колонки: Tilts ir atjaunots; Pils ir atvērta; Torņi bija celti; Svētku programmas būs pabeigtas; Krāvums tiek veidots; Grāmata ir sarakstīta. Четвёртая колонка — подпись формы, не часть предложения.',
    'Причастие согласуется с подлежащим в именительном по роду и числу: -ts/-ta/-ti/-tas. Третье лицо būt здесь имеет одинаковую форму для обоих чисел: ir, bija, būs.',
    'В заданной модели būt + причастие: ir atjaunots — saliktā tagadne, bija atjaunots — saliktā pagātne, būs atjaunots — saliktā nākotne. Не называй полную форму bija celti простым прошедшим: простое прошедшее динамического пассива использовало бы tika.',
    'Tiek + причастие — простое настоящее динамического пассива. Это действие, которое может быть текущим, повторяющимся или недлительным; не утверждай, что tiek всегда кодирует незавершённость.',
    'Ir + причастие может описывать результат или состояние. У atvērts возможна функция прилагательного; Pils ir atvērta не является однозначной проверкой составного времени без заданной интерпретации. При неизвестном контексте объясняй обе возможности.',
    'В упражнении требуемые время и модель названы явно. Не объявляй другую форму неграмматичной в ином контексте. Возможный в речи пропуск ir не запрещается общим правилом.',
    'Первый слой ограничен шестью глаголами, неопределёнными окончаниями в именительном, утвердительными формами третьего лица; иные причастия, падежи, tapt, ticis/bijis и выражение деятеля не тренируются.',
    'Кружки подэтапов и личный прогресс не являются частью таблицы. Перед поиском размонтированной таблицы запроси grammar.table.reveal.',
  ],
  highlightTargets: {
    all: { labelRu: 'Ciešamā kārta · вся таблица', selectors: sel('.table-passive-agreement') },
    rule: { labelRu: 'Согласование, составные времена, tikt/būt', selectors: sel('.tt-rule') },
    warning: { labelRu: 'Ограничения первого слоя и неоднозначность ir atvērts', selectors: sel('.tt-warning') },
    subject: { labelRu: 'Подлежащее: Tilts, Pils, Torņi, Svētku programmas, Krāvums, Grāmata', selectors: sel('.tt-subject') },
    auxiliary: { labelRu: 'Вспомогательные формы: ir, bija, būs, tiek', selectors: sel('.tt-auxiliary') },
    participle: { labelRu: 'Причастия: atjaunots, atvērta, celti, pabeigtas, veidots, sarakstīta', selectors: sel('.tt-participle') },
    agreement: { labelRu: 'Род, число и явно заданная модель', selectors: sel('.tt-agreement') },
    restored: { labelRu: 'Tilts ir atjaunots · мужской род, единственное', selectors: sel('.tt-row-restored') },
    opened: { labelRu: 'Pils ir atvērta · женский род, единственное, состояние', selectors: sel('.tt-row-opened') },
    built: { labelRu: 'Torņi bija celti · мужской род, множественное, составное прошедшее', selectors: sel('.tt-row-built') },
    finished: { labelRu: 'Svētku programmas būs pabeigtas · женский род, множественное, составное будущее', selectors: sel('.tt-row-finished') },
    shaped: { labelRu: 'Krāvums tiek veidots · динамическое действие', selectors: sel('.tt-row-shaped') },
    written: { labelRu: 'Grāmata ir sarakstīta · статическая модель результата', selectors: sel('.tt-row-written') },
  },
};
