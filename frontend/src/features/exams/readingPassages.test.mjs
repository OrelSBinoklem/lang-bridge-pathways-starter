import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('./readingPassages.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { readingPassages } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const packs = await Promise.all(['a2', 'b1', 'b2'].map(async level => JSON.parse(await readFile(
  new URL(`../../../../resources/course/exams/revisions/2026-10-03-${level}-reading.json`, import.meta.url), 'utf8'))));

test('English labelled notice sets alternate their own text and question without changing keys', async () => {
  for (const level of ['a1', 'a2']) {
    const variants = JSON.parse(await readFile(new URL(`../../../../resources/course/exams/english/${level}.json`, import.meta.url), 'utf8'));
    for (const variant of variants) {
      const task = variant.sections[1].tasks[0];
      const pairs = readingPassages(task);
      if (!/^(?:Notice|Message) [A-H1-8]:/u.test(task.questions[0].prompt)) {
        assert.equal(pairs, null, task.id);
        continue;
      }
      assert.equal(pairs?.length, task.questions.length, task.id);
      assert.equal(pairs.map(pair => pair.text).join('\n\n'), task.text.trim());
      assert.deepEqual(pairs.map(pair => pair.question), task.questions);
      assert.equal(readingPassages({...task, questions: [...task.questions].reverse()}), null);
      assert.equal(readingPassages(variant.sections[1].tasks[1]), null);
    }
  }
});

test('all five A2 four-text tasks alternate each full passage with its original question', () => {
  for (const variant of packs[0].variants) {
    const task = variant.replace_sections.reading.tasks[0];
    const before = JSON.stringify(task);
    const pairs = readingPassages(task);
    assert.equal(pairs?.length, 4, task.id);
    assert.equal(pairs.map(pair => pair.text).join('\n\n'), task.text.trim());
    assert.deepEqual(pairs.map(pair => pair.question.id), task.questions.map(q => q.id));
    pairs.forEach((pair, index) => assert.equal(pair.question, task.questions[index]));
    assert.equal(JSON.stringify(task), before);
  }
});

test('shared A2 advertisement banks and cloze passages are never split into text-question pairs', () => {
  for (const variant of packs[0].variants) {
    for (const task of variant.replace_sections.reading.tasks.slice(1)) assert.equal(readingPassages(task), null, task.id);
  }
});

test('other levels only alternate explicitly matched three-choice questions, without discarding any text', () => {
  let paired = 0;
  for (const pack of packs.slice(1)) for (const variant of pack.variants) for (const task of variant.replace_sections.reading.tasks) {
    const pairs = readingPassages(task);
    if (!pairs) continue;
    paired++;
    assert.equal(pairs.map(pair => pair.text).join('\n\n'), task.text.trim());
    assert.deepEqual(pairs.map(pair => pair.question), task.questions);
  }
  assert.ok(paired > 0);
});

test('unclear or reordered labels fall back to the unsplit task instead of guessing', () => {
  const task = packs[0].variants[0].replace_sections.reading.tasks[0];
  assert.equal(readingPassages({ ...task, text: task.text.replace('III.', 'V.') }), null);
  assert.equal(readingPassages({ ...task, questions: [...task.questions].reverse() }), null);
  assert.equal(readingPassages({ ...task, text: `Instructions\n\n${task.text}` }), null);
  assert.equal(readingPassages({ ...task, questions: task.questions.slice(0, 3) }), null);
});
