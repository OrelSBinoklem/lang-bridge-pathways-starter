#!/usr/bin/env node
/**
 * Build tools/tutor-gateway/src/commands/grammarTablesIndex.json from the
 * frontend table registry (frontend/src/features/grammar/data/tablesData.ts).
 *
 * The gateway lists grammar tables from this index, so it must be regenerated
 * whenever a table with a componentKey is added, renamed or removed:
 *
 *   node tools/tutor-gateway/scripts/build-grammar-index.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { orderEnglishTables, validateEnglishTables, attachEnglishGrids } from '../../../resources/english-grammar/contract.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const dataFile = resolve(root, 'frontend/src/features/grammar/data/tablesData.ts');
const outFile = resolve(here, '../src/commands/grammarTablesIndex.json');

// A few rows in tablesData.ts have no `title`; names below come from their hints.
const TITLE_FALLBACKS = {
  indicativePassiveTimes: 'Времена и залоги: все времена латышского языка',
  moodsV75V76V77: 'Наклонения: vajadzības, vēlējuma, pavēles izteiksme',
  reportedSimple: 'Atstāstījuma izteiksme — косвенная речь (простые времена)',
  reportedCompound: 'Atstāstījuma izteiksme — косвенная речь (сложные времена)',
};

const source = readFileSync(dataFile, 'utf8');
const tables = [];

for (const line of source.split('\n')) {
  const trimmed = line.trim();
  // Skip commented-out rows.
  if (trimmed.startsWith('//') || !trimmed.startsWith('{ id:')) continue;

  const field = (name) => {
    const quoted = trimmed.match(new RegExp(`${name}: '((?:[^'\\\\]|\\\\.)*)'`));
    if (quoted) return quoted[1].replace(/\\'/g, "'");
    const numeric = trimmed.match(new RegExp(`${name}: (\\d+)`));
    return numeric ? Number(numeric[1]) : null;
  };

  const componentKey = field('componentKey');
  if (!componentKey) continue;

  const id = field('id');
  const hintId = field('hintId');
  tables.push({
    tableKey: componentKey,
    tableId: id,
    level: field('level'),
    title: field('title') ?? TITLE_FALLBACKS[componentKey] ?? componentKey,
    // Same rule as the gallery: an explicit hintId wins, otherwise the table id.
    hintId: hintId ?? id,
  });
}

const readEnglish = file => JSON.parse(readFileSync(resolve(root, `resources/english-grammar/${file}.json`), 'utf8'));
const english = orderEnglishTables(attachEnglishGrids(validateEnglishTables(['a1', 'a2', 'b1', 'b2', 'forms', 'extensions'].flatMap(readEnglish)), ['grids-a1-a2', 'grids-b1-b2'].flatMap(readEnglish)));
tables.push(...english.map(table => ({ tableKey: table.key, tableId: table.id, level: table.level, title: table.grid.title, hintId: table.id, language: 'en', href: `/grammar/english?level=${table.level}#${table.id}` })));
writeFileSync(outFile, `${JSON.stringify(tables, null, 2)}\n`);
console.error(`Written ${outFile}: ${tables.length} tables`);
