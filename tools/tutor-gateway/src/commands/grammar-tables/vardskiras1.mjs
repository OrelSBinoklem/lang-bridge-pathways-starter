import { sel } from './shared/pronoun.mjs';
import { partTargets, commonPartTargets } from './shared/partsOfSpeech.mjs';

/**
 * vardskiras1 — «Части речи» (TableVardskiras1): two group banners (Patstāvīgie vārdi — самостоятельные, Palīgvārdi —
 * служебные; vk-group--main / vk-group--aux), three cards (lietvārds, īpašības vārds, skaitļa vārds) and a line
 * "Продолжение — на следующей карточке". Card class tt-pos-<id>.
 */
const ITEMS = [
  ['lietvards', 'Lietvārds', 'substantīvs', 'существительное', 'Обозначает предметы и живые существа, а также действия и процессы, признаки, явления природы и отвлечённые понятия.', ['koks', 'māja', 'draugs', 'braukšana', 'prieks']],
  ['ipasibas-vards', 'Īpašības vārds', 'adjektīvs', 'прилагательное', 'Называет признак предмета или существа: форму и объём, цвет, температуру, время, характер.', ['liels', 'dzeltens', 'vēss', 'gudrs']],
  ['skaitla-vards', 'Skaitļa vārds', 'numerālis', 'числительное', 'Обозначает количество предметов или порядок, в котором они следуют друг за другом.', ['pieci', 'desmit', 'piektais']],
];

export default {
  tableKey: 'vardskiras1',
  summaryRu:
    'Части речи, первая карточка. Два больших класса: Patstāvīgie vārdi (самостоятельные слова — могут быть членами предложения) и Palīgvārdi (служебные — обычно не являются членами предложения). Здесь три самостоятельные части речи: lietvārds (существительное: koks, māja, draugs, braukšana, prieks), īpašības vārds (прилагательное: liels, dzeltens, vēss, gudrs), skaitļa vārds (числительное: pieci, desmit, piektais). Продолжение — на следующей карточке («Части речи — продолжение»).',
  notesRu: ['В таблице только три части речи из десяти; остальные — в таблице vardskiras2.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица «Части речи»', selectors: sel('.card.table-vardskiras1') },
    ...commonPartTargets(),
    groups: { labelRu: 'Две плашки: Patstāvīgie vārdi и Palīgvārdi', selectors: sel('.vk-groups') },
    group_independent: { labelRu: 'Patstāvīgie vārdi — самостоятельные слова', selectors: sel('.vk-group--main') },
    group_auxiliary: { labelRu: 'Palīgvārdi — служебные слова', selectors: sel('.vk-group--aux') },
    continued: { labelRu: 'Пометка «Продолжение — на следующей карточке»', selectors: sel('.vk-continued') },
    ...partTargets(ITEMS),
  },
};
