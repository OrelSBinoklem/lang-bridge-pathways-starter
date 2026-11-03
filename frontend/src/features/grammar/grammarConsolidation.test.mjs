import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const catalog = JSON.parse(readFileSync(new URL('./data/practiceConsolidation.json', import.meta.url)));
const index = JSON.parse(readFileSync(new URL('../../../../tools/tutor-gateway/src/commands/grammarTablesIndex.json', import.meta.url))).filter(table => table.language !== 'en');
const compiled = { exports: {} };
new Function('require', 'exports', ts.transpileModule(readFileSync(new URL('./data/grammarTableBindings.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText)(() => catalog, compiled.exports);

test('two new cards remain, the combined table is last, all retired links resolve', () => {
  assert.equal(index.length, 68);
  assert.equal(index.at(-1).tableKey, 'patikInfinitive');
  assert.deepEqual(index.filter(t => String(t.tableId).startsWith('sentence-')).map(t => t.tableKey).sort(), [...catalog.kept].sort());
  const active = new Set(index.map(t => t.tableKey));
  assert.equal(Object.keys(catalog.retired).length, 31);
  for (const [key, entry] of Object.entries(catalog.retired)) {
    assert.equal(active.has(key), false);
    assert(entry.tables.every(target => active.has(target)));
    assert.equal(compiled.exports.resolveGrammarTableLink(entry.id), entry.tables[0]);
    assert.deepEqual(compiled.exports.resolveGrammarTableKeys([key]), entry.tables);
  }
});

test('all targets of the changed table docs still resolve in actual React markup', async () => {
  const { createRequire } = await import('node:module');
  const { fileURLToPath, pathToFileURL } = await import('node:url');
  const path = await import('node:path');
  const require = createRequire(import.meta.url);
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), { load } = require('cheerio');
  const root = fileURLToPath(new URL('../../../../', import.meta.url));
  const registry = readFileSync(new URL('./componentRegistry.tsx', import.meta.url), 'utf8');
  function loadComponent(file) {
    const module = { exports: {} };
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    new Function('require', 'exports', code)(name => name.endsWith('.css') ? {} : name.startsWith('.')
      ? loadComponent(path.resolve(path.dirname(file), path.extname(name) ? name : name + '.jsx')) : require(name), module.exports);
    return module.exports;
  }
  for (const key of ['patikInfinitive', 'genitivs', 'adjEndings', 'paligteikumi1', 'paligteikumi2', 'questionsChart']) {
    const componentName = registry.match(new RegExp(`\\b${key}: (\\w+)`))[1];
    const importPath = registry.match(new RegExp(`import ${componentName} from '([^']+)'`))[1];
    const Component = loadComponent(path.resolve(root, 'frontend/src', importPath.replace('@/', ''))).default;
    const $ = load(renderToStaticMarkup(React.createElement(Component)));
    if (key === 'patikInfinitive') {
      assert.match($('.tt-title').text(), /Хочу, могу, нужно, нравится/);
      for (const selector of ['.tt-modal-want', '.tt-modal-can', '.tt-vajag-man', '.tt-person-man', '.tt-exam']) {
        assert.equal($(selector).length, 1);
      }
    }
    if (key === 'questionsChart') {
      assert($('.tt-q-cik .q-ex').text().includes('Cik tev ir gadu?'));
      assert.equal(compiled.exports.resolveGrammarTableLink('sentence-age'), key);
    }
    const doc = (await import(pathToFileURL(path.join(root, `tools/tutor-gateway/src/commands/grammar-tables/${key}.mjs`)))).default;
    for (const [name, target] of Object.entries(doc.highlightTargets)) {
      assert(target.selectors.some(item => item.selector === ':scope' || $(item.selector).length), `${key}: ${name}`);
    }
  }
});
