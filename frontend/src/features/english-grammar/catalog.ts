import a1 from '../../../../resources/english-grammar/a1.json';
import a2 from '../../../../resources/english-grammar/a2.json';
import b1 from '../../../../resources/english-grammar/b1.json';
import b2 from '../../../../resources/english-grammar/b2.json';
import forms from '../../../../resources/english-grammar/forms.json';
import extensions from '../../../../resources/english-grammar/extensions.json';
import gridsA from '../../../../resources/english-grammar/grids-a1-a2.json';
import gridsB from '../../../../resources/english-grammar/grids-b1-b2.json';
import presentation from '../../../../resources/english-grammar/presentation.json';
import { orderEnglishTables, attachEnglishGrids, attachEnglishPresentation } from '../../../../resources/english-grammar/contract.mjs';
import type { EnglishTable, Level } from './types';

export const ENGLISH_TABLES = orderEnglishTables(attachEnglishPresentation(attachEnglishGrids([...a1, ...a2, ...b1, ...b2, ...forms, ...extensions], [...gridsA, ...gridsB]), presentation)) as EnglishTable[];
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/ё/g, 'е');
export function filterTables(tables: EnglishTable[], level: Level | 'all', query: string): EnglishTable[] {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return tables.filter(table => (level === 'all' || table.level === level) && words.every(word => normalize([
    table.id, table.key, table.title, table.subtitle, table.rule, table.when, table.group,
    ...table.rows.flatMap(row => [row.label, row.translation, row.note ?? '', ...row.pattern.map(part => part.text), ...row.example.map(part => part.text)]),
    ...table.pitfalls.flatMap(item => [item.wrong, item.right, item.why]), ...table.notes,
    ...(table.reference?.rows.flatMap(row => Object.values(row.values)) ?? []),
    table.reference?.title ?? '', table.reference?.note ?? '', ...(table.reference?.columns.map(column => column.label) ?? []),
    table.grid?.title ?? '', table.grid?.summary ?? '', table.grid?.row_label ?? '',
    ...(table.grid?.columns?.map(column => column.label) ?? []),
    ...(table.grid?.rows?.flatMap(row => [row.label, ...Object.values(row.cells)]) ?? []),
  ].join(' ')).includes(word)));
}
