import { sel } from './shared/pronoun.mjs';

/**
 * saikli — «Использование союзов» (TableSaikli): a 2x2 table. Rows: group join (un · vai · jeb) and contrast
 * (bet · tomēr · taču · ne vien…, bet arī · gan…, gan). Columns: Starp vārdiem (between words) and Starp teikuma daļām
 * (between clauses). Every cell starts with a badge "с запятой / без запятой".
 * Component classes (TableSaikli.jsx): rows tt-group-join | tt-group-contrast, cells tt-between-words | tt-between-clauses;
 * existing sa-badge (--yes / --no), sa-hit, sa-sample, sa-extra.
 */
export default {
  tableKey: 'saikli',
  summaryRu:
    'Использование союзов и запятая. Строки: 1) un · vai · jeb (соединяют, выбирают); 2) bet · tomēr · taču · ne vien…, bet arī · gan…, gan (противопоставляют, перечисляют парой). Колонки: Starp vārdiem (между словами) и Starp teikuma daļām (между частями предложения). Un · vai · jeb между словами — без запятой (maize un piens, šodien vai rīt, ārsts jeb dakteris), но если un повторяется — запятая (mamma un tētis, un vecmāmiņa); между частями предложения — с запятой (Viņš strādā, un viņa mācās; Nezinu, vai viņš atnāks). Bet · tomēr · taču… — всегда с запятой: mazs, bet ērts dzīvoklis; dārgs, tomēr kvalitatīvs; ne vien skaists, bet arī gudrs; gan pilsētā, gan laukos; Gribēju braukt, bet sāka līt; Bija auksts, tomēr gājām pastaigā.',
  notesRu: [
    'Вывод внизу: между частями предложения запятая нужна всегда; между словами её не ставят только с одиночными un · vai · jeb.',
    'В каждой ячейке значок «✓ с запятой» или «✗ без запятой»; союз с запятой в примерах выделен цветом.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица об использовании союзов', selectors: sel('.card.table-saikli') },
    title: { labelRu: 'Заголовок «Использование союзов»', selectors: sel('.vs-head') },
    header: { labelRu: 'Шапка: Saikļi | Starp vārdiem | Starp teikuma daļām', selectors: sel('.sa-table thead') },
    row_join: { labelRu: 'Строка союзов un · vai · jeb', selectors: sel('tr.tt-group-join') },
    row_contrast: { labelRu: 'Строка союзов bet · tomēr · taču · ne vien…, bet arī · gan…, gan', selectors: sel('tr.tt-group-contrast') },
    row_heads: { labelRu: 'Ячейки с самими союзами (первая колонка)', selectors: sel('.sa-rowhead') },
    between_words: { labelRu: 'Колонка «между словами»', selectors: sel('td.tt-between-words') },
    between_clauses: { labelRu: 'Колонка «между частями предложения»', selectors: sel('td.tt-between-clauses') },
    join_between_words: { labelRu: 'un · vai · jeb между словами (без запятой)', selectors: sel('tr.tt-group-join td.tt-between-words') },
    join_between_clauses: { labelRu: 'un · vai · jeb между частями предложения (с запятой)', selectors: sel('tr.tt-group-join td.tt-between-clauses') },
    contrast_between_words: { labelRu: 'bet · tomēr · taču … между словами (с запятой)', selectors: sel('tr.tt-group-contrast td.tt-between-words') },
    contrast_between_clauses: { labelRu: 'bet · tomēr · taču … между частями предложения (с запятой)', selectors: sel('tr.tt-group-contrast td.tt-between-clauses') },
    comma_yes: { labelRu: 'Значки «✓ с запятой»', selectors: sel('.sa-badge--yes') },
    comma_no: { labelRu: 'Значок «✗ без запятой»', selectors: sel('.sa-badge--no') },
    conjunctions_in_samples: { labelRu: 'Союзы с запятой, выделенные в примерах', selectors: sel('.sa-hit') },
    extra_case: { labelRu: 'Исключение: если un повторяется — запятая (mamma un tētis, un vecmāmiņa)', selectors: sel('.sa-extra') },
    note: { labelRu: 'Вывод внизу про запятую между частями предложения и словами', selectors: sel('.sa-note') },
  },
};
