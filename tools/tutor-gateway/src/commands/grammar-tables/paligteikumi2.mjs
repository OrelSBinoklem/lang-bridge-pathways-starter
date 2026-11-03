import { sel } from './shared/pronoun.mjs';
import { typeTargets, commonCardTargets } from './shared/paligteikumi.mjs';

/**
 * paligteikumi2 — «Придаточные предложения — расширенная таблица» (TablePaligteikumi2): legend and 13 type cards
 * (apzīmētāja … seku). Cards carry tt-type-<wordId(lv)>; see shared/paligteikumi.mjs for the inner classes.
 */
const TYPES = [
  ['Apzīmētāja', 'определительное', 'Kāds? Kurš?', 'kas · kurš · kāds · ka · lai · kur · kad · kāpēc', ['aiz']],
  ['Papildinātāja', 'изъяснительное', 'Ko? Kam? Par ko?', 'ka · vai · kas · kurš · kā · kur · kad', ['aiz', 'starp']],
  ['Vietas', 'места', 'Kur? Kurp? No kurienes?', 'kur · kurp · no kurienes · uz kurieni', ['aiz', 'starp', 'pirms']],
  ['Laika', 'времени', 'Kad? Cik ilgi?', 'kad · kamēr · līdz · kolīdz · tiklīdz · kopš · pirms', ['aiz', 'starp', 'pirms']],
  ['Veida', 'образа действия', 'Kā? Kādā veidā?', 'kā · ka · lai · cik', ['aiz', 'starp', 'pirms']],
  ['Mēra', 'меры', 'Cik? Kādā mērā?', 'cik · ka · lai', ['aiz']],
  ['Cēloņa', 'причины', 'Kāpēc? Kālab?', 'tāpēc ka · tālab ka · tā kā · ka', ['aiz', 'pirms']],
  ['Nolūka', 'цели', 'Kādēļ? Kādam nolūkam?', 'lai', ['aiz', 'starp', 'pirms']],
  ['Nosacījuma', 'условия', 'Kādā gadījumā?', 'ja', ['aiz', 'starp', 'pirms']],
  ['Pamatojuma', 'обоснования', '—', 'jo (или без союза)', ['aiz']],
  ['Pieļāvuma', 'уступки', '—', 'kaut gan · kaut arī · lai gan · lai arī', ['aiz', 'starp', 'pirms']],
  ['Salīdzinājuma', 'сравнения', '—', 'it kā · kā · nekā · jo … jo', ['aiz', 'pirms']],
  ['Seku', 'следствия', '—', 'tā ka · ka (retāk)', ['aiz']],
];

export default {
  tableKey: 'paligteikumi2',
  summaryRu:
    'Расширенная таблица типов придаточных предложений — 13 карточек. Для каждого дан вопрос, союзы, позиции относительно главного и пример. ' +
    TYPES.map(([lv, ru, q, words]) => `${lv} (${ru}${q === '—' ? '' : `, ${q}`}): ${words}`).join('; ') +
    '. Примеры: Viņš bija cilvēks, kas vienmēr meklēja ko jaunu.; Es eju tur, kur acis rāda.; Bija jau vēls, kad pārnācām.; Atvēru logu, lai izvēdinātu istabu.; Ja vajadzēs, mēs palīdzēsim.; Kaut arī rīts bija saulains, bija auksti.; Jo ātrāk sāksim, jo ātrāk beigsim.; Ilgi staigājām, tā ka kājas bija nogurušas.',
  notesRu: ['У типов без вопроса (обоснования, уступки, сравнения, следствия) вместо вопроса стоит «—».'],
  highlightTargets: {
    all: { labelRu: 'Вся расширенная таблица придаточных', selectors: sel('.card.table-paligteikumi') },
    title: { labelRu: 'Заголовок «Придаточные предложения — расширенная таблица»', selectors: sel('.vs-head') },
    ...commonCardTargets(),
    ...typeTargets(TYPES),
  },
};
