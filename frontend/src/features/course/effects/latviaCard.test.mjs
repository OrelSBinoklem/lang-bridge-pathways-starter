import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const calls = [];
function EffectCanvas(props) { calls.push(props); return React.createElement('span'); }
const compiled = ts.transpileModule(readFileSync(new URL('./EffectSurface.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const loaded = { exports: {} };
new Function('require', 'exports', compiled)(name => {
  if (name === 'react/jsx-runtime') return require(name);
  if (name === 'next/dynamic') return { __esModule: true, default: () => EffectCanvas };
  if (name === './natureCardComposition') return { natureCardComposition: () => null };
  return new Proxy({}, { get: () => () => null });
}, loaded.exports);
function render(kind, bodyView = false) {
  calls.length = 0;
  const effect = { kind }, tuning = { kind, params: { positionX: 1.42, cubeScale: 1.36 } };
  renderToStaticMarkup(React.createElement(loaded.exports.EffectSurface, {
    effect, tuning, width: 500, height: 190, bodyView, pointerRef: { current: {} }, getHost: () => null,
  }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].effect, effect); assert.equal(calls[0].tuning, tuning);
  return calls[0];
}

test('Latvia card restores original framing; explicit body previews and other effects are unchanged', () => {
  assert.equal(render('latvia-cube').framed, false);
  assert.equal(render('latvia-cube', true).framed, true);
  assert.equal(render('ambient').framed, true);
});

test('original card camera stays at 4.7 with the original x offset and no auto fitting', () => {
  const code = readFileSync(new URL('./EffectCanvas.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('canvas.tsx', code, ts.ScriptTarget.Latest, true);
  const expressions = {};
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ['cubeParams', 'cubeDistance'].includes(node.name.getText(ast))) expressions[node.name.getText(ast)] = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const original = { positionX: 1.42, cubeScale: 1.36 };
  const params = new Function('framed', 'latviaCubeParams', 'createLatviaCubeParams', `return ${expressions.cubeParams}`)(false, original, () => original);
  assert.equal(params, original);
  for (const [width, height] of [[320, 190], [500, 190], [900, 500], [1365, 900]]) {
    const distance = new Function('framed', 'cubeParams', 'width', 'height', `return ${expressions.cubeDistance}`)(false, params, width, height);
    assert.equal(distance, 4.7);
  }
  const full = readFileSync(new URL('./fullscreen/LatviaCubeFullscreen.tsx', import.meta.url), 'utf8');
  assert.match(full, /positionX: original.positionX - defaults.positionX/);
  assert.match(full, /position: \[0, 0, distance\]/);
});
