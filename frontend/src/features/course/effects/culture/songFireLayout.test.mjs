import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const loaded = { exports: {} };
new Function('exports', ts.transpileModule(readFileSync(new URL('./songFireLayout.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(loaded.exports);
const { getSongFireLayout } = loaded.exports;

test('fullscreen keeps its only fire low on the right at every viewport height', () => {
  for (const [width, height] of [[1920, 1080], [2560, 1440], [3840, 2160], [390, 844], [1100, 650]]) {
    const { ground, fireX, fireY } = getSongFireLayout(width, height, true);
    assert.ok(ground >= height * .8);
    assert.ok(fireY > ground && fireY < height);
    assert.ok(fireX > width * .7 && fireX < width);
  }
});

test('card composition is unchanged and fullscreen forwards its explicit layout mode', () => {
  for (const height of [190, 220, 650]) {
    assert.deepEqual(getSongFireLayout(1100, height), {
      ground: Math.min(height, 260) - 16,
      fireX: 957,
      fireY: Math.min(height, 260) - 8,
    });
  }
  const wrapper = readFileSync(new URL('../fullscreen/SongFireFullscreen.tsx', import.meta.url), 'utf8');
  const engine = readFileSync(new URL('./SongFireEffect.tsx', import.meta.url), 'utf8');
  assert.match(wrapper, /<SongFireEffect fullscreen/);
  assert.match(engine, /getSongFireLayout\(width, height, fullscreen\)/);
  assert.match(engine, /paintNight\(night, width, height/);
});

test('old amber shader and fallback are restored, without activating the replacement studio', () => {
  const amber = readFileSync(new URL('./AmberEffect.tsx', import.meta.url), 'utf8');
  const fallback = readFileSync(new URL('./Amber2DFallback.tsx', import.meta.url), 'utf8');
  assert.match(amber, /from '\.\/amberShader'/);
  assert.match(amber, /<AmberFallback/);
  assert.doesNotMatch(amber, /amberStudio|amberModel/);
  assert.match(fallback, /AMBER_LETTERS, AMBER_WORDS/);
});
