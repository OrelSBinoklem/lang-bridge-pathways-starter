import { sel } from './shared/pronoun.mjs';

/**
 * savrupinajumi1 — «Обособленные члены предложения» (TableSavrupinajumi1): intro and two columns sv-col--attr
 * (Savrupināts apzīmētājs) and sv-col--appos (Savrupināts pielikums), each with head, function line (sv-func),
 * a shift "before → after" (sv-shift) and two samples (sv-sample). Separated part = sv-hit, commas/dashes = sv-pn.
 */
export default {
  tableKey: 'savrupinajumi1',
  summaryRu:
    'Обособленные определения и приложения. Обособление — член предложения, выделенный запятыми или тире (в речи паузой), чтобы уточнить или пояснить его. 1) Savrupināts apzīmētājs (обособленное определение): определение ставят не перед словом, а после него, чтобы выделить признак; сдвиг dziļš un tumšs ezers → ezers, dziļš un tumšs,; примеры Ezers, dziļš un tumšs, vilināja peldētājus. (Озеро, глубокое и тёмное, манило купальщиков.) и Pie mājas auga ozols — vecs, bet vēl spēcīgs. (У дома рос дуб — старый, но ещё крепкий.) 2) Savrupināts pielikums (обособленное приложение): существительное, которое поясняет слово перед ним (должность, профессия, кто это); сдвиг kaimiņš → kaimiņš, ārsts,; примеры Mūsu kaimiņš, pieredzējis ārsts, mums palīdzēja. (Наш сосед, опытный врач, нам помог.) и Pie durvīm stāvēja viesis — mans vecais skolotājs. (У двери стоял гость — мой старый учитель.)',
  notesRu: ['Обособленная часть в примерах выделена цветом, запятые и тире тоже отмечены.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица про обособленные определения и приложения', selectors: sel('.card.table-savrupinajumi') },
    title: { labelRu: 'Заголовок «Обособленные члены предложения»', selectors: sel('.vs-head') },
    intro: { labelRu: 'Вступление: что такое обособление', selectors: sel('.sv-intro') },
    column_attribute: { labelRu: 'Колонка Savrupināts apzīmētājs (обособленное определение)', selectors: sel('.sv-col--attr') },
    column_apposition: { labelRu: 'Колонка Savrupināts pielikums (обособленное приложение)', selectors: sel('.sv-col--appos') },
    column_heads: { labelRu: 'Названия двух типов обособления', selectors: sel('.sv-col-head') },
    functions: { labelRu: 'Пояснения: где стоит определение / что такое приложение', selectors: sel('.sv-func') },
    shifts: { labelRu: 'Схемы сдвига: слово до и после обособления', selectors: sel('.sv-shift') },
    shift_attribute: { labelRu: 'Схема: dziļš un tumšs ezers → ezers, dziļš un tumšs,', selectors: sel('.sv-col--attr .sv-shift') },
    shift_apposition: { labelRu: 'Схема: kaimiņš → kaimiņš, ārsts,', selectors: sel('.sv-col--appos .sv-shift') },
    samples: { labelRu: 'Все примеры предложений', selectors: sel('.sv-sample') },
    samples_attribute: { labelRu: 'Примеры обособленных определений (ezers, ozols)', selectors: sel('.sv-col--attr .sv-sample') },
    samples_apposition: { labelRu: 'Примеры обособленных приложений (kaimiņš, viesis)', selectors: sel('.sv-col--appos .sv-sample') },
    separated_parts: { labelRu: 'Обособленные части в примерах (выделены)', selectors: sel('.sv-hit') },
    punctuation: { labelRu: 'Запятые и тире вокруг обособленных частей', selectors: sel('.sv-pn') },
    translations: { labelRu: 'Русские переводы примеров', selectors: sel('.sv-sample-ru') },
  },
};
