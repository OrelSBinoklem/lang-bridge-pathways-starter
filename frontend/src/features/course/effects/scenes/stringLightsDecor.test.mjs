import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compilerOptions = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 };
const kit = { exports: {} }, decor = { exports: {} };
const source = readFileSync(new URL('./stringLightsDecor.ts', import.meta.url), 'utf8');
const compile = code => ts.transpileModule(code, { compilerOptions }).outputText;
new Function('exports', compile(readFileSync(new URL('./kit.ts', import.meta.url), 'utf8')))(kit.exports);
new Function('require', 'exports', compile(source))(() => kit.exports, decor.exports);
const { getFridgeLayout } = decor.exports;

test('card fridge sits at the right margin without resizing or mirroring its magnets', () => {
  for (const [width, height] of [[280, 190], [500, 220], [1100, 190]]) {
    const left = getFridgeLayout(width, height);
    const right = getFridgeLayout(width, height, 'right');
    assert.equal(right.x + right.w, width * 0.988);
    assert.ok(right.x > width / 2);
    for (const key of ['y', 'w', 'h', 'split']) assert.equal(right[key], left[key]);
    assert.equal(right.y + right.h, height * 0.85);
  }
});

test('fullscreen retains the original left fridge and card layout leaves room for it', () => {
  const layout = getFridgeLayout(1920, 1080, 'left');
  assert.equal(layout.x, 1920 * 0.012);
  assert.deepEqual(layout, getFridgeLayout(1920, 1080));
  const runner = readFileSync(new URL('./canvasScenes5.ts', import.meta.url), 'utf8');
  assert.match(runner, /paintDecor\(\{ a, d \}, W, H, c.rand, c.body \? 'left' : 'right'\)/);
  assert.match(source, /plantX = u\(fridgeSide === 'right' \? 0.075 : 0.905\)/);
  assert.match(runner, /createFridgeMagnets\(decor.fridge, S\)/);
});

test('reducing scene height keeps the fridge and magnet surface at the same size', () => {
  for (const width of [280, 500, 1100, 1920]) for (const side of ['left', 'right']) {
    const reference = getFridgeLayout(width, 1080, side);
    for (const height of [900, 650, 320, 190, 100]) {
      const layout = getFridgeLayout(width, height, side);
      assert.equal(layout.w, reference.w);
      assert.equal(layout.h, reference.h);
      assert.equal(layout.h / layout.w, 1.75);
      assert.equal(layout.x, reference.x);
      assert.ok(Math.abs(layout.y + layout.h - height * 0.85) < 1e-9);
    }
  }
});
