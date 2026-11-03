import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
async function load(file) {
  const code = ts.transpileModule(await readFile(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const { MOTIFS, LEFT_MOTIFS, embroideryPattern } = await load('./motifs.ts');
const { MOTIF_WORDS } = await load('./words.ts');
const shape = motif => motif.cells.map(c => `${c.col},${c.row}`).sort().join(';');

test('left-side motifs have genuinely different shapes and matching Latvian/RU/UK names', () => {
  assert.equal(LEFT_MOTIFS.length, 6);
  const shapes = new Set(MOTIFS.map(shape));
  for (let i = 0; i < LEFT_MOTIFS.length; i++) {
    const motif = LEFT_MOTIFS[i];
    assert.ok(!shapes.has(shape(motif)), motif.id);
    shapes.add(shape(motif));
    assert.ok(motif.cells.length > 10);
    assert.ok(motif.cells.every(c => c.col >= 0 && c.col < 11 && c.row >= 0 && c.row < 11));
    assert.equal(new Set(motif.cells.map(c => `${c.col},${c.row}`)).size, motif.cells.length);
    const word = MOTIF_WORDS[MOTIFS.length + i];
    assert.ok(word.lv && word.ru && word.uk);
  }
});

test('card and right preserve their exact legacy sequence while left never duplicates right', () => {
  for (let band = 0; band < 8; band++) for (let slot = 0; slot < 12; slot++) {
    const old = (slot + band * 2) % MOTIFS.length;
    assert.equal(embroideryPattern(slot, band, 12, 'card').motif, MOTIFS[old]);
    assert.equal(embroideryPattern(slot, band, 12, 'right').word, old);
    assert.notEqual(shape(embroideryPattern(slot, band, 12, 'left').motif), shape(MOTIFS[old]));
  }
});

test('focus mode keeps the new motifs on its left half and legacy motifs on its right half', () => {
  for (const slots of [3, 8, 17]) for (let slot = 0; slot < slots; slot++) {
    const pattern = embroideryPattern(slot, 2, slots, 'full');
    assert.equal(LEFT_MOTIFS.includes(pattern.motif), slot < Math.floor(slots / 2));
    assert.ok(MOTIF_WORDS[pattern.word]);
  }
});
