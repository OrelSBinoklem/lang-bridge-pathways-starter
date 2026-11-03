import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { validateEnglishTables, englishHighlightTargets, attachEnglishGrids } from '../../../../resources/english-grammar/contract.mjs';

const require = createRequire(import.meta.url), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server'), { load: html } = require('cheerio');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const extension = ['EnglishGrammarTable', 'SentenceLab', 'EnglishGrammarGallery'].includes(file) ? 'tsx' : 'ts';
  const code = ts.transpileModule(readFileSync(new URL(`./${file}.${extension}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'exports', code)(name => name.endsWith('.css') ? { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) } : name.startsWith('./') ? load(name.slice(2)) : require(name), exports);
  return exports;
}
const { ENGLISH_TABLES: tables, filterTables } = load('catalog');
const { EnglishGrammarTable } = load('EnglishGrammarTable');
const { buildLabSentence } = load('sentenceModel');
const sentence = options => buildLabSentence({ subject: 'she', tense: 'present', mode: 'statement', family: 'work', ...options }).tokens.map(token => token.text).join(' ');

test('English catalog covers A1–B2 with consistent tables, source links and no dangling related topics', () => {
  assert.equal(validateEnglishTables(tables), tables);
  assert(tables.length >= 32);
  for (const level of ['a1', 'a2', 'b1', 'b2']) assert(tables.filter(table => table.level === level).length >= 8);
  const index = JSON.parse(readFileSync(new URL('../../../../tools/tutor-gateway/src/commands/grammarTablesIndex.json', import.meta.url)));
  assert.deepEqual(index.filter(table => table.language === 'en').map(table => table.tableKey), tables.map(table => table.key));
  assert.equal(index.filter(table => table.language !== 'en').length, 68, 'Latvian registry is preserved');
});

test('every real tutor target matches actual React markup, including rows and semantic sentence blocks', async () => {
  const { getGrammarTableDoc } = await import('../../../../tools/tutor-gateway/src/commands/grammarTables.mjs');
  let targets = 0;
  for (const table of tables) {
    const $ = html(renderToStaticMarkup(React.createElement(EnglishGrammarTable, { table, tables })));
    const root = $(`[data-grammar-table-key="${table.key}"]`);
    assert.equal(root.length, 1); assert.equal(root.find('tr[data-tutor-target^="row_"]').length, table.rows.length);
    assert.equal(root.find('.tt-reference tbody tr').length, table.reference?.rows.length ?? 0);
    assert.equal(root.find('.tt-translation').length, table.rows.length);
    assert.equal(root.find('.tt-example .tokens').first().text(), table.rows[0].example.map(token => token.text).join(' '), 'copying and tutor DOM reading retain word boundaries');
    const doc = getGrammarTableDoc(table.key);
    assert.equal(doc.language, 'en'); assert(doc.href.startsWith('/grammar/english?level='));
    assert.deepEqual(doc.highlightTargets, englishHighlightTargets(table));
    for (const [name, item] of Object.entries(doc.highlightTargets)) {
      assert(item.selectors.some(({ selector }) => selector === ':scope' || root.find(selector).length), `${table.key}/${name} has no real DOM target`);
      assert(item.selectors.every(({ selector }) => !selector.includes(':nth-')));
      targets++;
    }
  }
  assert(targets > 500);
});

test('search includes examples, Russian meanings and mistakes while respecting selected level', () => {
  const example = tables.find(table => table.level === 'b2');
  assert(filterTables(tables, 'all', example.rows[0].example.map(token => token.text).join(' ')).includes(example));
  assert(!filterTables(tables, 'a1', example.id).includes(example));
  assert(filterTables(tables, 'all', example.pitfalls[0].wrong).includes(example));
  assert.equal(filterTables(tables, 'all', 'zzzzzzzzzz').length, 0);
  assert.equal(filterTables(tables, 'a1', '  ').length, tables.filter(table => table.level === 'a1').length);
});

test('lab uses do-support only for lexical simple forms and preserves the full auxiliary chain', () => {
  assert.equal(sentence({}), 'She works in London.');
  assert.equal(sentence({ mode: 'negative' }), 'She does not work in London.');
  assert.equal(sentence({ mode: 'question' }), 'Does she work in London?');
  assert.equal(sentence({ tense: 'past', mode: 'question' }), 'Did she work in London?');
  assert.equal(sentence({ tense: 'continuous', subject: 'I', mode: 'question' }), 'Am I working in London?');
  assert.equal(sentence({ tense: 'perfect', mode: 'negative' }), 'She has not worked in London.');
  assert.equal(sentence({ tense: 'future', mode: 'question' }), 'Will she work in London?');
  assert.equal(sentence({ subject: 'they' }), 'They work in London.');
  assert.equal(sentence({ family: 'be', subject: 'I', mode: 'question' }), 'Am I ready?');
  assert.equal(sentence({ family: 'be', subject: 'you', tense: 'past', mode: 'negative' }), 'You were not ready.');
  assert.equal(sentence({ family: 'be', tense: 'future', mode: 'question' }), 'Will she be ready?');
  assert.equal(buildLabSentence({ family: 'be', subject: 'he', tense: 'present', mode: 'statement' }).tokens[1].role, 'verb', 'copular be is not an auxiliary');
  assert.throws(() => sentence({ family: 'be', tense: 'continuous' }));
  assert.throws(() => sentence({ tense: 'invented' }));
});

test('table markup is escaped, has row/column headings and direct stable links', () => {
  const table = structuredClone(tables[0]); table.rows[0].example[0].text = '<script>bad()</script>';
  const markup = renderToStaticMarkup(React.createElement(EnglishGrammarTable, { table, tables }));
  const $ = html(markup);
  assert.equal($('script').length, 0); assert(markup.includes('&lt;script&gt;'));
  assert.equal($('.tt-explanation th[scope="row"]').length, table.rows.length);
  assert.equal($('.tt-explanation th[scope="col"]').length, 3);
  assert($(`a[href="/grammar/english?level=${table.level}#${table.id}"]`).length);
  for (const relatedId of table.related) {
    const related = tables.find(item => item.id === relatedId);
    assert($(`a[href="/grammar/english?level=${related.level}#${related.id}"]`).length,
      'Embedded course/lesson tables must link to the gallery rather than replace the current page query');
  }
});

test('all tables start with a real comparison grid; long teaching material stays collapsed', () => {
  for (const table of tables) {
    const $ = html(renderToStaticMarkup(React.createElement(EnglishGrammarTable, { table, tables })));
    const grid = $('.tt-grid');
    assert.equal(grid.length, 1, table.id);
    assert.equal(grid.closest('details').length, 0, `${table.id}: the actual table must be visible`);
    assert(grid.find('thead th').length >= 3);
    assert.equal(grid.find('tbody tr').length, table.grid.use_reference ? table.reference.rows.length : table.grid.rows.length);
    assert.equal($('.tt-explanation').attr('open'), undefined);
    assert.equal($('.tt-notes').attr('open'), undefined);
    assert($('.tt-explanation .tt-rule').length);
    assert($('.tt-grid-summary').text().length < 420, 'the visible card is a table with a short footnote');
  }
  const definitions = tables.map(table => structuredClone(table.grid));
  assert.throws(() => attachEnglishGrids(tables, definitions.slice(1)), /primary grid/);
  const bad = structuredClone(definitions);
  const custom = bad.find(grid => !grid.use_reference);
  delete custom.rows[0].cells[custom.columns[0].key];
  assert.throws(() => attachEnglishGrids(tables, bad), /invalid grid row/);
});

test('semantic colours distinguish copular be, objects, modifiers and time inside advanced clauses', () => {
  const row = (tableId, rowId) => tables.find(table => table.id === tableId).rows.find(item => item.id === rowId);
  const deduction = row('en-modal-perfect-meaning', 'past-certain-deduction').example;
  assert.equal(deduction.find(token => token.text === 'was').role, 'verb');
  assert.equal(deduction.find(token => token.text === 'before.').role, 'time');
  const experience = row('en-relative-participle-expansion', 'quantity-of-whom').example;
  assert.equal(experience.find(token => token.text === 'international experience.').role, 'object');
  const noisy = row('en-linking-clauses-phrases', 'so-adjective-result').example;
  assert.equal(noisy.find(token => token.text === 'so').role, 'modifier');
  assert.equal(noisy.find(token => token.text === 'noisy').role, 'complement');
  const future = row('en-real-imagined-conditions', 'real-future').example;
  assert.equal(future.find(token => token.text === 'arrives').role, 'verb');
  assert.equal(future.find(token => token.text === 'on time,').role, 'time');
});

test('reference grids retain complete named columns and reject missing or unsafe cells', () => {
  const table = tables.find(item => item.id === 'en-pronouns-possessives');
  const mine = table.reference.rows.find(row => row.id === 'first-singular');
  assert.deepEqual(mine.values, { subject: 'I', object: 'me', 'before-noun': 'my', independent: 'mine', reflexive: 'myself' });
  const markup = html(renderToStaticMarkup(React.createElement(EnglishGrammarTable, { table, tables })));
  assert.equal(markup('.tt-ref-col-reflexive').length, table.reference.rows.length + 1);
  const broken = structuredClone(tables); delete broken.find(item => item.id === table.id).reference.rows[0].values.reflexive;
  assert.throws(() => validateEnglishTables(broken), /invalid reference row/);
  const unsafe = structuredClone(tables); unsafe.find(item => item.id === table.id).reference.columns[0].key = 'a] script';
  assert.throws(() => validateEnglishTables(unsafe), /invalid reference column/);
  assert(filterTables(tables, 'a1', 'ourselves').some(item => item.id === table.id));
});
