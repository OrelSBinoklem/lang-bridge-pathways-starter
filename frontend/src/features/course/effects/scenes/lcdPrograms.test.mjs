import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = ts.transpileModule(await readFile(new URL('./lcdPrograms.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createExtraLcdPrograms } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

function display(cols, rows) {
  const pixels = new Uint8Array(cols * rows);
  let seed = 17;
  const put = (x, y, shade) => {
    assert.ok(Number.isFinite(x) && Number.isFinite(y), 'pixel coordinates must stay finite');
    assert.ok(Number.isInteger(shade) && shade >= 0 && shade <= 3, 'only four LCD ink levels');
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < cols && y < rows) pixels[y * cols + x] = shade;
  };
  const line = (x0, y0, x1, y1, shade) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= steps; k++) put(x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps, shade);
  };
  const rect = (x, y, width, height, shade, fill = true) => {
    for (let yy = 0; yy < height; yy++) for (let xx = 0; xx < width; xx++) {
      if (fill || !xx || !yy || xx === width - 1 || yy === height - 1) put(x + xx, y + yy, shade);
    }
  };
  const programs = createExtraLcdPrograms({ cols, rows, put, line, rect, text() {}, rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; } });
  return { pixels, programs };
}

for (const [cols, rows] of [[119, 32], [88, 48], [29, 48]]) {
  test(`new LCD programs animate safely on ${cols}×${rows}, with distinct compositions`, () => {
    const { programs, pixels } = display(cols, rows);
    assert.deepEqual(programs.map(p => p.name), ['radar', 'lander', 'network']);
    const signatures = new Set();
    for (const program of programs) {
      program.start();
      const frames = new Set();
      for (let frame = 0; frame < 660; frame++) {
        const t = frame / 60;
        pixels.fill(0);
        program.tick(1 / 60, t);
        program.draw(t);
        assert.ok(pixels.some(v => v > 0));
        if (frame % 60 === 0) frames.add(Buffer.from(pixels).toString('base64'));
      }
      assert.ok(frames.size >= 5, `${program.name} should move over time`);
      signatures.add(Buffer.from(pixels).toString('base64'));
    }
    assert.equal(signatures.size, 3);
  });
}

test('lander feet meet the level landing pad and its descent restarts on selection', () => {
  const cols = 119, rows = 32;
  const { programs, pixels } = display(cols, rows);
  const lander = programs.find(p => p.name === 'lander');
  lander.start(); lander.tick(6.2, 6.2); lander.draw(6.2);
  const x = Math.round(cols * .64);
  for (const dx of [-5, -4, -3, 3, 4, 5]) assert.equal(pixels[(rows - 5) * cols + x + dx], 3);
  pixels.fill(0); lander.start(); lander.draw(0);
  assert.equal(pixels[3 * cols + Math.round(cols * .18) - 2], 3);
});
