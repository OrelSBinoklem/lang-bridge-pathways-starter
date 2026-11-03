import { caseTargets, endingTargets, introTarget, sel } from './shared/pronoun.mjs';

/**
 * pron1 — personal pronouns. Columns are persons (es tu viņš viņa | mēs jūs viņi viņas),
 * rows are cases. The third person keeps the stem "viņ-" and shows the gender in a colored ending.
 */
const person = (id, labelRu) => ({ labelRu, selectors: sel(`.tt-person-${id}`) });

export default {
  tableKey: 'pron1',
  summaryRu:
    'Личные местоимения: es (я), tu (ты), viņš (он), viņa (она), mēs (мы), jūs (вы), viņi (они, м.р.), viņas (они, ж.р.). Колонки — лица (слева единственное число, справа множественное), строки — падежи Kas? Kā? Kam? Ko? Kur?. У третьего лица основа viņ- и цветное окончание, которое показывает род.',
  notesRu: [
    'Именительный падеж (Kas?) — сами местоимения: es, tu, viņš, viņa, mēs, jūs, viņi, viņas.',
    'Родительный (Kā?): manis, tevis, mūsu, jūsu; у третьего лица viņa / viņas / viņu.',
    'У 1-го и 2-го лица формы Kam? — man, tev, mums, jums; у третьего лица окончания -am, -ai, -iem, -ām.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица личных местоимений', selectors: sel('.card.table-pron1') },
    ...introTarget('pron1', 'Строка с перечнем местоимений и переводом (es, tu, viņš …)'),
    singular: { labelRu: 'Единственное число: es tu viņš viņa', selectors: sel('.tt-singular') },
    plural: { labelRu: 'Множественное число: mēs jūs viņi viņas', selectors: sel('.tt-plural') },
    first_person: { labelRu: '1-е лицо: es и mēs', selectors: sel('.tt-person-es', '.tt-person-mes') },
    second_person: { labelRu: '2-е лицо: tu и jūs', selectors: sel('.tt-person-tu', '.tt-person-jus') },
    third_person: {
      labelRu: '3-е лицо: viņš, viņa, viņi, viņas',
      selectors: sel('.tt-person-vins', '.tt-person-vina', '.tt-person-vini', '.tt-person-vinas'),
    },
    person_es: person('es', 'Колонка es (я)'),
    person_tu: person('tu', 'Колонка tu (ты)'),
    person_vins: person('vins', 'Колонка viņš (он)'),
    person_vina: person('vina', 'Колонка viņa (она)'),
    person_mes: person('mes', 'Колонка mēs (мы)'),
    person_jus: person('jus', 'Колонка jūs (вы)'),
    person_vini: person('vini', 'Колонка viņi (они, мужской род)'),
    person_vinas: person('vinas', 'Колонка viņas (они, женский род)'),
    person_headers: {
      labelRu: 'Строка подзаголовков с местоимениями (es tu viņš viņa mēs jūs viņi viņas)',
      selectors: sel('.tt-person-head'),
    },
    ...caseTargets('.pron1-row'),
    ...endingTargets('pron1'),
  },
};
