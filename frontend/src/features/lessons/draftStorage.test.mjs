import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('./draftStorage.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { lessonDraftKey, lessonSelectionKey, readDraft, isVariantSelection } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('drafts are separated by account, block and variant, including the default', () => {
  const keys = [lessonDraftKey(1, 10, 20), lessonDraftKey(2, 10, 20), lessonDraftKey(1, 11, 20), lessonDraftKey(1, 10, 21), lessonDraftKey(1, 10, null)];
  assert.equal(new Set(keys).size, keys.length);
  const saved = new Map([[keys[0], JSON.stringify('unfinished translation')]]);
  const storage = { getItem: key => saved.get(key) ?? null };
  const isText = value => typeof value === 'string';
  assert.equal(readDraft(storage, keys[0], '', isText), 'unfinished translation');
  for (const key of keys.slice(1)) assert.equal(readDraft(storage, key, '', isText), '');
});

test('selections are separated by account and skill page', () => {
  assert.notEqual(lessonSelectionKey(1, 'reading'), lessonSelectionKey(1, 'writing'));
  assert.notEqual(lessonSelectionKey(1, 'reading'), lessonSelectionKey(2, 'reading'));
  assert.equal(isVariantSelection({ 10: 3, 11: 4 }), true);
  for (const value of [null, [], { 10: '3' }, { 10: -1 }, { 10: 1.5 }, { anything: 3 }]) assert.equal(isVariantSelection(value), false);
});

test('malformed or unavailable browser storage falls back without showing other data', () => {
  const warn = console.warn;
  const warnings = [];
  console.warn = message => warnings.push(message);
  try {
    assert.deepEqual(readDraft({ getItem: () => '{bad' }, 'draft', {}, isVariantSelection), {});
    assert.deepEqual(readDraft({ getItem: () => { throw new Error('blocked'); } }, 'draft', {}, isVariantSelection), {});
    assert.deepEqual(readDraft({ getItem: () => '{"10":"invalid"}' }, 'draft', {}, isVariantSelection), {});
    assert.equal(warnings.length, 2);
  } finally { console.warn = warn; }
});
