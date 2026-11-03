import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load as html } from 'cheerio';
import ts from 'typescript';

const require = createRequire(import.meta.url), src = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const config = { task_kind: 'grammar_select', instruction: 'Выберите do или does.', questions: [
  { prompt: 'She {{blank}} not work here.', options: ['do', 'does'] },
  { prompt: '{{blank}} you like tea?', options: ['Do', 'Does'] },
] };
const page = { skill: 'grammar', blocks: [{ id: 31, source_block_id: null, type: 'grammar', title: 'Вопросы и отрицания',
  variant_id: 72, config, progress: { best_score: null }, variants: null }] };
function loader() {
  const cache = new Map(), requests = [], queries = [];
  const clientApi = async (path, options) => { requests.push({ path, options }); return path === '/user' ? { user: { id: 5 } } : { data: page }; };
  const mockQuery = options => {
    queries.push(options);
    return { data: options.queryKey[0] === 'inline-grammar-user' ? { user: { id: 5 } } : options.queryKey[0] === 'grammar-course-locks' ? { data: [] } : { data: page }, isFetching: false, isError: false, refetch: async () => ({ data: { data: page } }) };
  };
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const exports = {}; cache.set(path, exports);
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    new Function('require', 'exports', code)(name => {
      if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name === '@/lib/client-api') return { clientApi };
      if (name === '@tanstack/react-query') return { useQuery: mockQuery, useQueryClient: () => ({ invalidateQueries: async () => {} }) };
      if (name === 'next/link') return { __esModule: true, default: ({ href, children, prefetch: _prefetch, ...rest }) => React.createElement('a', { href, ...rest }, children) };
      if (name === 'next/dynamic') return { __esModule: true, default: () => () => null };
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? resolve(src, name.slice(2)) : resolve(dirname(path), name);
        for (const extension of ['.tsx', '.ts']) { try { readFileSync(base + extension); return load(base + extension); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
      }
      return require(name);
    }, exports);
    return exports;
  }
  return { load: name => load(resolve(src, name)), requests, queries };
}

test('in-card exercises render a real answer table, keep the instruction, and leave normal lesson lists intact', () => {
  const { load } = loader();
  const { GrammarTask } = load('features/grammar-practice/GrammarTask.tsx');
  const props = { blockId: 31, variantId: 72, config, progress: { best_score: null }, practice: false };
  const $ = html(renderToStaticMarkup(React.createElement(GrammarTask, { ...props, layout: 'table' })));
  assert.equal($('table tbody tr').length, 2);
  assert.equal($('table th[scope="row"]').length, 2);
  assert.equal($('table td select').length, 2);
  assert($('table').hasClass('questions'), 'Table controls must retain the shared input and inline-gap styles');
  assert.equal($('ol').length, 0);
  assert.match($.text(), /Выберите do или does/);
  assert($('form button[type="submit"]').is('[disabled]'));
  const normal = html(renderToStaticMarkup(React.createElement(GrammarTask, props)));
  assert.equal(normal('ol li').length, 2);
  assert.equal(normal('table').length, 0);
});

test('inline renderer uses the canonical lesson endpoint and private user/block/variant query keys', async () => {
  const runtime = loader();
  const Inline = runtime.load('features/grammar-practice/InlineGrammarLesson.tsx').default;
  const $ = html(renderToStaticMarkup(React.createElement(Inline, { target: { slug: 'grammar-en-helpers', blockId: 31, title: 'Helpers' }, active: true })));
  assert.equal($('[data-inline-grammar-block="31"] table').length, 1);
  assert.equal(runtime.queries.length, 2);
  assert.deepEqual(runtime.queries[1].queryKey, ['inline-grammar-lesson', 5, 'grammar-en-helpers', 31, null]);
  await runtime.queries[0].queryFn();
  await runtime.queries[1].queryFn({ signal: undefined });
  assert.deepEqual(runtime.requests.map(request => request.path), ['/user', '/lessons/grammar-en-helpers']);
  assert(!runtime.requests.some(request => request.options?.method === 'POST'), 'Opening a task must not submit an attempt');
});

test('card starts at its table with a real exercise button and canonical link fallback', () => {
  const { load } = loader();
  const { GrammarTablePractice } = load('features/grammar-practice/GrammarTablePractice.tsx');
  const topics = [{ slug: 'grammar-en-helpers', title: 'Helpers', table_keys: ['englishHelpers'], blocks: [
    { id: 31, title: 'Helpers', best_score: 80, rank: 'silver', rank_label: 'Серебро' },
    { id: 99, source_block_id: 31, title: 'Placement' },
  ] }];
  const $ = html(renderToStaticMarkup(React.createElement(GrammarTablePractice, { topics, tableKey: 'englishHelpers', learnLang: 'en' }, React.createElement('table', { 'data-reference': true }))));
  assert.equal($('table[data-reference]').length, 1);
  assert.match($('button').text(), /Упражнения/);
  assert.equal($('section[aria-label^="Задание"]').length, 0, 'The task and its API request are lazy');
  assert.equal($('a[href="/lessons/grammar-en-helpers#lesson-block-31"]').length, 1);
  assert.equal($('a[href*="lesson-block-99"]').length, 0, 'Course placements never duplicate a canonical task');
});
