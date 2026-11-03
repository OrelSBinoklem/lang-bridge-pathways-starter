import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('./GrammarPracticeOverlay.tsx', import.meta.url), 'utf8');
const loaded = { exports: {} };
new Function('require', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)(name => {
  if (name === 'next/link') return { __esModule: true, default: props => React.createElement('a', { ...props, prefetch: undefined }) };
  if (name === '@tanstack/react-query') return { useQuery: () => ({ data: { data: [] }, isPending: false }) };
  if (name === '@/lib/client-api') return {};
  if (name.endsWith('/GrammarExtensionBadge')) return { GrammarExtensionBadge: () => React.createElement('span', { 'data-grammar-extension': '' }, 'extends') };
  if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
  return require(name);
}, loaded.exports);
const { GrammarPracticeOverlay } = loaded.exports;

test('compact bars keep the same accessible task links, scores and completion count', () => {
  const topics = [{ id: 1, title: 'Fixture', slug: 'fixture', course_group_id: null, blocks: [
    { id: 10, best_score: 0, rank: null, is_required: true },
    { id: 11, best_score: 80, rank: 'silver', is_required: true },
    { id: 12, source_block_id: 11, best_score: 100 },
  ] }];
  const html = renderToStaticMarkup(React.createElement(GrammarPracticeOverlay, { topics }));
  assert.equal((html.match(/<a /g) ?? []).length, 2);
  assert.match(html, /href="\/lessons\/fixture#lesson-block-11"/);
  assert.match(html, /data-rank="silver" data-state="silver" data-score="80"/);
  assert.match(html, /--progress:80%/);
  assert.match(html, /зачтено 1 из 2 подзаданий/);
  assert.doesNotMatch(html, /class="count"|>1\/2</);
  assert.doesNotMatch(html, /lesson-block-12/);
});

test('empty topics render no progress overlay', () => {
  assert.equal(renderToStaticMarkup(React.createElement(GrammarPracticeOverlay, { topics: [] })), '');
});

test('table-specific extensions are filtered by their own bindings and visibly marked', () => {
  const topics = [{ title: 'Negation', slug: 'fixture', table_keys: ['verbEndingsPresent', 'possessionIrNav'], blocks: [
    { id: 10, grammar_table_keys: ['verbEndingsPresent'], is_extension: true, best_score: null },
    { id: 11, grammar_table_keys: ['possessionIrNav'], is_extension: true, best_score: null },
    { id: 12, source_block_id: 10, grammar_table_keys: ['verbEndingsPresent'], is_extension: true },
  ] }];
  const html = renderToStaticMarkup(React.createElement(GrammarPracticeOverlay, { topics, tableKey: 'verbEndingsPresent' }));
  assert.equal((html.match(/<a /g) ?? []).length, 1);
  assert.match(html, /data-grammar-extension/);
  assert.match(html, /lesson-block-10/);
  assert.doesNotMatch(html, /lesson-block-11|lesson-block-12/);
});

test('table hover, keyboard focus and touch reveal details without changing table layout', () => {
  const css = readFileSync(new URL('./grammar-practice-overlay.module.css', import.meta.url), 'utf8');
  const gallery = readFileSync(new URL('./GrammarTablesGallery.tsx', import.meta.url), 'utf8');
  assert.match(gallery, /data-grammar-practice-host=""/);
  assert.match(css, /position: absolute/);
  assert.match(css, /--item-height: 4px/);
  assert.match(css, /bottom: var\(--panel-bottom, 0px\)/);
  assert.match(css, /0 0 0 1px #fff, 0 0 0 2px #18212f/);
  assert.match(css, /--item-width: var\(--expanded-size\)/);
  assert.doesNotMatch(css, /\.count\b|--count-display/);
  assert.match(css, /flex-wrap: wrap/);
  assert.doesNotMatch(css, /overflow-x: auto|scrollbar-width/);
  assert.match(css, /:global\(\[data-grammar-practice-host\]:hover\) \.overlay/);
  assert.match(css, /\.overlay:focus-within/);
  assert.match(css, /@media \(hover: none\)/);
});
