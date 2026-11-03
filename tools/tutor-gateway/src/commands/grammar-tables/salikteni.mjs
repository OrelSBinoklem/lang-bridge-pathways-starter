import { sel } from './shared/pronoun.mjs';
import { wordId } from './shared/words.mjs';

/**
 * salikteni — «Составные слова» (TableSalikteni): a hero formula (vārds + vārds = salikteņi), three numbered rules
 * (sk-rule + tt-rule-keep | cut | tail) with examples (sk-formula + tt-formula-<a>-<b>): source words with sk-part--a/b,
 * cut ending sk-cut, new ending sk-tail, and the assembled compound (sk-word--res); a colour legend at the bottom.
 */
const EXAMPLES = [
  ['keep', 'saules', 'puķe', 'saules + puķe → saulespuķe'],
  ['keep', 'ūdens', 'roze', 'ūdens + roze → ūdensroze'],
  ['cut', 'sarun', 'biedrs', 'saruna (-a отпадает) + biedrs → sarunbiedrs'],
  ['cut', 'vied', 'tālrunis', 'viedais (-ais отпадает) + tālrunis → viedtālrunis'],
  ['cut', 'mašīn', 'tulks', 'mašīna (-a отпадает) + tulks → mašīntulks'],
  ['tail', 'bērz', 'lap', 'bērzs + lapa → bērzlape (второе слово получает -e)'],
  ['tail', 'brūn', 'ac', 'brūns + acs → brūnacis (второе слово получает -is)'],
];
const examples = Object.fromEntries(
  EXAMPLES.map(([, a, b, ru]) => [`example_${wordId(`${a} ${b}`).replace(/-/g, '_')}`, { labelRu: `Пример: ${ru}`, selectors: sel(`.tt-formula-${wordId(`${a} ${b}`)}`) }]),
);

export default {
  tableKey: 'salikteni',
  summaryRu:
    'Составные слова (saliktenis): vārds + vārds = saliktenis. Три правила. 1) Оба слова целиком (abi vārdi saglabā savu formu): saules + puķe, ūdens + roze. 2) Первое слово теряет окончание (pirmais vārds zaudē galotni): sarun(a) + biedrs, vied(ais) + tālrunis, mašīn(a) + tulks. 3) Второе слово меняет окончание (otrais vārds iegūst citu galotni): bērz(s) + lap(a) → с окончанием -e; brūn(s) + ac(s) → с окончанием -is. Внизу легенда цветов: синий — первое слово, оранжевый — второе, зачёркнуто — отпадает, зелёное — новое окончание.',
  notesRu: ['Итоговые слова таблица показывает рядом со стрелкой; отпадающие окончания зачёркнуты, новые — зелёные.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица о составных словах', selectors: sel('.card.table-salikteni') },
    title: { labelRu: 'Заголовок «Составные слова»', selectors: sel('.vs-head') },
    hero: { labelRu: 'Формула вверху: vārds + vārds = saliktenis', selectors: sel('.sk-hero') },
    rules: { labelRu: 'Все три правила', selectors: sel('.sk-rules') },
    rule_keep: { labelRu: 'Правило 1: оба слова целиком (saules + puķe, ūdens + roze)', selectors: sel('.tt-rule-keep') },
    rule_cut: { labelRu: 'Правило 2: первое слово теряет окончание (sarun-, vied-, mašīn-)', selectors: sel('.tt-rule-cut') },
    rule_tail: { labelRu: 'Правило 3: второе слово меняет окончание (bērzlape, brūnacis)', selectors: sel('.tt-rule-tail') },
    rule_heads: { labelRu: 'Заголовки правил с номерами', selectors: sel('.sk-rule-head') },
    formulas: { labelRu: 'Все формулы-примеры', selectors: sel('.sk-formula') },
    first_words: { labelRu: 'Первые слова (синие)', selectors: sel('.sk-formula .sk-part--a') },
    second_words: { labelRu: 'Вторые слова (оранжевые)', selectors: sel('.sk-formula .sk-part--b') },
    cut_endings: { labelRu: 'Отпадающие окончания (зачёркнуты)', selectors: sel('.sk-formula .sk-cut') },
    new_endings: { labelRu: 'Новые окончания (зелёные)', selectors: sel('.sk-formula .sk-tail') },
    results: { labelRu: 'Получившиеся составные слова', selectors: sel('.sk-word--res') },
    legend: { labelRu: 'Легенда цветов внизу', selectors: sel('.sk-legend') },
    ...examples,
  },
};
