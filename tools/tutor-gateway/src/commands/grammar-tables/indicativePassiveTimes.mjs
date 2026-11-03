import { sel } from './shared/pronoun.mjs';

/**
 * indicativePassiveTimes — «SALIKTIE UN CIEŠAMĀS KĀRTAS LAIKI» (component TableIndicative). A heading and an intro
 * note about the simple active tenses, then three tables, each with a section title:
 *   active-compound  — Darāmās kārtas saliktie laiki (esmu/biju/būšu + bij-is / bij-usi)
 *   passive-simple   — Ciešamās kārtas vienkāršie laiki (tieku/tiku/tikšu + reģistrē-ts / -ta)
 *   passive-compound — Ciešamās kārtas saliktie laiki (esmu/biju/būšu + uzreģistrē-ts / -ta)
 * Every table row = person; columns (no captions): person | present | past | future | participle masc. | participle fem.
 * In the passive tables the 3rd person is split into two rows (viņš / viņa, viņi / viņas) and the verb cells are merged.
 * Component classes (TableIndicative.jsx):
 *   titles/tables: tt-block-<block>  (table also tt-block)
 *   rows:   tt-person-es | tu | third-sg (viņš, viņa) | vins | vina | mes | jus | third-pl (viņi, viņas) | vini | vinas
 *   cells:  tt-col-person | tt-col-present | tt-col-past | tt-col-future | tt-col-participle-masc | tt-col-participle-fem
 */
const BLOCK_PERSONS = {
  'active-compound': ['es', 'tu', 'third-sg', 'mes', 'jus', 'third-pl'],
  'passive-simple': ['es', 'tu', 'vins', 'vina', 'mes', 'jus', 'vini', 'vinas'],
  'passive-compound': ['es', 'tu', 'vins', 'vina', 'mes', 'jus', 'vini', 'vinas'],
};
const BLOCKS = {
  'active-compound': 'сложные времена действительного залога (esmu, biju, būšu + причастие bijis / bijusi)',
  'passive-simple': 'простые времена страдательного залога (tieku, tiku, tikšu + reģistrēts / reģistrēta)',
  'passive-compound': 'сложные времена страдательного залога (esmu, biju, būšu + uzreģistrēts / uzreģistrēta)',
};
const PERSONS = {
  es: 'es', tu: 'tu', mes: 'mēs', jus: 'jūs',
  'third-sg': 'viņš, viņa', 'third-pl': 'viņi, viņas', vins: 'viņš', vina: 'viņa', vini: 'viņi', vinas: 'viņas',
};
const COLUMNS = {
  present: 'настоящее время',
  past: 'прошедшее время',
  future: 'будущее время',
  'participle-masc': 'причастие мужского рода',
  'participle-fem': 'причастие женского рода',
};

const targets = {};
for (const [block, blockRu] of Object.entries(BLOCKS)) {
  const key = block.replace(/-/g, '_');
  targets[`block_${key}`] = { labelRu: `Блок целиком: ${blockRu}`, selectors: sel(`.tt-block-${block}`) };
  targets[`block_${key}_title`] = { labelRu: `Заголовок блока: ${blockRu}`, selectors: sel(`.indicative-section-title.tt-block-${block}`) };
  targets[`block_${key}_table`] = { labelRu: `Таблица блока без заголовка: ${blockRu}`, selectors: sel(`table.tt-block-${block}`) };
  for (const [col, colRu] of Object.entries(COLUMNS)) {
    targets[`${key}_${col.replace(/-/g, '_')}`] = {
      labelRu: `${colRu} в блоке «${blockRu}»`,
      selectors: sel(`table.tt-block-${block} .tt-col-${col}`),
    };
  }
  for (const person of BLOCK_PERSONS[block]) {
    const personRu = PERSONS[person];
    targets[`${key}_row_${person.replace(/-/g, '_')}`] = {
      labelRu: `Строка «${personRu}» в блоке «${blockRu}»`,
      selectors: sel(`table.tt-block-${block} tr.tt-person-${person}`),
    };
  }
}

export default {
  tableKey: 'indicativePassiveTimes',
  summaryRu:
    'Сложные и страдательные времена. Над таблицами пояснение про простые времена действительного залога (образуются обычным способом: es rakstu, es rakstīju, es rakstīšu). Три блока по лицам (es, tu, viņš/viņa, mēs, jūs, viņi/viņas) с колонками без подписей — настоящее, прошедшее, будущее время вспомогательного глагола и два причастия (мужской и женский род). 1) Darāmās kārtas saliktie laiki: esmu / biju / būšu + bijis, bijusi (мн. ч. bijuši, bijušas). 2) Ciešamās kārtas vienkāršie laiki: tieku / tiku / tikšu + reģistrēts, reģistrēta (мн. ч. reģistrēti, reģistrētas). 3) Ciešamās kārtas saliktie laiki: esmu / biju / būšu + uzreģistrēts, uzreģistrēta (мн. ч. uzreģistrēti, uzreģistrētas). В страдательных блоках 3-е лицо разбито на строки viņš / viņa и viņi / viņas.',
  notesRu: [
    'Заголовки колонок в таблицах отсутствуют: слева направо — лицо, настоящее, прошедшее, будущее, причастие м. р., причастие ж. р.',
    'В страдательных блоках у 3-го лица формы вспомогательного глагола (tiek, tika, tiks / ir, bija, būs) объединены на две строки.',
    'Окончания причастий (-is, -usi, -ts, -ta и т. д.) выделены цветами: мужской и женский род разными.',
    'Свёрнутый блок «Показать как изображение» под таблицами не является содержанием.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица со сложными и страдательными временами', selectors: sel('.card.table-indicative') },
    title: { labelRu: 'Главный заголовок «SALIKTIE UN CIEŠAMĀS KĀRTAS LAIKI»', selectors: sel('.card.table-indicative h2') },
    intro: { labelRu: 'Пояснение про простые времена действительного залога (над таблицами)', selectors: sel('.indicative-note') },
    section_titles: { labelRu: 'Заголовки всех трёх блоков', selectors: sel('.indicative-section-title') },
    persons: { labelRu: 'Колонки с местоимениями во всех блоках', selectors: sel('.tt-col-person') },
    present: { labelRu: 'Колонки настоящего времени во всех блоках', selectors: sel('.tt-col-present') },
    past: { labelRu: 'Колонки прошедшего времени во всех блоках', selectors: sel('.tt-col-past') },
    future: { labelRu: 'Колонки будущего времени во всех блоках', selectors: sel('.tt-col-future') },
    participles_masculine: { labelRu: 'Причастия мужского рода (bijis, reģistrēts …)', selectors: sel('.tt-col-participle-masc') },
    participles_feminine: { labelRu: 'Причастия женского рода (bijusi, reģistrēta …)', selectors: sel('.tt-col-participle-fem') },
    endings_masculine: { labelRu: 'Окончания причастий мужского рода', selectors: sel('.indicative-ending-masc') },
    endings_feminine: { labelRu: 'Окончания причастий женского рода', selectors: sel('.indicative-ending-fem') },
    ...targets,
  },
};
