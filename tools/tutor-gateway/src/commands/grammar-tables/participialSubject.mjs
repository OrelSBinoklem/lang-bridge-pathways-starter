import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'participialSubject',
  summaryRu: 'Viens darītājs: B1, первый слой -dams / -dama / -dami / -damas. Одно подлежащее выполняет два одновременных действия. Четыре колонки: исполнитель, род/число, форма, два действия; шесть именованных строк.',
  notesRu: [
    'Мужской единственного -dams, женский единственного -dama, мужской множественного -dami, женский множественного -damas. Проверяется только указанный род и число, не смешанные группы.',
    'Пять корректных примеров показывают общего исполнителя. В строке recipient Anna выполняет оба действия, brālim — получатель рассказа. Строка different-actors сохраняет два разных подлежащих в двух частях.',
    'Проверяемые невозвратные глаголы: darināt, strādāt, adīt, lasīt, zīmēt, izmantot, remontēt, dziedāt. Возвратные формы и чередования других основ вне этого слоя.',
    'Не переносить ограничение общего подлежащего на все конструкции с -ot: возможен другой исполнитель в дательном. Другие значения и формы divdabja teiciens не тренируются.',
    'Запятые в приведённых расширенных оборотах заданы; отдельного курса пунктуации здесь нет. Кнопки тренировок и индикаторы прогресса не являются содержимым таблицы.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица Viens darītājs', selectors: sel('.table-participial-subject') },
    rule: { labelRu: 'Правило: одно подлежащее, два действия, четыре формы', selectors: sel('.tt-rule') },
    warning: { labelRu: 'Границы: восемь глаголов, без возвратных; -ot и пунктуация отдельно', selectors: sel('.tt-warning') },
    subject: { labelRu: 'Исполнитель: galdnieks, adītāja, keramiķi, audējas, Anna; разные Anna и Jānis', selectors: sel('.tt-subject') },
    agreement: { labelRu: 'Род и число исполнителя либо разные исполнители', selectors: sel('.tt-agreement') },
    form: { labelRu: 'strādādams, adīdama, darinādami, strādādamas, lasīdama; ограничение -dams', selectors: sel('.tt-form') },
    sentence: { labelRu: 'Полные предложения о двух действиях', selectors: sel('.tt-sentence') },
    'masculine-singular': { labelRu: 'galdnieks: strādādams darbnīcā и dzied', selectors: sel('.tt-row-masculine-singular') },
    'feminine-singular': { labelRu: 'adītāja: adīdama cimdus и runā ar māsu', selectors: sel('.tt-row-feminine-singular') },
    'masculine-plural': { labelRu: 'keramiķi: darinādami krūzes и stāsta par amatu', selectors: sel('.tt-row-masculine-plural') },
    'feminine-plural': { labelRu: 'audējas: strādādamas darbnīcā и dzied', selectors: sel('.tt-row-feminine-plural') },
    recipient: { labelRu: 'Anna читает и рассказывает; brālim — получатель', selectors: sel('.tt-row-recipient') },
    'different-actors': { labelRu: 'Anna вяжет, Jānis читает: разные исполнители, две части', selectors: sel('.tt-row-different-actors') },
  },
};
