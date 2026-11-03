import { sel } from './shared/pronoun.mjs';
import { typeTargets, commonCardTargets } from './shared/paligteikumi.mjs';

/**
 * paligteikumi1 — «Придаточные предложения» (TablePaligteikumi1): intro, a "how to find the type" scheme (pt-how),
 * legend, two type cards (подлежащное, сказуемное) and a footer "остальные 13 типов — в расширенной таблице".
 */
const TYPES = [
  ['Teikuma priekšmeta', 'подлежащное', 'Kas?', 'kas · kurš · kāds · ka · lai · vai · ja · kā · cik · kur · kad', ['aiz', 'starp', 'pirms']],
  ['Izteicēja', 'сказуемное', 'Kas ir? Kāds ir?', 'kas · kurš · kāds · ka · lai', ['aiz']],
];

export default {
  tableKey: 'paligteikumi1',
  summaryRu:
    'Придаточные предложения (palīgteikums) — зависимая часть сложноподчинённого предложения, она поясняет главное (virsteikums). Тип придаточного определяют по вопросу от главного: Es eju tur, kur acis rāda. — virsteikums → Kur es eju? → vietas palīgteikums. Здесь два типа. 1) Teikuma priekšmeta (подлежащное), вопрос Kas?: союзы kas · kurš · kāds · ka · lai · vai · ja · kā · cik · kur · kad; может стоять после, внутри и перед главным; Kas neiespējams šodien, kļūst iespējams rīt. 2) Izteicēja (сказуемное), вопрос Kas ir? Kāds ir?: kas · kurš · kāds · ka · lai; только после главного; Viņi ir tie, kas ies tālāk par mums. Остальные 13 типов — в расширенной таблице.',
  notesRu: ['Плашки «после / внутри / перед» подсвечены для тех позиций, где придаточное может стоять относительно главного.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица про придаточные предложения', selectors: sel('.card.table-paligteikumi') },
    title: { labelRu: 'Заголовок «Придаточные предложения»', selectors: sel('.vs-head') },
    intro: { labelRu: 'Вступление: что такое palīgteikums и как определить тип по вопросу', selectors: sel('.pt-intro') },
    how: { labelRu: 'Схема определения типа: virsteikums → вопрос → тип придаточного', selectors: sel('.pt-how') },
    how_steps: { labelRu: 'Три шага схемы (virsteikums, Kur es eju?, vietas palīgteikums)', selectors: sel('.pt-step') },
    footer: { labelRu: 'Пометка: остальные 13 типов — в расширенной таблице', selectors: sel('.pt-foot') },
    ...commonCardTargets(),
    ...typeTargets(TYPES),
  },
};
