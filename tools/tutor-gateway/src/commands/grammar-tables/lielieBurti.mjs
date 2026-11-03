import { sel } from './shared/pronoun.mjs';
import { wordId } from './shared/words.mjs';

/**
 * lielieBurti — «Lielie sākumburti nosaukumos» (TableLielieBurti): three rules lb-rule--first | all | after, each with
 * a head (lb-num, lb-name, lb-lv), a list of frequent cases (lb-item + tt-item-<wordId(example)>: label ⭐ + example with
 * lb-cap on each capital letter) and a line "Реже" (lb-rare); a note at the bottom (lb-note).
 */
const RULES = {
  first: ['Только первое слово (tikai pirmo vārdu)', [
    ['география', 'Vidzemes augstiene'], ['праздники', 'Mātes diena'], ['книги и фильмы', 'romāns „Zvejnieka dēls”'], ['должности и учреждения', 'Ministru prezidents'],
  ], 'исторические события, премии, памятники'],
  all: ['Все значимые слова (visus pilnas nozīmes vārdus)', [
    ['страны', 'Igaunijas Republika'], ['международные организации', 'Pasaules Veselības Organizācija'], ['вуз «место + Universitāte»', 'Latvijas Universitāte'],
  ], 'газеты и журналы, созвездия, ордена'],
  after: ['Имя + следующее слово (pirmo vārdu aiz īpašvārda, 3+ слов)', [
    ['учебные заведения', 'Latvijas Mākslas akadēmija'], ['учреждения', 'Latvijas Nacionālā opera'],
  ], 'некоторые государственные праздники, названия со словами valsts, tautas, olimpiskais'],
};

const items = {};
for (const [, [, list]] of Object.entries(RULES).map((e) => [e[0], e[1]])) {
  for (const [label, example] of list) {
    items[`item_${wordId(example).replace(/-/g, '_')}`] = { labelRu: `${label}: ${example}`, selectors: sel(`.tt-item-${wordId(example)}`) };
  }
}

export default {
  tableKey: 'lielieBurti',
  summaryRu:
    'Заглавные буквы в названиях (lielie sākumburti nosaukumos). 17 категорий сведены к трём правилам. 1) Только первое слово: география (Vidzemes augstiene), праздники (Mātes diena), книги и фильмы (romāns „Zvejnieka dēls”), должности и учреждения (Ministru prezidents); реже — исторические события, премии, памятники. 2) Все значимые слова: страны (Igaunijas Republika), международные организации (Pasaules Veselības Organizācija), вуз «место + Universitāte» (Latvijas Universitāte); реже — газеты и журналы, созвездия, ордена. 3) Имя + следующее слово (3+ слов): учебные заведения (Latvijas Mākslas akadēmija), учреждения (Latvijas Nacionālā opera); реже — некоторые государственные праздники, названия со словами valsts, tautas, olimpiskais. Звёздочка ⭐ — встречается чаще всего; зелёным отмечены буквы, которые пишутся заглавными.',
  notesRu: ['Частые случаи отмечены ⭐, редкие только названы в строке «Реже».'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица про заглавные буквы', selectors: sel('.card.table-lielie-burti') },
    title: { labelRu: 'Заголовок «Lielie sākumburti nosaukumos»', selectors: sel('.vs-head') },
    rule_first: { labelRu: 'Правило 1: заглавная только у первого слова', selectors: sel('.lb-rule--first') },
    rule_all: { labelRu: 'Правило 2: заглавные у всех значимых слов', selectors: sel('.lb-rule--all') },
    rule_after: { labelRu: 'Правило 3: имя + следующее слово (3+ слов)', selectors: sel('.lb-rule--after') },
    rule_heads: { labelRu: 'Названия трёх правил', selectors: sel('.lb-rule-head') },
    items: { labelRu: 'Все частые случаи с примерами (⭐)', selectors: sel('.lb-item') },
    labels: { labelRu: 'Названия категорий (география, праздники, страны …)', selectors: sel('.lb-label') },
    examples: { labelRu: 'Примеры названий', selectors: sel('.lb-example') },
    capital_letters: { labelRu: 'Заглавные буквы в примерах (выделены зелёным)', selectors: sel('.lb-cap') },
    rare: { labelRu: 'Строки «Реже» с редкими случаями', selectors: sel('.lb-rare') },
    note: { labelRu: 'Пояснение внизу про ⭐ и зелёные буквы', selectors: sel('.lb-note') },
    ...Object.fromEntries(Object.keys(RULES).map((id) => [`rare_${id}`, { labelRu: `Реже: ${RULES[id][2]}`, selectors: sel(`.lb-rule--${id} .lb-rare`) }])),
    ...items,
  },
};
