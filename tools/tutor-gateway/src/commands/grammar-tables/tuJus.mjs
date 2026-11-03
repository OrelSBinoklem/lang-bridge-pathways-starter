import { sel } from './shared/pronoun.mjs';

/**
 * tuJus — «Использование местоимений tu и jūs» (TableTuJus): two columns tj-col--tu and tj-col--jus, each with the
 * word (tj-word), meta (tj-abbr, tj-ru), who is addressed (tj-who), a mini table (обычный текст / в письме; tj-where,
 * tj-form, the capital tj-cap) and a sample (tj-sample); a note at the bottom (tj-note).
 */
export default {
  tableKey: 'tuJus',
  summaryRu:
    'Местоимения tu и jūs. Tu (vsk., ты) — к близкому или знакомому человеку: Vai tu brauksi līdzi? (Ты поедешь с нами?). Jūs (dsk., вы / Вы) — к незнакомому человеку или к нескольким сразу: Vai jūs runājat latviski? (Вы говорите по-латышски?). Написание: в обычном тексте tu, jūs с маленькой буквы; в письме Tu, Jūs с большой — знак уважения к читателю. Как в русском: tu — ты, jūs — вы и вежливое Вы.',
  notesRu: ['Заглавная буква в форме для письма выделена цветом.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица про tu и jūs', selectors: sel('.card.table-tu-jus') },
    title: { labelRu: 'Заголовок таблицы', selectors: sel('.vs-head') },
    column_tu: { labelRu: 'Колонка tu (ты)', selectors: sel('.tj-col--tu') },
    column_jus: { labelRu: 'Колонка jūs (вы)', selectors: sel('.tj-col--jus') },
    words: { labelRu: 'Слова tu и jūs крупно', selectors: sel('.tj-word') },
    who: { labelRu: 'Кому обращаются: к близкому / к незнакомому или нескольким', selectors: sel('.tj-who') },
    who_tu: { labelRu: 'Tu — к близкому или знакомому человеку', selectors: sel('.tj-col--tu .tj-who') },
    who_jus: { labelRu: 'Jūs — к незнакомому человеку или к нескольким сразу', selectors: sel('.tj-col--jus .tj-who') },
    spelling_tables: { labelRu: 'Мини-таблицы написания (обычный текст / в письме)', selectors: sel('.tj-table') },
    capital_letters: { labelRu: 'Заглавные буквы T и J в письме (выделены)', selectors: sel('.tj-cap') },
    samples: { labelRu: 'Примеры: Vai tu brauksi līdzi? / Vai jūs runājat latviski?', selectors: sel('.tj-sample') },
    note: { labelRu: 'Вывод: как в русском, в письме с большой буквы', selectors: sel('.tj-note') },
  },
};
