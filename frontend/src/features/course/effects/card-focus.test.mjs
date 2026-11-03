import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('./FullscreenEffect.tsx', import.meta.url), 'utf8');
const loaded = { exports: {} }, calls = [];
const render = view => function MockRenderer(props) { calls.push({ view, ...props }); return React.createElement('span', { 'data-view': view }); };
new Function('require', 'exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText)(name => {
  if (name === './ExpandedCardEffect') return { ExpandedCardEffect: render('expanded-card') };
  if (name === './scenes/BodySceneEffect') return { BodySceneEffect: render('body-scene') };
  if (name === './BodySurfaceEffect') return { BodySurfaceEffect: render('body-surface') };
  if (name === './BodyEffectContent') return { BodyEffectContent: render('body-content') };
  if (name === './scenes/registry') return { getScene: id => ({ id }) };
  return require(name);
}, loaded.exports);

test('small-screen focus renders the actual card composition for every renderer family', () => {
  for (const effect of [
    { kind: 'scene', sceneId: 'genome-garden', bodyEffect: { scene: 'genome-garden' } },
    { kind: 'sparkle', bodyEffect: 'fluid' }, { kind: 'video' }, { kind: 'ambient' },
  ]) {
    calls.length = 0;
    const tuning = { kind: 'fixture', params: {} };
    renderToStaticMarkup(React.createElement(loaded.exports.FullscreenEffect, { effect, tuning, focused: true, cardComposition: true }));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].view, 'expanded-card');
    assert.equal(calls[0].effect, effect);
    assert.equal(calls[0].tuning, tuning);
  }
});

test('desktop focus and normal backgrounds retain their full-size renderers', () => {
  for (const focused of [false, true]) for (const cardComposition of [false, true]) {
    calls.length = 0;
    renderToStaticMarkup(React.createElement(loaded.exports.FullscreenEffect, {
      effect: { kind: 'scene', bodyEffect: { scene: 'genome-garden' } }, focused, cardComposition,
    }));
    assert.equal(calls[0].view, focused && cardComposition ? 'expanded-card' : 'body-scene');
  }
  const page = readFileSync(new URL('../CoursePath.tsx', import.meta.url), 'utf8');
  assert.match(page, /expandCard=\{effectFocus && !fullHdEffects\}/);
  const expanded = readFileSync(new URL('./ExpandedCardEffect.tsx', import.meta.url), 'utf8');
  assert.match(expanded, /<CardEffect effect=\{effect\} tuning=\{tuning\}/);
  assert.match(expanded, /position: 'fixed', inset: 0/);
  assert.match(expanded, /useFullscreenPointer\(getBounds\)/);
  assert.doesNotMatch(expanded, /FullscreenSurface|BodySceneEffect|bodyView/);
});

test('card garden has one right-aligned crown while the background keeps its two original positions', () => {
  const code = readFileSync(new URL('./scenes/genomeGarden.ts', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('garden.ts', code, ts.ScriptTarget.Latest, true);
  const expressions = {};
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ['count', 'fitWidth', 'centerX'].includes(node.name.getText(ast))) expressions[node.name.getText(ast)] = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const evaluate = (name, c, count = 1, index = 0, sideWidth = 100, edgeFactor = 0.52) => new Function('c', 'count', 'index', 'sideWidth', 'edgeFactor', `return ${expressions[name]}`)(c, count, index, sideWidth, edgeFactor);
  for (const width of [280, 390, 500, 1100]) {
    const c = { width, body: false };
    assert.equal(evaluate('count', c), 1);
    const center = evaluate('centerX', c), halfWidth = evaluate('fitWidth', c) / 2;
    assert.ok(center - halfWidth > width * 0.55);
    assert.ok(center + halfWidth < width);
  }
  const c = { width: 1920, body: true };
  assert.equal(evaluate('count', c), 2);
  assert.equal(evaluate('centerX', c, 2, 0), 52);
  assert.equal(evaluate('centerX', c, 2, 1), 1920 - 52);
});
