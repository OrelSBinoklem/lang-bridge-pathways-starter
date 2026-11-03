import { sel } from './shared/pronoun.mjs';

/**
 * consonant — Līdzskaņu mija (чередование согласных). Rows of pairs like "c - č"; a row is
 * labelled "сущ." (nouns) or "гл." (verbs), the last row has no label. Component classes:
 *   rows:  tt-nouns | tt-verbs | tt-unlabeled
 *   pairs: tt-kind-hushing | softening | labial-j | cluster | velar
 * The "kind" grouping is ours (for highlighting); the table itself only labels rows as nouns/verbs.
 */
export default {
  tableKey: 'consonant',
  summaryRu:
    'Чередование согласных (līdzskaņu mija): пары вида «c - č», «n - ņ», «p - pj». Строки помечены «сущ.» (существительные) или «гл.» (глаголы); в последней строке пометки нет. Все пары: c-č, n-ņ, p-pj, zl-žļ, c-k, s-š, b-bj, sn-šņ, dz-dž, z-ž, m-mj, zn-žņ, dz-g, t-š, v-vj, ln-ļņ, l-ļ, d-ž, sl-šļ.',
  notesRu: [
    'Строки 1 и 3 подписаны «сущ.», строки 2 и 4 — «гл.», последняя строка (l-ļ, d-ž, sl-šļ) без подписи.',
    'Деление пар на виды (шипящие, смягчение, губные + j, сочетания, заднеязычные) сделано для подсветки, в самой таблице этих названий нет.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица чередования согласных', selectors: sel('.card.table-consonant') },
    header: { labelRu: 'Заголовок «LĪDZSKAŅU MIJA»', selectors: sel('.consonant-header-title') },
    pairs: { labelRu: 'Все пары согласных', selectors: sel('.consonant-cell-pair') },
    row_labels: { labelRu: 'Колонка с пометками «сущ.» / «гл.»', selectors: sel('.consonant-cell-type') },
    nouns: { labelRu: 'Строки для существительных («сущ.»)', selectors: sel('.consonant-row.tt-nouns') },
    verbs: { labelRu: 'Строки для глаголов («гл.»)', selectors: sel('.consonant-row.tt-verbs') },
    unlabeled_row: { labelRu: 'Последняя строка без пометки: l-ļ, d-ž, sl-šļ', selectors: sel('.consonant-row.tt-unlabeled') },
    hushing: {
      labelRu: 'Пары с шипящими и аффрикатами: c-č, s-š, dz-dž, z-ž, t-š, d-ž',
      selectors: sel('.tt-kind-hushing'),
    },
    softening: { labelRu: 'Смягчение: n-ņ, l-ļ', selectors: sel('.tt-kind-softening') },
    labial_j: { labelRu: 'Губные с добавлением j: p-pj, b-bj, m-mj, v-vj', selectors: sel('.tt-kind-labial-j') },
    clusters: {
      labelRu: 'Сочетания согласных: zl-žļ, sn-šņ, zn-žņ, ln-ļņ, sl-šļ',
      selectors: sel('.tt-kind-cluster'),
    },
    velar: { labelRu: 'Пары с заднеязычными k, g: c-k, dz-g', selectors: sel('.tt-kind-velar') },
  },
};
