import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const loaded = { exports: {} };
new Function('exports', ts.transpileModule(readFileSync(new URL('./layout.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(loaded.exports);
const { CONTENT_WIDTH, CONTENT_GAP, getFullscreenRegions } = loaded.exports;

test('background compositions occupy the left and right margins, never the reading column', () => {
  for (const width of [1920,2560,3440,3840]) for (const height of [900,1080,2160]) {
    const regions = getFullscreenRegions(width, height, true);
    assert.equal(regions.length, 2);
    const [left, right] = regions;
    assert.equal(left.id, 'left'); assert.equal(right.id, 'right');
    assert.equal(left.left, 0); assert.equal(right.left + right.width, width);
    assert.equal(left.width, right.width);
    assert(left.left + left.width <= (width - CONTENT_WIDTH) / 2 - CONTENT_GAP);
    assert(right.left >= (width + CONTENT_WIDTH) / 2 + CONTENT_GAP);
    assert.equal(left.height, height); assert.equal(right.height, height);
  }
});

test('hidden content and narrow screens use one uninterrupted fullscreen composition', () => {
  for (const width of [320,390,1365,1920,3840]) assert.deepEqual(getFullscreenRegions(width,900,false), [{ id: 'full', left: 0, top: 0, width, height: 900 }]);
  for (const width of [320,390,1365]) assert.equal(getFullscreenRegions(width,900,true)[0].id, 'full');
});
