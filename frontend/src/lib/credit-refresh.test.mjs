import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('./credit-refresh.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { watchCreditBalance, notifyCreditsChanged, isCreditMutation, CREDIT_REFRESH_STORAGE } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
globalThis.window = undefined;
globalThis.document = undefined;

function browser(t) {
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { hidden: false });
  const writes = [];
  window.localStorage = { setItem: (...args) => writes.push(args) };
  t.mock.property(globalThis, 'window', window);
  t.mock.property(globalThis, 'document', document);
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  return { window, document, writes };
}

test('idle and open-dialog polling use two minutes, never five or thirty seconds', async t => {
  browser(t);
  let calls = 0;
  const watcher = watchCreditBalance(async () => { calls++; }, assert.fail);
  t.after(watcher.stop);
  await flush();
  assert.equal(calls, 1);
  t.mock.timers.tick(119999); await flush();
  assert.equal(calls, 1);
  t.mock.timers.tick(201); await flush();
  assert.equal(calls, 2);
  watcher.refresh(); await flush();
  assert.equal(calls, 3, 'opening dialog refreshes immediately');
  t.mock.timers.tick(30000); await flush();
  assert.equal(calls, 3);
});

test('balance events coalesce, other tabs signal without copying financial data', async t => {
  const { window, writes } = browser(t);
  let calls = 0;
  const watcher = watchCreditBalance(async () => { calls++; }, assert.fail);
  t.after(watcher.stop);
  await flush();
  notifyCreditsChanged(); notifyCreditsChanged();
  window.dispatchEvent(Object.assign(new Event('storage'), { key: CREDIT_REFRESH_STORAGE }));
  t.mock.timers.tick(200); await flush();
  assert.equal(calls, 2);
  assert.equal(writes.length, 2);
  assert.equal(writes[0][0], CREDIT_REFRESH_STORAGE);
  assert.match(writes[0][1], /^\d+:0\./);
  window.dispatchEvent(Object.assign(new Event('storage'), { key: 'unrelated' }));
  t.mock.timers.tick(200); await flush();
  assert.equal(calls, 2);
});

test('hidden tabs skip polling and events, restoring focus and visibility refreshes once', async t => {
  const { window, document } = browser(t);
  let calls = 0;
  const watcher = watchCreditBalance(async () => { calls++; }, assert.fail);
  t.after(watcher.stop);
  await flush(); document.hidden = true;
  notifyCreditsChanged(); t.mock.timers.tick(240200); await flush();
  assert.equal(calls, 1);
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('focus'));
  t.mock.timers.tick(200); await flush();
  assert.equal(calls, 2);
});

test('a change during a slow refresh queues one follow-up without concurrent requests', async t => {
  browser(t);
  let calls = 0, finish;
  const watcher = watchCreditBalance(() => { calls++; return new Promise(resolve => { finish = resolve; }); }, assert.fail);
  t.after(watcher.stop);
  notifyCreditsChanged(); t.mock.timers.tick(200);
  watcher.refresh(); watcher.refresh();
  assert.equal(calls, 1);
  finish(); await flush(); t.mock.timers.tick(200); await flush();
  assert.equal(calls, 2);
  finish(); await flush();
});

test('cleanup aborts in-flight refresh, clears listeners/timers and suppresses late errors', async t => {
  const { window } = browser(t);
  let signal, reject, calls = 0, errors = 0;
  const watcher = watchCreditBalance(s => { signal = s; calls++; return new Promise((_, fail) => { reject = fail; }); }, () => errors++);
  notifyCreditsChanged(); watcher.stop();
  assert.equal(signal.aborted, true);
  reject(new Error('cancelled')); await flush();
  notifyCreditsChanged(); window.dispatchEvent(new Event('focus'));
  t.mock.timers.tick(240500); await flush();
  assert.equal(calls, 1); assert.equal(errors, 0);
});

test('refresh errors are visible and do not prevent later recovery', async t => {
  browser(t);
  let calls = 0, errors = 0;
  const watcher = watchCreditBalance(async () => { if (++calls === 1) throw new Error('offline'); }, () => errors++);
  t.after(watcher.stop);
  await flush(); watcher.refresh(); await flush();
  assert.equal(errors, 1); assert.equal(calls, 2);
});

test('storage denied still notifies the current tab', t => {
  const { window } = browser(t);
  let events = 0;
  window.addEventListener('lbp:credits-changed', () => events++);
  window.localStorage.setItem = () => { throw new Error('denied'); };
  assert.doesNotThrow(notifyCreditsChanged);
  assert.equal(events, 1);
});

test('only explicit paid HTTP operations invalidate balance, never balance reads or exam autosave', () => {
  for (const path of ['/me/subscription', '/lessons/blocks/1/translation-check', '/exam-attempts/5/grade', '/exam-attempts/5/speech', '/tutor/messages', '/tutor/references', '/tutor/memory/notes/search']) {
    assert.equal(isCreditMutation(path, 'POST'), true, path);
    assert.equal(isCreditMutation(path, 'GET'), false, path);
  }
  for (const path of ['/me/credits', '/me/credits/statistics', '/training/attempt', '/tutor/ticket', '/exam-attempts/5', '/exam-attempts/5/audio']) {
    assert.equal(isCreditMutation(path, 'POST'), false, path);
  }
  assert.equal(isCreditMutation('/me/subscription'), false);
  assert.equal(isCreditMutation('/me/subscription?test=1', 'post'), true);
});

test('API wrapper invalidates on successful, rejected and uncertain paid calls, never on balance reads', async t => {
  const { window } = browser(t);
  let changes = 0;
  window.addEventListener('lbp:credits-changed', () => changes++);
  const moduleUrl = output => `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`;
  const api = ts.transpileModule(await readFile(new URL('./api.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const client = ts.transpileModule(await readFile(new URL('./client-api.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace("'@/lib/api'", JSON.stringify(moduleUrl(api)))
    .replace("'@/lib/credit-refresh'", JSON.stringify(moduleUrl(compiled)));
  const { clientApi } = await import(moduleUrl(client));
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: {} }));
  await clientApi('/me/credits');
  assert.equal(changes, 0);
  await clientApi('/me/subscription', { method: 'POST' });
  assert.equal(changes, 1);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Low balance' }, { status: 402 }));
  await assert.rejects(clientApi('/lessons/blocks/1/translation-check', { method: 'POST' }), /Low balance/);
  assert.equal(changes, 2);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  await assert.rejects(clientApi('/exam-attempts/1/grade', { method: 'POST' }), /offline/);
  assert.equal(changes, 3);
});
