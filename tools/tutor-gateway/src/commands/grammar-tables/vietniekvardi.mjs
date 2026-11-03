import { sel } from './shared/pronoun.mjs';

/**
 * vietniekvardi — «Местоимения» (TableVietniekvardi): a table Группа | Что делает | Примеры with nine groups
 * (rows tr.tt-group-<wordId(lv)>; the two paired groups also vv-row--pair) and a note about interrogative vs relative.
 */
const GROUPS = [
  ['personu', 'Personu', 'личные', 'называют участников разговора', 'es, tu, viņš, viņa, mēs, jūs, viņi, viņas'],
  ['atgriezeniskais', 'Atgriezeniskais', 'возвратное', 'действие на самого деятеля', 'sevis, sev, sevi'],
  ['noradamie', 'Norādāmie', 'указательные', 'указывают на предмет или существо', 'tas, tā, tie, tās, šis, šī, šie, šīs'],
  ['piederibas', 'Piederības', 'притяжательные', 'показывают принадлежность', 'mans, tavs, savs, mūsu, jūsu'],
  ['jautajamie', 'Jautājamie', 'вопросительные', 'вводят вопрос', 'kas, kāds, kurš'],
  ['attieksmes', 'Attieksmes', 'относительные', 'вводят придаточное предложение', 'kas, kāds, kurš'],
  ['nenoteiktie', 'Nenoteiktie', 'неопределённые', 'указывают на неизвестное', 'kaut kas, kaut kāds, jebkas, jebkurš, dažs, cits и др.'],
  ['noteiktie', 'Noteiktie', 'определительные', 'указывают на известное или всё целиком', 'katrs, ikviens, viss, abi, pats'],
  ['noliegtie', 'Noliegtie', 'отрицательные', 'выражают отрицание', 'nekas, nekāds, neviens'],
];

export default {
  tableKey: 'vietniekvardi',
  summaryRu:
    'Карта девяти групп местоимений (vietniekvārdi): группа, что делает, примеры. ' +
    GROUPS.map(([, lv, ru, func, words]) => `${lv} (${ru}) — ${func}: ${words}`).join('; ') +
    '. Полные парадигмы — в отдельных таблицах местоимений. Вопросительные и относительные — одни и те же слова с разной работой: Kurš tur nāk? (вопрос) — Es zinu, kurš tur nāk. (придаточное).',
  notesRu: ['Две строки — вопросительные и относительные — помечены как пара: слова совпадают.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица «Местоимения»', selectors: sel('.card.table-vietniekvardi') },
    title: { labelRu: 'Заголовок «Местоимения»', selectors: sel('.vs-head') },
    header: { labelRu: 'Шапка: Группа, Что делает, Примеры', selectors: sel('.vv-table thead') },
    rows: { labelRu: 'Все девять групп', selectors: sel('.vv-row') },
    names: { labelRu: 'Колонка с названиями групп', selectors: sel('.vv-name') },
    functions: { labelRu: 'Колонка «Что делает»', selectors: sel('.vv-func') },
    examples: { labelRu: 'Колонка примеров', selectors: sel('.vv-words') },
    pair: { labelRu: 'Пара групп с одинаковыми словами: вопросительные и относительные', selectors: sel('.vv-row--pair') },
    note: { labelRu: 'Примечание про вопросительные и относительные местоимения', selectors: sel('.vv-note') },
    ...Object.fromEntries(
      GROUPS.map(([id, lv, ru, func, words]) => [`group_${id}`, { labelRu: `Группа ${lv} (${ru}): ${func}; ${words}`, selectors: sel(`.tt-group-${id}`) }]),
    ),
  },
};
