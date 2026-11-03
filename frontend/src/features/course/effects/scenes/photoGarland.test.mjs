import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const kit = url(compile(await readFile(new URL('./kit.ts', import.meta.url), 'utf8')));
const { PHOTO_GARLAND } = await import(url(compile(await readFile(new URL('./photoGarland.ts', import.meta.url), 'utf8')).replace(/(['"])\.\/kit\1/, JSON.stringify(kit))));

function album(body, region, width = 520) {
  const captions = new Set();
  const context = () => new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (key === 'fillText') return text => captions.add(text);
      return () => {};
    },
  });
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: context }) };
  let seed = 42;
  const scene = PHOTO_GARLAND.create({ width, height: 800, dpr: 1, body, region,
    params: { speed: 1, react: 1, intensity: 1 }, palette: PHOTO_GARLAND.palettes[0],
    rand: () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; },
  });
  const g = context();
  scene.draw(g);
  return { captions, clickAll() {
    for (let x = 20; x < width; x += 30) for (let y = 70; y < 260; y += 30) {
      scene.update(0, 0, { active: true, clicked: true, x, y, rawX: x, rawY: y, vx: 0 });
      scene.draw(g);
    }
  }, close() { globalThis.document = previous; } };
}

test('large left album stays distinct from the original right/card album, including after clicks', () => {
  const left = album(true, 'left');
  const initial = left.captions.size;
  left.clickAll();
  assert.ok(left.captions.size > initial, 'clicks develop new pictures');
  left.close();
  const right = album(true, 'right');
  right.clickAll();
  right.close();
  assert.ok(left.captions.size >= 4 && right.captions.size >= 4);
  for (const caption of left.captions) assert.ok(!right.captions.has(caption), caption);
  const card = album(false, undefined);
  card.close();
  for (const caption of card.captions) assert.ok(right.captions.has(caption), 'card retains original album');
});

test('focused full composition uses both albums rather than duplicating one side', () => {
  const left = album(true, 'left'); left.clickAll(); left.close();
  const right = album(true, 'right'); right.clickAll(); right.close();
  for (const region of ['full', undefined]) {
    const full = album(true, region, 1100); full.close();
    assert.ok([...full.captions].some(c => left.captions.has(c)));
    assert.ok([...full.captions].some(c => right.captions.has(c)));
  }
});
