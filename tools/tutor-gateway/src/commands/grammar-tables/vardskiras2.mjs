import { sel } from './shared/pronoun.mjs';
import { partTargets, commonPartTargets } from './shared/partsOfSpeech.mjs';

/**
 * vardskiras2 — «Части речи — продолжение» (TableVardskiras2): three more independent parts of speech
 * (vk-card--main), a divider "Palīgvārdi" (vk-divider), three auxiliary ones (vk-card--aux) and interjection outside
 * the classification (vk-card--outside). Card class tt-pos-<id>.
 */
const MAIN = [
  ['vietniekvards', 'Vietniekvārds', 'pronomens', 'местоимение', 'Заменяет существительное, прилагательное или числительное — указывает на предмет, признак или количество, ничего не называя напрямую.', ['es', 'viņš', 'mans', 'kāds']],
  ['darbibas-vards', 'Darbības vārds', 'verbs', 'глагол', 'Выражает действие, процесс или состояние. Divdabis (причастие) — особая форма глагола, соединяющая его с прилагательным или наречием.', ['braukt', 'rakstīt', 'gulēt']],
  ['apstakla-vards', 'Apstākļa vārds', 'adverbs', 'наречие', 'Неизменяемое слово, называющее признак действия, признака или другого наречия.', ['ātri', 'labi', 'ļoti']],
];
const AUX = [
  ['prievards', 'Prievārds', 'prepozīcija', 'предлог', 'Неизменяемое служебное слово, которое связывает падежную форму слова с другим словом.', ['aiz', 'uz', 'no', 'pēc']],
  ['saiklis', 'Saiklis', 'konjunkcija', 'союз', 'Связывает однородные члены предложения, словосочетания, части или целые предложения.', ['un', 'bet', 'jo', 'vai']],
  ['partikula', 'Partikula', 'частица', 'частица', 'Придаёт слову или всему высказыванию смысловой оттенок: ограничение, усиление, отрицание, сомнение и др.', ['tikai', 'arī', 'nē', 'vai']],
];
const OUTSIDE = [
  ['izsauksmes-vards', 'Izsauksmes vārds', 'interjekcija', 'междометие', 'Вне классификации: неизменяемое слово, выражающее чувства, волю или подражающее звукам; ничего не называет, а лишь указывает на эмоцию или привлекает внимание; сюда же относят вежливые формулы.', ['ai!', 'stop!', 'mjau', 'Paldies!']],
];

export default {
  tableKey: 'vardskiras2',
  summaryRu:
    'Части речи — продолжение. Самостоятельные: vietniekvārds (местоимение: es, viņš, mans, kāds), darbības vārds (глагол: braukt, rakstīt, gulēt; divdabis — особая форма глагола), apstākļa vārds (наречие: ātri, labi, ļoti). Palīgvārdi (служебные): prievārds (предлог: aiz, uz, no, pēc), saiklis (союз: un, bet, jo, vai), partikula (частица: tikai, arī, nē, vai). Вне классификации: izsauksmes vārds (междометие: ai!, stop!, mjau, Paldies!) — выражает чувства, волю или подражает звукам, сюда же относят вежливые формулы.',
  notesRu: ['Начало — в таблице vardskiras1 (существительное, прилагательное, числительное).'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица «Части речи — продолжение»', selectors: sel('.card.table-vardskiras2') },
    ...commonPartTargets(),
    independent_cards: { labelRu: 'Три самостоятельные части речи (местоимение, глагол, наречие)', selectors: sel('.vk-card--main') },
    auxiliary_cards: { labelRu: 'Три служебные части речи (предлог, союз, частица)', selectors: sel('.vk-card--aux') },
    auxiliary_divider: { labelRu: 'Разделитель «Palīgvārdi — служебные слова»', selectors: sel('.vk-divider') },
    outside_card: { labelRu: 'Междометие — вне классификации', selectors: sel('.vk-card--outside') },
    ...partTargets([...MAIN, ...AUX, ...OUTSIDE]),
  },
};
