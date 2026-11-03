import { sel } from './shared/pronoun.mjs';

/**
 * savrupinajumi2 — «Обособленные обстоятельства» (TableSavrupinajumi2): intro, three kinds (sv-kind + tt-kind-place |
 * time | manner) and a block "❗ Не обособляют" (sv-not) with two examples (sv-kind + tt-not-1 | tt-not-2).
 */
export default {
  tableKey: 'savrupinajumi2',
  summaryRu:
    'Обособленные обстоятельства (savrupināts apstāklis): уточняют обстоятельство и стоят сразу после обстоятельства того же вида. Три вида: место → место (Tur, kalnos, vēl ir sniegs. — Там, в горах, ещё лежит снег.), время → время (Tas bija sen — pirms desmit gadiem. — Это было давно — десять лет назад.), образ действия → образ действия (Viņš runāja klusi, gandrīz čukstus. — Он говорил тихо, почти шёпотом.). Блок «Не обособляют»: время по часам после дня или даты (Piektdien plkst. 18.00 sāksies koncerts. — В пятницу в 18:00 начнётся концерт.) и разные обстоятельства подряд (Rīt Siguldā notiks velobrauciens. — Завтра в Сигулде будет велопробег.).',
  notesRu: ['Обособленная часть, запятые и тире в примерах выделены цветом.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица про обособленные обстоятельства', selectors: sel('.card.table-savrupinajumi') },
    title: { labelRu: 'Заголовок «Обособленные обстоятельства»', selectors: sel('.vs-head') },
    intro: { labelRu: 'Вступление: обстоятельство того же вида', selectors: sel('.sv-intro') },
    kind_place: { labelRu: 'Вид «место → место»: Tur, kalnos, vēl ir sniegs.', selectors: sel('.tt-kind-place') },
    kind_time: { labelRu: 'Вид «время → время»: Tas bija sen — pirms desmit gadiem.', selectors: sel('.tt-kind-time') },
    kind_manner: { labelRu: 'Вид «образ действия → образ действия»: Viņš runāja klusi, gandrīz čukstus.', selectors: sel('.tt-kind-manner') },
    kind_labels: { labelRu: 'Подписи видов (место → место и т. д.)', selectors: sel('.sv-kind-label') },
    not_separated: { labelRu: 'Блок «Не обособляют» целиком', selectors: sel('.sv-not') },
    not_separated_head: { labelRu: 'Заголовок «❗ Не обособляют»', selectors: sel('.sv-not-head') },
    not_clock_time: { labelRu: 'Не обособляют: время по часам после дня (Piektdien plkst. 18.00 …)', selectors: sel('.tt-not-1') },
    not_different: { labelRu: 'Не обособляют: разные обстоятельства подряд (Rīt Siguldā …)', selectors: sel('.tt-not-2') },
    samples: { labelRu: 'Все примеры предложений', selectors: sel('.sv-sample') },
    separated_parts: { labelRu: 'Обособленные части в примерах (выделены)', selectors: sel('.sv-hit') },
    punctuation: { labelRu: 'Запятые и тире в примерах', selectors: sel('.sv-pn') },
    translations: { labelRu: 'Русские переводы примеров', selectors: sel('.sv-sample-ru') },
  },
};
