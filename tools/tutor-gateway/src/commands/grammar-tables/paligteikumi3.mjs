import { sel } from './shared/pronoun.mjs';
import { wordId } from './shared/words.mjs';

/**
 * paligteikumi3 — «Наиболее часто используемые вводные слова придаточных предложений» (TablePaligteikumi3): four
 * groups pt-group--conj | pron | adv | comb with lists; every li is `pt-li tt-word-<group>-<wordId(lv)>`, traps pt-li--trap.
 */
const GROUPS = {
  conj: ['Pakārtojuma saikļi — подчинительные союзы', [
    ['ka', 'что'], ['vai', 'ли'], ['ja', 'если'], ['lai', 'чтобы'], ['jo · tāpēc ka · tādēļ ka', 'потому что'],
    ['tā kā', 'так как (причина)'], ['tā ka', 'так что (следствие)'], ['līdz', 'пока, до того как'], ['tiklīdz', 'как только'],
    ['lai gan · lai arī · kaut gan · kaut arī', 'хотя'],
  ]],
  pron: ['Attieksmes vietniekvārdi — относительные местоимения (во всех падежах)', [
    ['kas', 'кто, что, который'], ['kurš · kura', 'который, которая'], ['kāds · kāda', 'какой, какая'],
  ]],
  adv: ['Apstākļa vārdi — наречия', [
    ['kad', 'когда'], ['kur', 'где'], ['kā', 'как'], ['cik', 'сколько'], ['kamēr', 'пока'], ['kāpēc · kādēļ', 'почему, зачем'],
  ]],
  comb: ['Vārdu savienojumi — сочетания', [
    ['uz kurieni', 'куда'], ['no kurienes', 'откуда'], ['līdz kurienei', 'докуда'],
  ]],
};

const groupTargets = {};
const wordTargets = {};
for (const [id, [ru, rows]] of Object.entries(GROUPS)) {
  groupTargets[`group_${id}`] = { labelRu: `Группа: ${ru}`, selectors: sel(`.pt-group--${id}`) };
  for (const [lv, meaning] of rows) {
    wordTargets[`word_${id}_${wordId(lv).replace(/-/g, '_')}`] = {
      labelRu: `${lv} — ${meaning} (${ru.split(' — ')[0]})`,
      selectors: sel(`.tt-word-${id}-${wordId(lv)}`),
    };
  }
}

export default {
  tableKey: 'paligteikumi3',
  summaryRu:
    'Наиболее частые слова, вводящие придаточные предложения, в четырёх группах. Pakārtojuma saikļi (подчинительные союзы): ka — что, vai — ли, ja — если, lai — чтобы, jo · tāpēc ka · tādēļ ka — потому что, tā kā — так как (причина), tā ka — так что (следствие), līdz — пока, до того как, tiklīdz — как только, lai gan · lai arī · kaut gan · kaut arī — хотя. Attieksmes vietniekvārdi (относительные местоимения, во всех падежах): kas — кто, что, который; kurš · kura; kāds · kāda. Apstākļa vārdi (наречия): kad, kur, kā, cik, kamēr, kāpēc · kādēļ. Vārdu savienojumi (сочетания): uz kurieni — куда, no kurienes — откуда, līdz kurienei — докуда. Внизу предупреждение: tā kā и tā ka отличаются одной долготой, но смысл противоположный — причина и следствие.',
  notesRu: ['Пара tā kā / tā ka помечена как ловушка (pt-li--trap) и в предупреждении внизу.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица слов, вводящих придаточные', selectors: sel('.card.table-paligteikumi') },
    title: { labelRu: 'Заголовок таблицы', selectors: sel('.vs-head') },
    groups: { labelRu: 'Все четыре группы', selectors: sel('.pt-group') },
    group_heads: { labelRu: 'Названия групп', selectors: sel('.pt-group-head') },
    items: { labelRu: 'Все слова списков', selectors: sel('.pt-li') },
    traps: { labelRu: 'Слова-ловушки tā kā и tā ka', selectors: sel('.pt-li--trap') },
    warning: { labelRu: 'Предупреждение про tā kā и tā ka', selectors: sel('.pt-foot--warn') },
    ...groupTargets,
    ...wordTargets,
  },
};
