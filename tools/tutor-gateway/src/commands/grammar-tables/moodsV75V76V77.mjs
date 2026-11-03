import { sel } from './shared/pronoun.mjs';

/**
 * moodsV75V76V77 — «НАКЛОНЕНИЯ V75-V76-V77» (component TableMoodV75v76v77), a flex grid with three sections:
 *  1. Vajadzības izteiksme (долженствовательное): header Kam? | Tagadne / Pagātne / Nākotne | formula; two rows
 *     (ir / bija / būs + jābrauc, jāpērk maize); the left cell says «любое лицо (в дативе)».
 *  2. Vēlējuma izteiksme (условное): header Nenoteiksme | Kas? | Vēlējuma izteiksme; rows gribēt → gribētu,
 *     interesēties → interesētos; the middle cell says «любое лицо».
 *  3. Pavēles izteiksme (повелительное): header Kas? | tagadnes 1. persona | Pavēles izteiksme; rows es, tu, viņš/viņa/viņi/viņas, mēs, jūs.
 * Component classes (TableMoodV75v76v77.jsx):
 *   titles: tt-section-necessity | tt-section-wish | tt-section-imperative
 *   headers: tt-necessity-header | tt-wish-header | tt-imperative-header
 *   rows: tt-necessity-row(+ -1, -2) | tt-wish-row(+ -1, -2) | tt-imperative-row + tt-person-es|tu|third|mes|jus
 *   cells: tt-necessity-verbs (ir | bija | būs), imperative rows: tt-col-person | tt-col-first-person | tt-col-imperative
 */
const PERSONS = {
  es: 'es (я)',
  tu: 'tu (ты)',
  third: 'viņš, viņa, viņi, viņas (он, она, они)',
  mes: 'mēs (мы)',
  jus: 'jūs (вы)',
};
const personTargets = {};
for (const [id, ru] of Object.entries(PERSONS)) {
  personTargets[`imperative_${id}`] = { labelRu: `Повелительное наклонение, строка «${ru}»`, selectors: sel(`.tt-imperative-row.tt-person-${id}`) };
}

export default {
  tableKey: 'moodsV75V76V77',
  summaryRu:
    'Три наклонения. 1) Vajadzības izteiksme (долженствовательное): вопрос Kam?, времена Tagadne / Pagātne / Nākotne выражаются вспомогательным глаголом ir / bija / būs, а сам глагол получает приставку jā- + форму 3-го лица настоящего времени (jābrauc, jāpērk maize); подлежащее любого лица стоит в дативе. 2) Vēlējuma izteiksme (условное): инфинитив → форма на -tu или -tos у возвратных: gribēt → gribētu, interesēties → interesētos; любое лицо. 3) Pavēles izteiksme (повелительное): от формы 1-го лица настоящего времени. es — нет формы; tu — nāc!, celies!; viņš, viņa, viņi, viņas — lai nāk!, lai ceļas!; mēs — nāksim!, celsimies! (будущее время); jūs — nāciet!, celieties!.',
  notesRu: [
    'В блоке долженствования подписано: «ā- + tagadnes 3. persona + Nominativs» — это формула из таблицы; в примерах приставка jā- выделена цветом.',
    'В блоке условного наклонения окончания -tu / -tos выделены цветом.',
    'В повелительном: «lai» и «Nākotne» (форма mēs) и окончания -iet / -ieties выделены цветом.',
    'Свёрнутый блок «Показать как изображение» под таблицей не является содержанием.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица наклонений', selectors: sel('.card.table-mood-v75v76v77') },
    title: { labelRu: 'Заголовок «НАКЛОНЕНИЯ V75-V76-V77»', selectors: sel('.card.table-mood-v75v76v77 h2') },
    section_necessity: { labelRu: 'Заголовок блока «Vajadzības izteiksme» (долженствовательное)', selectors: sel('.tt-section-necessity') },
    section_wish: { labelRu: 'Заголовок блока «Vēlējuma izteiksme» (условное)', selectors: sel('.tt-section-wish') },
    section_imperative: { labelRu: 'Заголовок блока «Pavēles izteiksme» (повелительное)', selectors: sel('.tt-section-imperative') },
    necessity_header: { labelRu: 'Шапка блока долженствования: Kam?, Tagadne / Pagātne / Nākotne, формула', selectors: sel('.tt-necessity-header') },
    necessity_formula: { labelRu: 'Формула долженствовательного наклонения', selectors: sel('.mood-formula-cell') },
    necessity_rows: { labelRu: 'Примеры долженствования: ir / bija / būs + jābrauc, jāpērk maize', selectors: sel('.tt-necessity-row') },
    necessity_verbs: { labelRu: 'Вспомогательный глагол ir / bija / būs в примерах', selectors: sel('.tt-necessity-verbs') },
    necessity_prefix: { labelRu: 'Приставка jā- в примерах долженствования', selectors: sel('.tt-necessity-row .mood-v75v76v77-ending-ja') },
    wish_header: { labelRu: 'Шапка блока условного наклонения: Nenoteiksme, Kas?, Vēlējuma izteiksme', selectors: sel('.tt-wish-header') },
    wish_rows: { labelRu: 'Примеры условного наклонения: gribēt → gribētu, interesēties → interesētos', selectors: sel('.tt-wish-row') },
    wish_endings: { labelRu: 'Окончания -tu / -tos в условном наклонении', selectors: sel('.tt-wish-row .mood-v75v76v77-ending-tu') },
    imperative_header: { labelRu: 'Шапка блока повелительного: Kas?, tagadnes 1. persona, Pavēles izteiksme', selectors: sel('.tt-imperative-header') },
    imperative_rows: { labelRu: 'Все строки повелительного наклонения', selectors: sel('.tt-imperative-row') },
    imperative_persons: { labelRu: 'Колонка лиц в повелительном (es, tu, viņš…, mēs, jūs)', selectors: sel('.tt-imperative-row .tt-col-person') },
    imperative_first_person: { labelRu: 'Колонка «tagadnes 1. persona» (nāku, celos …)', selectors: sel('.tt-col-first-person') },
    imperative_forms: { labelRu: 'Колонка форм повелительного наклонения (nāc!, celies! …)', selectors: sel('.tt-col-imperative') },
    imperative_markers: { labelRu: 'Выделенные цветом: lai, Nākotne, -iet, -ieties', selectors: sel('.tt-imperative-row .mood-v75v76v77-ending-tu') },
    ...personTargets,
  },
};
