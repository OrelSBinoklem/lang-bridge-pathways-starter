import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('./practiceSelection.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { practiceSelectionKey, isPracticeSelections, resolvePracticeSelection } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const page = (skill = 'reading', group = 20, lang = 'lv') => ({
  skill, course_group_id: group, learn_lang: lang,
  blocks: [
    { id: 1, practice_variants: true, variants: [{ id: 50 }, { id: 70 }, { id: 90 }] },
    { id: 2, practice_variants: true, variants: [{ id: 10 }, { id: 30 }, { id: 40 }] },
    { id: 3, variants: [{ id: 11 }, { id: 21 }] },
  ],
});

test('one ordinal selects all blocks across four skill pages, using retained order', () => {
  for (const skill of ['listening', 'reading', 'writing', 'speaking']) {
    assert.deepEqual(resolvePracticeSelection(page(skill), { 'lv:20': 2 }), { scope: 'lv:20', number: 2, variants: { 1: 70, 2: 30 } });
  }
  assert.deepEqual(resolvePracticeSelection(page(), {}).variants, { 1: 50, 2: 10 });
  assert.deepEqual(resolvePracticeSelection(page(), { 'lv:20': 3 }).variants, { 1: 90, 2: 40 });
});

test('isolate accounts, groups and languages; leave grammar and standalone pages alone', () => {
  assert.notEqual(practiceSelectionKey(1), practiceSelectionKey(2));
  assert.equal(resolvePracticeSelection(page('reading', 21), { 'lv:20': 3 }).number, 1);
  assert.equal(resolvePracticeSelection(page('reading', 20, 'en'), { 'lv:20': 3 }).number, 1);
  assert.equal(resolvePracticeSelection(page('grammar'), { 'lv:20': 3 }), null);
  assert.equal(resolvePracticeSelection(page('reading', null), { 'lv:20': 3 }), null);
});

test('missing variant is not silently replaced with the first', () => {
  const data = page();
  data.blocks[0].variants = [{ id: 50 }];
  assert.deepEqual(resolvePracticeSelection(data, { 'lv:20': 3 }).variants, { 2: 40 });
});

test('storage validates group scopes and three allowed ordinals', () => {
  assert.equal(isPracticeSelections({ 'lv:20': 2, 'en:21': 3 }), true);
  assert.equal(isPracticeSelections({}), true);
  for (const value of [null, [], { 'lv:20': 0 }, { 'lv:20': 4 }, { 'lv:20': '2' }, { 'lv:20': 1.5 }, { arbitrary: 1 }]) {
    assert.equal(isPracticeSelections(value), false);
  }
});
