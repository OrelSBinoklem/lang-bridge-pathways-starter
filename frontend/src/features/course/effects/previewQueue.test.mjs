import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = ts.transpileModule(await readFile(new URL('./previewQueue.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createPreviewQueue } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('no more than two simultaneous warm-ups; queued cards start FIFO', () => {
  const enqueue = createPreviewQueue();
  const started = [], done = [];
  for (let i = 0; i < 5; i++) enqueue(release => { started.push(i); done.push(release); });
  assert.deepEqual(started, [0, 1]);
  done[0](); assert.deepEqual(started, [0, 1, 2]);
  done[1](); assert.deepEqual(started, [0, 1, 2, 3]);
  done[2](); assert.deepEqual(started, [0, 1, 2, 3, 4]);
});
test('scrolling away cancels waiting cards without mounting a renderer', () => {
  const enqueue = createPreviewQueue(1);
  let release; let calls = 0;
  enqueue(done => { release = done; });
  const cancel = enqueue(() => { calls++; });
  cancel(); release(); assert.equal(calls, 0);
});
test('cancelling an active job frees a slot exactly once', () => {
  const enqueue = createPreviewQueue(1);
  let release; let calls = 0;
  const cancel = enqueue(done => { release = done; });
  enqueue(() => { calls++; });
  enqueue(() => { calls++; });
  cancel(); cancel(); release(); assert.equal(calls, 1);
});
test('completed slots remain reusable after Strict Mode cleanup', () => {
  const enqueue = createPreviewQueue(1);
  const calls = [];
  const cancel = enqueue(done => { calls.push(1); done(); });
  cancel(); enqueue(done => { calls.push(2); done(); });
  enqueue(done => { calls.push(3); done(); });
  assert.deepEqual(calls, [1, 2, 3]);
});
