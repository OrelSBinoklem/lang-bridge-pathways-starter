import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./renderSize.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { renderSize } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('native 1080p and 4K remain native at quality 1', () => {
  assert.deepEqual(renderSize(1920, 1080, 1, 1, false), { width: 1920, height: 1080 });
  assert.deepEqual(renderSize(3840, 2160, 1, 1, false), { width: 3840, height: 2160 });
});
test('retina 1440p uses device density rather than CSS resolution', () => {
  assert.deepEqual(renderSize(2560, 1440, 1.5, 1, false), { width: 3840, height: 2160 });
});
test('quality is a direct multiplier, not a hidden second reduction', () => {
  assert.deepEqual(renderSize(1920, 1080, 1, 0.5, false), { width: 960, height: 540 });
  assert.deepEqual(renderSize(1280, 720, 1, 1.5, false), { width: 1920, height: 1080 });
});
test('mobile retains sharpness and ultrawide stays inside the allocation budget', () => {
  assert.deepEqual(renderSize(390, 844, 2, 1, true), { width: 780, height: 1688 });
  const big = renderSize(7680, 4320, 2, 1.5, false);
  assert.ok(big.width * big.height < 9010000);
  assert.ok(Math.abs(big.width / big.height - 16 / 9) < 0.001);
});
