import { readFileSync } from 'node:fs';
import { englishHighlightTargets, orderEnglishTables, validateEnglishTables, attachEnglishGrids } from '../../../../../../resources/english-grammar/contract.mjs';

const read = file => JSON.parse(readFileSync(new URL(`../../../../../../resources/english-grammar/${file}.json`, import.meta.url), 'utf8'));
const tables = orderEnglishTables(attachEnglishGrids(validateEnglishTables(['a1', 'a2', 'b1', 'b2', 'forms', 'extensions'].flatMap(read)), ['grids-a1-a2', 'grids-b1-b2'].flatMap(read)));
export function createEnglishTableDoc(id) {
  const table = tables.find(item => item.id === id);
  if (!table) throw new Error(`Unknown English table ${id}.`);
  return {
    tableKey: table.key, language: 'en', href: `/grammar/english?level=${table.level}#${table.id}`,
    summaryRu: `Английский язык. ${table.grid.title}. ${table.grid.summary} ${table.rule}`,
    notesRu: [...table.notes, ...(table.reference ? [`Справочник «${table.reference.title}»: ${table.reference.rows.length} строк; колонки ${table.reference.columns.map(column => column.label).join(', ')}.`, ...(table.reference.note ? [table.reference.note] : [])] : []), ...table.pitfalls.map(item => `Ошибка: ${item.wrong}; исправление: ${item.right}. ${item.why}`),
      'Открывать /grammar/english: английский каталог использует общую с латышским галерею, масштабирование и увеличение. По умолчанию видна сравнительная сетка; начните с grid, grid_col_* и grid_row_* (у справочников ref_col_* и ref_row_*). Старые подробные примеры, правило и ошибки находятся в закрытом details «Правило и примеры»: перед подсветкой попросить grammar.table.reveal — событие возвращает карточку из встроенного задания к таблице и раскрывает детали. Именованные tt-цели прежних примеров сохранены. Упражнения открываются внутри той же карточки, включая увеличенный вид, а результат и откат принадлежат каноническому блоку урока. Чтение правила не начисляет прогресс. Окно «Обзорная грамматика» даёт пояснения A1–B2 отдельно от сеток. Уровень — редакционный порядок изучения.'],
    highlightTargets: englishHighlightTargets(table),
  };
}
