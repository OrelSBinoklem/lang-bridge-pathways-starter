import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'relativeClause',
  summaryRu: 'M30, первый слой B1: относительное придаточное с kurš/kura. Четыре колонки: определяемое слово, местоименная связь, роль местоимения, придаточная часть. Шесть строк: два исполнителя, объект, адресат и два местных значения.',
  notesRu: [
    'Колонки содержат фрагменты модели. Главная часть для actor-male: Es pazīstu autoru; для actor-female: Es redzu rakstnieci. Между главной и придаточной частями ставится запятая.',
    'Kurš/kura согласуются с определяемым словом в роде и числе. Падеж определяется ролью внутри придаточного, не падежом antecedent: autoru, kurš; rakstnieci, kura.',
    'В object форма kuru — винительный, в recipient kuram — дательный, в place/places kurā/kurās — местный. Последняя строка относится к женскому множественному grāmatas.',
    'Kas тоже допустимо в относительной связи. Задания явно ограничены семьёй kurš/kura, не запрещай kas в свободной речи.',
    'Генитив, предложные связи и другие виды придаточных — расширение, не проверяемые эталоны этого слоя.',
    'Кружки и рекорды относятся к исходным подэтапам. Размонтированную таблицу сначала запроси событием grammar.table.reveal.',
  ],
  highlightTargets: {
    all: { labelRu: 'Относительное придаточное · вся таблица', selectors: sel('.table-relative-clause') },
    rule: { labelRu: 'Род/число по слову, падеж по роли внутри придаточного', selectors: sel('.tt-rule') },
    warning: { labelRu: 'Первый слой B1 и допустимое kas', selectors: sel('.tt-warning') },
    noun: { labelRu: 'Определяемое слово', selectors: sel('.tt-noun') },
    link: { labelRu: 'Формы kurš/kura', selectors: sel('.tt-link') },
    role: { labelRu: 'Роль внутри придаточного', selectors: sel('.tt-role') },
    clause: { labelRu: 'Придаточная часть', selectors: sel('.tt-clause') },
    actorMale: { labelRu: 'Autoru, kurš: разный падеж частей', selectors: sel('.tt-row-actor-male') },
    actorFemale: { labelRu: 'Rakstnieci, kura: исполнительница', selectors: sel('.tt-row-actor-female') },
    object: { labelRu: 'Grāmatu, kuru: объект чтения', selectors: sel('.tt-row-object') },
    recipient: { labelRu: 'Rakstnieks, kuram: адресат', selectors: sel('.tt-row-recipient') },
    place: { labelRu: 'Lasītava, kurā: место', selectors: sel('.tt-row-place') },
    places: { labelRu: 'Grāmatas, kurās: женское множественное', selectors: sel('.tt-row-places') },
  },
};
