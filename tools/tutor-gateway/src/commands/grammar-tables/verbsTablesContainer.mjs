import { sel } from './shared/pronoun.mjs';
import { buildIrregularVerbTargets, commonIrregularVerbTargets } from './shared/irregularVerbs.mjs';

/**
 * verbsTablesContainer — «Нерегулярные глаголы 1» (irregular-verb-1): ten cards, two columns.
 * Left: būt, patikt, pārdot, ēst, atrast; right: iet, pirkt, braukt, dzert, skriet (order in the DOM is interleaved).
 * Each card lists only the persons that are irregular. Cell texts below must match the component.
 */
const VERBS = [
  { id: 'but', lemma: 'būt', ru: 'быть', rows: {
    es: { past: 'biju', present: 'esmu' },
    tu: { present: 'esi' },
    third: { present: 'ir' },
    mes: { present: 'esam' },
    jus: { present: 'esat' },
  } },
  { id: 'iet', lemma: 'iet', ru: 'идти', rows: { es: { past: 'gāju', present: 'eju' }, third: { present: 'iet' } } },
  { id: 'patikt', lemma: 'patikt', ru: 'нравиться', rows: { es: { present: 'patīku' }, tu: { present: 'patīc' } } },
  { id: 'pirkt', lemma: 'pirkt', ru: 'покупать', rows: { es: { present: 'pērku' }, tu: { present: 'pērc' } } },
  { id: 'pardot', lemma: 'pārdot', ru: 'продавать', rows: { es: { past: 'pārdevu', present: 'pārdodu' } } },
  { id: 'braukt', lemma: 'braukt', ru: 'ехать', rows: { es: { past: 'braucu', present: 'braucu' } } },
  { id: 'est', lemma: 'ēst', ru: 'есть', rows: { es: { past: 'ēdu', present: 'ēdu', future: 'ēdīšu' } } },
  { id: 'dzert', lemma: 'dzert', ru: 'пить', rows: { es: { past: 'dzēru' } } },
  { id: 'atrast', lemma: 'atrast', ru: 'находить', rows: { es: { past: 'atradu', present: 'atrodu', future: 'atradīšu' } } },
  { id: 'skriet', lemma: 'skriet', ru: 'бежать', rows: { es: { past: 'skrēju', present: 'skrienu' } } },
];

export default {
  tableKey: 'verbsTablesContainer',
  summaryRu:
    'Нерегулярные глаголы, часть 1 — десять карточек. В каждой заголовок (инфинитив и перевод) и строки с теми лицами, где форма отличается от правила: es / tu / 3 pers. / mēs / jūs. В строке три колонки без подписей: прошедшее, настоящее, будущее время. Глаголы: būt (быть: biju, esmu, esi, ir, esam, esat), iet (идти: gāju, eju, iet), patikt (нравиться: patīku, patīc), pirkt (покупать: pērku, pērc), pārdot (продавать: pārdevu, pārdodu), braukt (ехать: braucu, braucu), ēst (есть: ēdu, ēdu, ēdīšu), dzert (пить: dzēru), atrast (находить: atradu, atrodu, atradīšu), skriet (бежать: skrēju, skrienu).',
  notesRu: [
    'У колонок нет заголовков: слева направо идут прошедшее, настоящее и будущее время; пустая ячейка — формы в таблице нет.',
    'У местоимения в первой строке каждой карточки стоит звёздочка (Es*); в таблице она не расшифрована.',
    'Цветом выделены отдельные части форм (например ij в biju, es в esmu, esi, esam, esat).',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица нерегулярных глаголов 1', selectors: sel(':scope') },
    ...commonIrregularVerbTargets(),
    es_stem_of_but: { labelRu: 'Основа «es» в формах глагола būt (esmu, esi, esam, esat), выделена отдельным цветом', selectors: sel('.c3-es') },
    ...buildIrregularVerbTargets(VERBS),
  },
};
