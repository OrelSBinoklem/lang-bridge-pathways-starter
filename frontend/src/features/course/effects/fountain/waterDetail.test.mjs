import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('./waterDetail.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { bakeWaterDetail } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

test('the optical tile is deterministic, bounded RGBA8 with useful independent channels', () => {
  const a = bakeWaterDetail(), b = bakeWaterDetail();
  assert.equal(a.size, 128);
  assert.equal(a.data.byteLength, 65536);
  assert.deepEqual(a.data, b.data);
  for (let channel = 0; channel < 4; channel++) {
    const values = a.data.filter((_, index) => index % 4 === channel);
    assert.ok(Math.max(...values) - Math.min(...values) > 100, `channel ${channel} must carry detail`);
  }
});

test('normals use wrapped neighbours even on all four tile boundaries', () => {
  const { data, size } = bakeWaterDetail();
  const height = (x, y) => data[(((y + size) % size) * size + (x + size) % size) * 4 + 2] / 255;
  const encode = value => Math.round(Math.max(0, Math.min(1, value)) * 255);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (x !== 0 && y !== 0 && x !== size - 1 && y !== size - 1) continue;
    const expectedX = encode(.5 + (height(x + 1, y) - height(x - 1, y)) * size / 36);
    const expectedY = encode(.5 + (height(x, y + 1) - height(x, y - 1)) * size / 36);
    assert.ok(Math.abs(data[(y * size + x) * 4] - expectedX) <= 5);
    assert.ok(Math.abs(data[(y * size + x) * 4 + 1] - expectedY) <= 5);
  }
});

test('texture dimensions cannot silently disable mipmaps or allocate an unbounded tile', () => {
  for (const size of [0, 7, 96, 1024, 128.5]) assert.throws(() => bakeWaterDetail(size), RangeError);
});
