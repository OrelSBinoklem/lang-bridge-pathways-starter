import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { load } from 'cheerio';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../..');
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
function readModule(file) {
  if (cache.has(file)) return cache.get(file);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  } }).outputText;
  const loaded = { exports: {} };
  const require = spec => {
    if (/\.(css|scss)$/.test(spec)) return {};
    if (!spec.startsWith('.')) return nativeRequire(spec);
    const target = path.resolve(path.dirname(file), spec);
    return readModule(path.extname(target) ? target : `${target}.ts`);
  };
  new Function('require', 'module', 'exports', source)(require, loaded, loaded.exports);
  cache.set(file, loaded.exports);
  return loaded.exports;
}
const { grammarSections } = readModule(path.join(here, 'grammar.ts'));
const { conceptSections } = readModule(path.join(here, 'concepts.ts'));
const { tableExplanations } = readModule(path.join(here, 'explanations.ts'));
const all = [...grammarSections, ...conceptSections];

test('both handbooks cover A1–B2 with unique sections and complete RU/UK content', () => {
  assert.ok(grammarSections.length >= 26);
  assert.ok(conceptSections.length >= 13);
  for (const sections of [grammarSections, conceptSections]) {
    assert.equal(new Set(sections.map(s => s.id)).size, sections.length);
    assert.deepEqual([...new Set(sections.map(s => s.level))], ['A1', 'A2', 'B1', 'B2']);
  }
  for (const section of all) {
    assert.ok(section.paragraphs.length > 0 && section.examples.length > 0);
    const texts = [section.title, section.summary, section.remember, ...section.paragraphs,
      ...section.examples.flatMap(e => [e.translation, ...(e.note ? [e.note] : [])]), ...(section.table?.focus.map(t => t.label) ?? []),
      ...(section.comparison?.headings ?? []), ...(section.comparison?.rows.flat() ?? [])];
    for (const text of texts) for (const locale of ['ru', 'uk']) assert.ok(text[locale]?.trim(), `${section.id}: ${locale}`);
    for (const row of section.comparison?.rows ?? []) assert.equal(row.length, section.comparison.headings.length);
  }
});

test('every embedded highlight resolves in the real React table and its tutor documentation', async () => {
  const registryFile = path.resolve(here, '../../grammar/componentRegistry.tsx');
  const ast = ts.createSourceFile(registryFile, readFileSync(registryFile, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = new Map();
  const components = new Map();
  function visit(node) {
    if (ts.isImportDeclaration(node) && node.importClause?.name && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.set(node.importClause.name.text, node.moduleSpecifier.text);
    }
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'grammarTableComponents') {
      let value = node.initializer;
      if (ts.isSatisfiesExpression(value)) value = value.expression;
      for (const prop of value.properties) components.set(prop.name.getText(ast), prop.initializer.getText(ast));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const section of all.filter(s => s.table)) {
    const spec = section.table;
    const importPath = imports.get(components.get(spec.key));
    assert.ok(importPath, spec.key);
    const componentPath = path.resolve(root, 'frontend/src', importPath.replace(/^@\//, ''));
    const Component = readModule(componentPath).default;
    const $ = load(renderToStaticMarkup(createElement(Component)));
    const doc = (await import(pathToFileURL(path.join(root, `tools/tutor-gateway/src/commands/grammar-tables/${spec.key}.mjs`)))).default;
    const documented = Object.values(doc.highlightTargets).flatMap(target => target.selectors.map(s => s.selector));
    for (const target of spec.focus) {
      for (const locale of ['ru', 'uk']) assert.ok((target.description ?? tableExplanations[spec.key]?.[target.selector])?.[locale]?.length > 40, `${spec.key}: explanation missing (${locale})`);
      assert.match(target.selector, /^\.tt-[a-z0-9-]+(?:\s+\.tt-[a-z0-9-]+)*$/);
      assert.ok($(target.selector).length, `${spec.key}: missing ${target.selector}`);
      assert.ok(documented.includes(target.selector), `${spec.key}: undocumented ${target.selector}`);
    }
  }
});
