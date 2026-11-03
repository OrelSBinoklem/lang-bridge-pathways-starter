#!/usr/bin/env node
// Generates only English table docs and hints. Source JSON is the editorial authority.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { orderEnglishTables, validateEnglishTables, attachEnglishGrids } from '../../../resources/english-grammar/contract.mjs';

const root = new URL('../../../', import.meta.url);
const read = file => JSON.parse(readFileSync(new URL(`resources/english-grammar/${file}.json`, root), 'utf8'));
const tables = orderEnglishTables(attachEnglishGrids(validateEnglishTables(['a1', 'a2', 'b1', 'b2', 'forms', 'extensions'].flatMap(read)), ['grids-a1-a2', 'grids-b1-b2'].flatMap(read)));
const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const check = process.argv.includes('--check');
let changed = 0;
function output(path, content) {
  const file = new URL(path, root);
  if (check) { if (readFileSync(file, 'utf8') !== content) throw new Error(`Stale generated file: ${path}`); }
  else { mkdirSync(new URL('./', file), { recursive: true }); writeFileSync(file, content); }
  changed++;
}
for (const table of tables) {
  output(`tools/tutor-gateway/src/commands/grammar-tables/${table.key}.mjs`, `// Generated from resources/english-grammar; run scripts/build-english-grammar.mjs.\nimport { createEnglishTableDoc } from './shared/english.mjs';\nexport default createEnglishTableDoc('${table.id}');\n`);
  const columns = table.grid.use_reference ? table.reference.columns : [{ key: 'label', label: table.grid.row_label ?? 'Сравнение' }, ...table.grid.columns];
  const rows = table.grid.use_reference ? table.reference.rows.map(row => row.values) : table.grid.rows.map(row => ({ label: row.label, ...row.cells }));
  const cell = value => escape(value).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const tone = (key, index) => /negative|negation/.test(key) ? 'negative' : /question/.test(key) ? 'question' : /affirmative|positive/.test(key) ? 'positive' : `c${(index - 1) % 4}`;
  const attributes = (column, index) => index ? ` data-tone="${tone(column.key, index)}"` : '';
  const matrix = `<div class="table-scroll" role="region" tabindex="0" aria-label="${escape(table.grid.title)}"><table><thead><tr>${columns.map((column, i) => `<th scope="col"${attributes(column, i)}>${escape(column.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map((column, i) => `<${i ? 'td' : 'th scope="row"'}${attributes(column, i)}>${cell(row[column.key])}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(table.grid.title)}</title><link rel="stylesheet" href="/grammar/hints/english-hint.css"></head><body><main><h1>${escape(table.grid.title)}</h1>${matrix}<p class="grid-summary">${escape(table.grid.summary)}</p><details><summary>Правило и примеры</summary><div class="explanation"><p>${escape(table.rule)}</p><p>${escape(table.when)}</p><ul>${table.notes.map(note => `<li>${escape(note)}</li>`).join('')}</ul>${table.pitfalls.map(item => `<p class="pitfall"><b>Ошибка:</b> ${escape(item.wrong)}. <b>Правильно:</b> ${escape(item.right)}. ${escape(item.why)}</p>`).join('')}</div></details></main></body></html>\n`;
  output(`frontend/public/grammar/hints/${table.id}.html`, html);
}
console.log(`${check ? 'Checked' : 'Generated'} ${changed} files for ${tables.length} English tables in ${fileURLToPath(root)}.`);
