import { sel } from './shared/pronoun.mjs';

/**
 * verbEndingsPresent — Tabula 90: personal endings of the present tense (tagadne). Columns are the
 * conjugation groups (I, II, III, III exceptions), each split into the plain infinitive (-t) and the
 * reflexive one (-ties). Rows: es, tu, 3 pers., mēs, jūs.
 * Component classes (TableVerbEndingsPresent.jsx):
 *   rows:  tt-head-groups | tt-head-forms | tt-head-stems | tt-person-es | tt-person-tu | tt-person-third | tt-person-mes | tt-person-jus
 *   cells: tt-g1 | tt-g2 | tt-g3 | tt-g3x  +  tt-plain | tt-reflexive ; person label: tt-person-label
 * The coloured stamps and floating letters over the table are decoration and cannot be targeted.
 */
const GROUPS = {
  g1: 'I группа',
  g2: 'II группа (-ot, -āt, -ēt)',
  g3: 'III группа (-īt, -ināt, -zināt)',
  g3x: 'III группа, исключения (-ēt, raudāt, dziedāt)',
};
const PERSONS = { es: 'es (я)', tu: 'tu (ты)', third: '3 лицо (он, она, они)', mes: 'mēs (мы)', jus: 'jūs (вы)' };
const FORMS = { plain: 'без -ties (обычные глаголы на -t)', reflexive: 'возвратные (на -ties)' };

const cellTargets = {};
for (const [person, personRu] of Object.entries(PERSONS)) {
  for (const [group, groupRu] of Object.entries(GROUPS)) {
    for (const [form, formRu] of Object.entries(FORMS)) {
      cellTargets[`ending_${person}_${group}_${form}`] = {
        labelRu: `Окончание: ${personRu}, ${groupRu}, ${formRu}`,
        selectors: sel(`tr.tt-person-${person} td.tt-${group}.tt-${form}`),
      };
    }
  }
}

const groupTargets = {};
for (const [group, groupRu] of Object.entries(GROUPS)) {
  groupTargets[`group_${group}`] = {
    labelRu: `Колонки: ${groupRu} (обычные и возвратные, вместе с заголовком)`,
    selectors: sel(`.tt-${group}`),
  };
  groupTargets[`group_${group}_endings`] = { labelRu: `Только окончания: ${groupRu}`, selectors: sel(`tbody td.tt-${group}`) };
}
const personTargets = {};
for (const [person, personRu] of Object.entries(PERSONS)) {
  personTargets[`person_${person}`] = { labelRu: `Строка: ${personRu}`, selectors: sel(`tr.tt-person-${person}`) };
}

export default {
  tableKey: 'verbEndingsPresent',
  summaryRu:
    'Личные окончания глаголов в настоящем времени (tagadne). Колонки — группы спряжения: I, II, III и III (исключения); каждая делится на обычные глаголы (-t) и возвратные (-ties). Строки — лица: es, tu, 3 pers., mēs, jūs. Например для I группы: es -u, tu -/-i, 3 лицо без окончания, mēs -am, jūs -at; у возвратных: -os, -ies, -as, -amies, -aties. У II группы перед окончанием вставляется j (-j-u, -j-am), у III группы окончания -u, -i, -a, -ām, -āt.',
  notesRu: [
    'Под заголовками II и III групп показаны суффиксы инфинитива: II — -ot, -āt, -ēt; III — -īt, -ināt, -zināt; исключения III — -ēt, raudāt, dziedāt.',
    'В 3 лице у I группы обычных глаголов окончания нет («—»), у возвратных -as; у II группы обычных тоже нет.',
    'У «tu» в I группе окончание -/-i: у части глаголов оно нулевое, у части -i (выделено цветом).',
    'Цветные пятна и плавающие буквы поверх таблицы — декоративные подсказки, их подсветить нельзя.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица окончаний настоящего времени', selectors: sel('.card.table-verb-endings-present') },
    header_groups: { labelRu: 'Заголовки групп спряжения: I, II, III, III (искл.)', selectors: sel('tr.tt-head-groups') },
    header_forms: { labelRu: 'Строка «-t / -ties» (обычные и возвратные глаголы)', selectors: sel('tr.tt-head-forms') },
    header_stems: {
      labelRu: 'Строка суффиксов инфинитива: -ot, -āt, -ēt, -īt, -ināt, -zināt, raudāt, dziedāt',
      selectors: sel('tr.tt-head-stems'),
    },
    persons: { labelRu: 'Колонка с местоимениями (es, tu, 3 pers., mēs, jūs)', selectors: sel('.tt-person-label') },
    endings: { labelRu: 'Все окончания', selectors: sel('tbody .ending') },
    plain_forms: { labelRu: 'Колонки обычных глаголов (-t)', selectors: sel('.tt-plain') },
    reflexive_forms: { labelRu: 'Колонки возвратных глаголов (-ties)', selectors: sel('.tt-reflexive') },
    ...groupTargets,
    ...personTargets,
    ...cellTargets,
  },
};
