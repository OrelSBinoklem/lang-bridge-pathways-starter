import { sel } from './shared/pronoun.mjs';

/**
 * verbEndingsPast — Tabula 91: endings of the past (pagātne) and future (nākotne) tenses. Three column
 * pairs: past of group I, past of groups II and III (with the inserted j), future of all groups
 * (with the inserted -s-/-š-); each split into plain (-t) and reflexive (-ties). Rows: es, tu, 3 pers., mēs, jūs.
 * Component classes (TableVerbEndingsPast.jsx):
 *   rows:  tt-head-groups | tt-head-forms | tt-person-es | tt-person-tu | tt-person-third | tt-person-mes | tt-person-jus
 *   cells: tt-past-g1 | tt-past-g23 | tt-future  +  tt-plain | tt-reflexive ; person label: tt-person-label
 * The coloured stamps and floating letters over the table are decoration and cannot be targeted.
 */
const COLUMNS = {
  past_g1: ['tt-past-g1', 'прошедшее время, I группа'],
  past_g23: ['tt-past-g23', 'прошедшее время, II и III группы (с вставкой j)'],
  future: ['tt-future', 'будущее время, все группы (со вставкой -s-/-š-)'],
};
const PERSONS = { es: 'es (я)', tu: 'tu (ты)', third: '3 лицо (он, она, они)', mes: 'mēs (мы)', jus: 'jūs (вы)' };
const FORMS = { plain: 'без -ties (обычные глаголы на -t)', reflexive: 'возвратные (на -ties)' };

const cellTargets = {};
const columnTargets = {};
for (const [key, [cls, ru]] of Object.entries(COLUMNS)) {
  columnTargets[`column_${key}`] = { labelRu: `Колонки: ${ru} (вместе с заголовком)`, selectors: sel(`.${cls}`) };
  columnTargets[`column_${key}_endings`] = { labelRu: `Только окончания: ${ru}`, selectors: sel(`tbody td.${cls}`) };
  for (const [person, personRu] of Object.entries(PERSONS)) {
    for (const [form, formRu] of Object.entries(FORMS)) {
      cellTargets[`ending_${person}_${key}_${form}`] = {
        labelRu: `Окончание: ${personRu}, ${ru}, ${formRu}`,
        selectors: sel(`tr.tt-person-${person} td.${cls}.tt-${form}`),
      };
    }
  }
}
const personTargets = {};
for (const [person, personRu] of Object.entries(PERSONS)) {
  personTargets[`person_${person}`] = { labelRu: `Строка: ${personRu}`, selectors: sel(`tr.tt-person-${person}`) };
}

export default {
  tableKey: 'verbEndingsPast',
  summaryRu:
    'Окончания глаголов в прошедшем (pagātne) и будущем (nākotne) времени. Три пары колонок: прошедшее I группы (es -u, tu -i, 3 лицо -a, mēs -ām, jūs -āt), прошедшее II и III групп (то же со вставкой j: -j-u, -j-i, -j-a, -j-ām, -j-āt) и будущее всех групп (со вставкой -s- или -š-: -š-u, -s-i, -s, -s-im, -s-iet). Каждая пара делится на обычные глаголы (-t) и возвратные (-ties, окончания -os, -ies, -ās, -āmies, -āties). Внизу подписаны цвета групп.',
  notesRu: [
    'В будущем времени перед окончанием стоит -s- (в форме es — -š-): es -š-u, tu -s-i, 3 лицо -s, mēs -s-im, jūs -s-iet или -s-it.',
    'Гласные, выделенные цветом в формах будущего (ie, i), — вариативная часть окончания.',
    'Строка с цветами внизу: I grupa, II grupa, III grupa (-īt/-ināt/zināt; в будущем -š-), III grupa (-āt).',
    'Цветные пятна и плавающие буквы поверх таблицы — декоративные подсказки, их подсветить нельзя.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица окончаний прошедшего и будущего времени', selectors: sel('.card.table-verb-endings-past') },
    header_groups: { labelRu: 'Заголовки: Pagātne — I, Pagātne — II, III, Nākotne — I, II, III', selectors: sel('tr.tt-head-groups') },
    header_forms: { labelRu: 'Строка «-t / -ties»', selectors: sel('tr.tt-head-forms') },
    persons: { labelRu: 'Колонка с местоимениями (es, tu, 3 pers., mēs, jūs)', selectors: sel('.tt-person-label') },
    endings: { labelRu: 'Все окончания', selectors: sel('tbody .ending') },
    plain_forms: { labelRu: 'Колонки обычных глаголов (-t)', selectors: sel('.tt-plain') },
    reflexive_forms: { labelRu: 'Колонки возвратных глаголов (-ties)', selectors: sel('.tt-reflexive') },
    color_legend: { labelRu: 'Строка с цветами групп под таблицей', selectors: sel('.hl-note') },
    future_variable_vowels: { labelRu: 'Выделенные цветом гласные в форме будущего (ie, i)', selectors: sel('.tt-future .c3') },
    ...columnTargets,
    ...personTargets,
    ...cellTargets,
  },
};
