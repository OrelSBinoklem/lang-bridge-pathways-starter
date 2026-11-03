import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load as html } from 'cheerio';

const here = path.dirname(fileURLToPath(import.meta.url));
const resourceRoot = path.resolve(here, '../../../../../resources/english-grammar');
const nativeRequire = createRequire(import.meta.url);

function moduleLoader(react = React) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const loaded = { exports: {} };
    cache.set(file, loaded.exports);
    const code = ts.transpileModule(readFileSync(path.join(here, file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', code)(name => {
      if (name === 'react') return react;
      if (name.endsWith('.css')) return { __esModule: true,
        default: new Proxy({}, { get: (_target, key) => String(key) }) };
      if (name.startsWith('./')) return load(`${name.slice(2)}.ts`);
      return nativeRequire(name);
    }, loaded, loaded.exports);
    cache.set(file, loaded.exports);
    return loaded.exports;
  }
  return load;
}

const load = moduleLoader();
const { englishGrammarOverviewSections: sections, overviewTables, overviewTableHref } = load('sections.ts');
const Overview = load('EnglishGrammarOverview.tsx').default;
const canonical = new Map(['a1', 'a2', 'b1', 'b2', 'forms', 'extensions'].flatMap(name =>
  JSON.parse(readFileSync(path.join(resourceRoot, `${name}.json`), 'utf8'))).map(table => [table.id, table]));

test('18–24 substantive chapters cover A1–B2 and form a unique navigable outline', () => {
  assert.ok(sections.length >= 18 && sections.length <= 24);
  assert.equal(new Set(sections.map(section => section.id)).size, sections.length);
  assert.deepEqual([...new Set(sections.map(section => section.level))].sort(), ['A1', 'A2', 'B1', 'B2']);
  const paragraphs = [];
  for (const section of sections) {
    assert.match(section.id, /^[a-z][a-z0-9-]+$/);
    assert.ok(section.title.length > 10 && section.summary.length > 40, section.id);
    assert.ok(section.paragraphs.length >= 2 && section.examples.length >= 2, section.id);
    assert.ok(section.remember.length > 40 && section.tableIds.length > 0, section.id);
    for (const paragraph of section.paragraphs) assert.ok(paragraph.length > 140, section.id);
    paragraphs.push(...section.paragraphs);
  }
  assert.equal(new Set(paragraphs).size, paragraphs.length, 'no recycled filler paragraphs');
});

test('all 42 canonical table IDs have exact metadata and level-specific deep links', () => {
  assert.equal(canonical.size, 42);
  const linkedIds = [...new Set(sections.flatMap(section => section.tableIds))].sort();
  assert.deepEqual(linkedIds, [...canonical.keys()].sort());
  assert.deepEqual(Object.keys(overviewTables).sort(), linkedIds);
  for (const id of linkedIds) {
    const table = canonical.get(id);
    assert.deepEqual(overviewTables[id], { level: table.level, title: table.title }, id);
    const href = new URL(overviewTableHref(id), 'https://example.test');
    assert.equal(href.pathname, '/grammar/english');
    assert.equal(href.searchParams.get('level'), table.level);
    assert.equal(href.hash, `#${table.id}`);
  }
});

test('every English example and Russian translation is an exact canonical row excerpt', () => {
  const excerpts = sections.flatMap(section => section.examples);
  assert.ok(excerpts.length >= 48);
  for (const section of sections) for (const excerpt of section.examples) {
    assert.ok(section.tableIds.includes(excerpt.table_id), `${section.id} must link to its example source`);
  }
  for (const excerpt of excerpts) {
    const table = canonical.get(excerpt.table_id);
    assert.ok(table, excerpt.table_id);
    const row = table.rows.find(item => item.id === excerpt.row_id);
    assert.ok(row, `${excerpt.table_id}/${excerpt.row_id}`);
    assert.equal(excerpt.english, row.example.map(token => token.text).join(' '), row.id);
    assert.equal(excerpt.translation, row.translation, row.id);
  }
});

test('rendered body has chapter labels, all working outline targets and 42 real table destinations', () => {
  const $ = html(renderToStaticMarkup(React.createElement(Overview)));
  assert.equal($('[data-english-grammar-overview][lang="ru"]').length, 1);
  assert.equal($('h2').text(), 'Обзорная грамматика');
  assert.equal($('section[data-overview-section]').length, sections.length);
  assert.equal($('nav').length, 1);
  assert.equal($('nav a[aria-current="location"]').length, 1);
  for (const link of $('nav a').toArray()) {
    const id = $(link).attr('href').slice(1);
    const chapter = $(`[id="${id}"]`);
    assert.equal(chapter.length, 1);
    assert.equal(chapter.attr('tabindex'), '-1');
    assert.equal($(`[id="${chapter.attr('aria-labelledby')}"]`).length, 1);
  }
  const destinations = new Set();
  for (const link of $('a[data-table-id]').toArray()) {
    const id = $(link).attr('data-table-id');
    assert.equal($(link).attr('href'), overviewTableHref(id));
    assert.equal($(link).attr('target'), '_blank');
    assert.match($(link).attr('rel'), /noopener/);
    destinations.add(id);
  }
  assert.equal(destinations.size, 42);
  assert.equal($('p[lang="en"]').length, sections.reduce((count, section) => count + section.examples.length, 0));
  assert.equal($('table, [role="dialog"], iframe').length, 0, 'only reader content, no nested gallery or modal');
});

