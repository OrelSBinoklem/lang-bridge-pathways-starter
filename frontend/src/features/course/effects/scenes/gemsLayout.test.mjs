import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('./gemsLayout.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { gemsCellRadius } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

test('small showcase cards reduce cells by 40% on both phone and desktop layouts', () => {
  for (const [w, h] of [[320, 190], [500, 190], [800, 220], [1100, 190]]) {
    const full = 90 * (w <= 720 ? 1.8 * .8 : 2.1);
    assert.ok(Math.abs(gemsCellRadius(w, h, 2.1, 1.8) - full * .6) < 1e-10);
  }
});

test('large and page-background compositions retain the requested 1.5x scale, even in landscape', () => {
  for (const [w, h, body] of [[1920, 1080, true], [844, 390, true], [390, 844, false], [1365, 900, false]]) {
    const full = 90 * (w <= 720 ? 1.8 * .8 : 2.1);
    assert.equal(gemsCellRadius(w, h, 2.1, 1.8, body), full);
  }
});

test('live scale tuning is still proportional and compact scaling is applied exactly once', () => {
  const r = gemsCellRadius(500, 190, 2.1, 1.8);
  assert.equal(gemsCellRadius(500, 190, 2.1, 3.6), r * 2);
  assert.equal(gemsCellRadius(500, 190, 2.1, 1.8), r);
});
