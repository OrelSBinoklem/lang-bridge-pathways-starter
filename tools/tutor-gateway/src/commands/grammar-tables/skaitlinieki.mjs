import { sel } from './shared/pronoun.mjs';
import { wordId } from './shared/words.mjs';

/**
 * skaitlinieki — «Единственное и множественное число» (TableSkaitlinieki): two columns sn-col--sg (Vienskaitlinieki)
 * and sn-col--pl (Daudzskaitlinieki), each with a rule and groups (sn-group + tt-group-<id>) of words
 * (sn-word + tt-word-<wordId>, sn-gloss = translation). Group ids: substances, abstract, traits, places (in both
 * columns), pairs, feelings, grains, holidays, houses.
 */
const SG = [
  ['substances', 'вещества', ['medus — мёд', 'cukurs — сахар', 'zelts — золото']],
  ['abstract', 'абстрактные понятия', ['mīlestība — любовь', 'veselība — здоровье', 'miers — покой']],
  ['traits', 'черты характера', ['drosme — смелость', 'godīgums — честность', 'pacietība — терпение']],
  ['places', 'названия мест', ['Sigulda', 'Kuldīga']],
];
const PL = [
  ['pairs', 'парные предметы', ['šķēres — ножницы', 'svārki — юбка', 'ragavas — санки']],
  ['feelings', 'чувства', ['dusmas — гнев', 'bailes — страх']],
  ['grains', 'злаки', ['rudzi — рожь', 'auzas — овёс']],
  ['holidays', 'праздники и события', ['Lieldienas — Пасха', 'Vasarsvētki — Троица', 'Mārtiņi — Мартынов день']],
  ['houses', 'названия домов', ['„Ozoliņi”']],
  ['places', 'названия мест', ['Cēsis', 'Talsi']],
];

const groupTargets = {};
const wordTargets = {};
for (const [col, groups] of [['sg', SG], ['pl', PL]]) {
  for (const [id, ru, words] of groups) {
    groupTargets[`group_${col}_${id}`] = {
      labelRu: `${col === 'sg' ? 'Только ед. число' : 'Только мн. число'}, группа «${ru}»: ${words.join(', ')}`,
      selectors: sel(`.sn-col--${col} .tt-group-${id}`),
    };
    for (const w of words) {
      const lv = w.split(' — ')[0];
      wordTargets[`word_${wordId(lv).replace(/-/g, '_')}`] = { labelRu: `Слово ${lv}${w.includes(' — ') ? ` — ${w.split(' — ')[1]}` : ''}`, selectors: sel(`.tt-word-${wordId(lv)}`) };
    }
  }
}

export default {
  tableKey: 'skaitlinieki',
  summaryRu:
    'Существительные, которые употребляются только в одном числе. Слева Vienskaitlinieki (vsk., только единственное число): вещества (medus — мёд, cukurs — сахар, zelts — золото), абстрактные понятия (mīlestība — любовь, veselība — здоровье, miers — покой), черты характера (drosme — смелость, godīgums — честность, pacietība — терпение), названия мест (Sigulda, Kuldīga). Справа Daudzskaitlinieki (dsk., только множественное число): парные предметы (šķēres — ножницы, svārki — юбка, ragavas — санки), чувства (dusmas — гнев, bailes — страх), злаки (rudzi — рожь, auzas — овёс), праздники и события (Lieldienas — Пасха, Vasarsvētki — Троица, Mārtiņi — Мартынов день), названия домов („Ozoliņi”), названия мест (Cēsis, Talsi). В обеих колонках порядок один: конкретное → абстрактное → имена собственные.',
  notesRu: ['Правила в колонках: Lietvārdi, kas lietojami tikai vienskaitļa (daudzskaitļa) formā.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица про единственное и множественное число', selectors: sel('.card.table-skaitlinieki') },
    title: { labelRu: 'Заголовок «Единственное и множественное число»', selectors: sel('.vs-head') },
    column_singular: { labelRu: 'Колонка Vienskaitlinieki (только единственное число)', selectors: sel('.sn-col--sg') },
    column_plural: { labelRu: 'Колонка Daudzskaitlinieki (только множественное число)', selectors: sel('.sn-col--pl') },
    column_heads: { labelRu: 'Названия двух колонок', selectors: sel('.sn-col-head') },
    rules: { labelRu: 'Правила под названиями колонок', selectors: sel('.sn-rule') },
    groups: { labelRu: 'Все группы слов', selectors: sel('.sn-group') },
    group_labels: { labelRu: 'Названия групп (вещества, чувства, злаки …)', selectors: sel('.sn-label') },
    words: { labelRu: 'Все слова-примеры', selectors: sel('.sn-word') },
    glosses: { labelRu: 'Русские переводы слов', selectors: sel('.sn-gloss') },
    places_both: { labelRu: 'Названия мест в обеих колонках (Sigulda, Kuldīga, Cēsis, Talsi)', selectors: sel('.tt-group-places') },
    ...groupTargets,
    ...wordTargets,
  },
};