test('UK explicitly identifies Russian fallback and keeps the actual content language Russian', () => {
  const ru = html(renderToStaticMarkup(React.createElement(Overview, { locale: 'ru' })));
  const uk = html(renderToStaticMarkup(React.createElement(Overview, { locale: 'uk' })));
  assert.equal(ru('[role="note"]').length, 0);
  assert.equal(uk('[data-english-grammar-overview]').attr('lang'), 'ru');
  assert.equal(uk('[role="note"]').attr('lang'), 'uk');
  assert.match(uk('[role="note"]').text(), /російською/);
  assert.equal(uk('section').text(), ru('section').text());
});

test('two readers on the same page have disjoint chapter and contents IDs', () => {
  const $ = html(renderToStaticMarkup(React.createElement('div', null,
    React.createElement(Overview), React.createElement(Overview, { locale: 'uk' }))));
  const ids = $('[id]').toArray().map(node => $(node).attr('id'));
  assert.equal(new Set(ids).size, ids.length);
  for (const button of $('button[aria-controls]').toArray()) {
    assert.equal($(`[id="${$(button).attr('aria-controls')}"]`).length, 1);
  }
});

// Exercise the real event handlers and effect with a small hook host. No browser/network
// package is needed; browser layout is verified separately in the temporary preview.
function hookHost() {
  const states = [], refs = [], effects = [];
  let stateIndex = 0, refIndex = 0, mounted = false;
  const hooks = {
    ...React,
    useId: () => 'overview-test',
    useRef(initial) { const i = refIndex++; return refs[i] ??= { current: initial }; },
    useState(initial) {
      const i = stateIndex++;
      if (!(i in states)) states[i] = initial;
      return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
    },
    useEffect(effect) { if (!mounted) effects.push(effect); },
  };
  const Component = moduleLoader(hooks)('EnglishGrammarOverview.tsx').default;
  return { refs, effects, render() { stateIndex = 0; refIndex = 0;
    const tree = Component({}); mounted = true; return tree; } };
}

function elements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!React.isValidElement(tree)) return [];
  return [tree, ...elements(tree.props.children)];
}

function animationEnvironment(run) {
  const old = Object.fromEntries(['requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver']
    .map(key => [key, globalThis[key]]));
  const frames = new Map();
  let next = 0;
  const observed = [], disconnected = [];
  globalThis.requestAnimationFrame = callback => { frames.set(++next, callback); return next; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; }
    observe(node) { observed.push(node); }
    disconnect() { disconnected.push(true); }
  };
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
  try { run({ flush, frames, observed, disconnected }); }
  finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
}

test('outline collapses on selection, scrolls to the scoped chapter and moves keyboard focus without scrolling again', () => {
  animationEnvironment(({ flush }) => {
    const host = hookHost();
    const tree = host.render();
    const nodes = elements(tree);
    const toggle = nodes.find(node => node.type === 'button' && node.props['aria-controls']);
    toggle.props.onClick();
    assert.equal(elements(host.render()).find(node => node.props['aria-controls'])?.props['aria-expanded'], true);
    const target = sections.at(-1);
    const calls = [];
    host.refs[0].current = { querySelector(selector) {
      calls.push(selector);
      return { scrollIntoView(options) { calls.push(['scroll', options]); }, focus(options) { calls.push(['focus', options]); } };
    } };
    let prevented = 0;
    nodes.find(node => node.type === 'a' && node.props.href?.endsWith(`-${target.id}`))
      .props.onClick({ preventDefault() { prevented++; } });
    assert.equal(prevented, 1);
    const updated = elements(host.render());
    assert.equal(updated.find(node => node.type === 'button' && node.props['aria-controls']).props['aria-expanded'], false);
    assert.ok(updated.find(node => node.props['aria-current'] === 'location').props.href.endsWith(`-${target.id}`));
    assert.deepEqual(calls, [], 'layout settles before jump');
    flush();
    assert.deepEqual(calls, [
      `#english-overview-overview-test-${target.id}`,
      ['scroll', { block: 'start', behavior: 'auto' }],
      ['focus', { preventScroll: true }],
    ]);
  });
});

test('active chapter follows the Dialog scroller and removes observers, listeners and pending frames on unmount', () => {
  animationEnvironment(({ flush, frames, observed, disconnected }) => {
    const host = hookHost(); host.render();
    const listeners = new Map();
    const scroller = {
      getBoundingClientRect: () => ({ top: 100 }),
      addEventListener(name, callback, options) { assert.equal(options.passive, true); listeners.set(name, callback); },
      removeEventListener(name, callback) { assert.equal(listeners.get(name), callback); listeners.delete(name); },
    };
    let secondTop = 300;
    const reader = {
      closest(selector) { assert.equal(selector, '.p-dialog-content'); return scroller; },
      querySelectorAll: () => [
        { dataset: { overviewSection: sections[0].id }, getBoundingClientRect: () => ({ top: 0 }) },
        { dataset: { overviewSection: sections[1].id }, getBoundingClientRect: () => ({ top: secondTop }) },
      ],
      querySelector: () => ({ getBoundingClientRect: () => ({ height: 64 }) }),
    };
    host.refs[0].current = reader;
    const cleanup = host.effects[0](); flush();
    assert.deepEqual(observed, [reader, scroller]);
    assert.ok(listeners.has('scroll'));
    secondTop = 180;
    listeners.get('scroll')(); flush();
    const active = elements(host.render()).find(node => node.props['aria-current'] === 'location');
    assert.ok(active.props.href.endsWith(`-${sections[1].id}`));
    listeners.get('scroll')();
    assert.equal(frames.size, 1);
    cleanup();
    assert.equal(frames.size, 0);
    assert.equal(listeners.size, 0);
    assert.equal(disconnected.length, 1);
  });
});
