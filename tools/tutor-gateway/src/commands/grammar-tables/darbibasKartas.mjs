import { sel } from './shared/pronoun.mjs';

/**
 * darbibasKartas — «Залоги глагола» (TableDarbibasKartas): intro, a hero pair (Brālis remontē velosipēdu. →
 * Velosipēds tiek remontēts.) and two columns dk-col--active (Darāmā kārta) and dk-col--passive (Ciešamā kārta) with a
 * function line, samples (dk-sample, marked part dk-hit) and, for the passive, a formula (dk-formula:
 * dk-aux + dk-part with -ts).
 */
export default {
  tableKey: 'darbibasKartas',
  summaryRu:
    'Залоги глагола: залог показывает связь между деятелем, действием и объектом. Одно и то же событие двумя способами: Brālis remontē velosipēdu. (кто делает — назван) → Velosipēds tiek remontēts. (кто делает — не назван). Darāmā kārta (действительный залог): деятель назван, действие идёт от него и может переходить на объект — Brālis remontē velosipēdu. (Брат чинит велосипед.), Bērni zīmē mājas. (Дети рисуют дома.) Ciešamā kārta (страдательный залог): деятель не назван, важно действие или его результат — Velosipēds tiek remontēts. (Велосипед чинят.), Darbs ir pabeigts. (Работа завершена.) Образуется так: tikt · tapt · kļūt · būt + divdabis на -ts.',
  notesRu: ['Выделены подлежащее действительного залога и формы страдательного (tiek remontēts, ir pabeigts).'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица «Залоги глагола»', selectors: sel('.card.table-darbibas-kartas') },
    title: { labelRu: 'Заголовок «Залоги глагола»', selectors: sel('.vs-head') },
    intro: { labelRu: 'Вступление: залог показывает связь деятеля, действия и объекта', selectors: sel('.dk-intro') },
    hero: { labelRu: 'Сравнение: Brālis remontē velosipēdu → Velosipēds tiek remontēts', selectors: sel('.dk-hero') },
    hero_active: { labelRu: 'Пример действительного залога в сравнении (Brālis remontē velosipēdu.)', selectors: sel('.tt-hero-active') },
    hero_passive: { labelRu: 'Пример страдательного залога в сравнении (Velosipēds tiek remontēts.)', selectors: sel('.tt-hero-passive') },
    hero_notes: { labelRu: 'Подписи «кто делает — назван / не назван»', selectors: sel('.dk-hero-note') },
    column_active: { labelRu: 'Колонка Darāmā kārta (действительный залог)', selectors: sel('.dk-col--active') },
    column_passive: { labelRu: 'Колонка Ciešamā kārta (страдательный залог)', selectors: sel('.dk-col--passive') },
    functions: { labelRu: 'Пояснения к каждому залогу', selectors: sel('.dk-func') },
    formula: { labelRu: 'Формула страдательного залога: tikt · tapt · kļūt · būt + divdabis на -ts', selectors: sel('.dk-formula') },
    auxiliaries: { labelRu: 'Вспомогательные глаголы tikt · tapt · kļūt · būt', selectors: sel('.dk-aux') },
    participle_part: { labelRu: 'Причастие на -ts в формуле', selectors: sel('.dk-part') },
    samples_active: { labelRu: 'Примеры действительного залога', selectors: sel('.dk-col--active .dk-sample') },
    samples_passive: { labelRu: 'Примеры страдательного залога', selectors: sel('.dk-col--passive .dk-sample') },
    marked_forms: { labelRu: 'Выделенные части в примерах (подлежащее, tiek remontēts, ir pabeigts)', selectors: sel('.dk-hit') },
    translations: { labelRu: 'Русские переводы примеров', selectors: sel('.dk-sample-ru') },
  },
};
