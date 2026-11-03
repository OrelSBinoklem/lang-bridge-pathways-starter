import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = ts.transpileModule(await readFile(new URL('./clearLed.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createClearLedOptics } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('optics cache stays bounded; drawing only blits sprites and preserves opacity', () => {
  const created = [];
  const oldDocument = globalThis.document;
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, { get: (_, key) => key.toString().startsWith('create') ? () => gradient : () => {} });
  globalThis.document = { createElement: () => {
    const canvas = { width: 0, height: 0, getContext: () => context };
    created.push(canvas);
    return canvas;
  } };
  try {
    let paletteReads = 0;
    const optics = createClearLedOptics(() => { paletteReads++; return '#ffbb44'; });
    assert.equal(created.length, 2);
    assert.equal(paletteReads, 96);
    assert.ok(created[1].width * created[1].height * 4 < 7 * 1024 ** 2);
    const draws = [];
    const ctx = { globalAlpha: 0.8, drawImage: (...args) => draws.push({ args, alpha: ctx.globalAlpha }) };
    optics.housing(ctx, 100, 200, 12);
    for (const phase of [-5.3, -0.001, 0, 0.99999, 1, 123.5]) {
      optics.light(ctx, 100, 200, 12, phase, 0.5);
      const { args, alpha } = draws.at(-1);
      const [image, sx, sy, sw, sh, dx, dy, dw, dh] = args;
      assert.ok(sx >= 0 && sx + sw <= image.width);
      assert.ok(sy >= 0 && sy + sh <= image.height);
      assert.ok(Math.abs(dx + dw / 2 - 100) < 1e-8);
      assert.ok(Math.abs(dy + dh / 2 - 200) < 1e-8);
      assert.equal(alpha, 0.4);
      assert.equal(ctx.globalAlpha, 0.8);
    }
    optics.light(ctx, 0, 0, 1, 0, -2);
    assert.equal(draws.at(-1).alpha, 0);
    optics.light(ctx, 0, 0, 1, 0, 10);
    assert.equal(draws.at(-1).alpha, 0.8);
    assert.equal(created.length, 2);
    assert.equal(paletteReads, 96);
  } finally {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
});
