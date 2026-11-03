import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('./tutorReconnect.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { TutorReconnect } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('reconnect uses capped backoff, schedules one timer and resets after success', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const recovery = new TutorReconnect();
  let attempts = 0;
  for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
    const before = attempts;
    recovery.schedule(() => attempts++);
    recovery.schedule(() => attempts += 100);
    t.mock.timers.tick(delay - 1);
    assert.equal(attempts, before);
    t.mock.timers.tick(1);
    assert.equal(attempts, before + 1);
  }
  recovery.ready();
  recovery.schedule(() => attempts++);
  t.mock.timers.tick(1000);
  assert.equal(attempts, 8);
});

test('explicit close cancels reconnect without submitting any user request', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const recovery = new TutorReconnect();
  let called = false;
  recovery.schedule(() => { called = true; });
  recovery.cancel();
  t.mock.timers.tick(60000);
  assert.equal(called, false);
});
