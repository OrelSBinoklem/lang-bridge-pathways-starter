import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(readFileSync(new URL('./touchAim.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { effectClientPoint } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

test('finger aim switches at the two screen edges and holds its side across the middle', () => {
  const previous = globalThis.window;
  globalThis.window = { innerHeight: 844 };
  const finger = (type, y, id = 1) => ({ type, clientX: 180, clientY: y, pointerType: 'touch', pointerId: id });
  try {
    assert.equal(effectClientPoint(finger('pointerdown', 400)).clientY, 348);
    assert.equal(effectClientPoint(finger('pointermove', 10)).clientY, 62);
    assert.equal(effectClientPoint(finger('pointermove', 420)).clientY, 472, 'stay below after visiting top');
    assert.equal(effectClientPoint(finger('pointermove', 830)).clientY, 778);
    assert.equal(effectClientPoint(finger('pointermove', 420)).clientY, 368, 'stay above after visiting bottom');
    effectClientPoint(finger('pointerup', 420));
    assert.equal(effectClientPoint(finger('pointerdown', 420)).clientY, 368, 'new touch starts above');
    assert.equal(effectClientPoint(finger('pointerdown', 10, 2)).clientY, 62, 'independent fingers');
  } finally { globalThis.window = previous; }
});

test('small cards clamp the aim without activating an effect outside the real contact bounds', () => {
  const previous = globalThis.window;
  globalThis.window = { innerHeight: 844 };
  try {
    const bounds = { left: 20, top: 300, width: 320, height: 180 };
    const event = { type: 'pointerdown', clientX: 100, clientY: 310, pointerType: 'touch', pointerId: 3 };
    assert.equal(effectClientPoint(event, bounds).clientY, 302);
    assert.equal(effectClientPoint(event, bounds).clientY, 302, 'multiple consumers never apply twice');
    assert.equal(effectClientPoint({ ...event, clientY: 500 }, bounds).clientY, 448);
    for (const pointerType of ['mouse', 'pen', undefined]) {
      assert.deepEqual(effectClientPoint({ ...event, pointerType }, bounds), { clientX: 100, clientY: 310 });
    }
  } finally { globalThis.window = previous; }
});
