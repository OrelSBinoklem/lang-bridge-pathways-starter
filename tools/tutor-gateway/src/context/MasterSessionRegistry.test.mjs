import test from 'node:test';
import assert from 'node:assert/strict';
import { MasterSessionRegistry, MASTER_SESSION_POLICY } from './MasterSessionRegistry.mjs';

const snapshot = text => ({ revision: 2, afterId: 9, messages: [{ id: 9, role: 'user', text }] });

test('ten-minute idle grace reuses one conversation, without retaining caller objects', () => {
  let time = 0;
  const registry = new MasterSessionRegistry({ now: () => time });
  const first = registry.open(1, 7), data = snapshot('private');
  registry.release(first, data); data.messages[0].text = 'changed';
  time = MASTER_SESSION_POLICY.idleGraceMs - 1;
  const next = registry.open(1, 7);
  assert.equal(next.id, first.id); assert.equal(next.snapshot.messages[0].text, 'private');
  assert.equal(registry.describe(next).resumed, false, 'cached data is not trusted before DB authorization');
  registry.confirmRestore(next, true); assert.equal(registry.describe(next).resumed, true);
  assert.equal(registry.stats().idleBytes, 0);
  registry.release(next, next.snapshot);
  time += MASTER_SESSION_POLICY.idleGraceMs;
  const expired = registry.open(1, 7);
  assert.notEqual(expired.id, first.id); assert.equal(expired.snapshot, null);
});

test('owner and conversation boundaries never share snapshots or lease identities', () => {
  const registry = new MasterSessionRegistry();
  const a = registry.open(1, 7); registry.release(a, snapshot('user1'));
  const b = registry.open(2, 7), c = registry.open(1, 8);
  assert.equal(b.snapshot, null); assert.equal(c.snapshot, null);
  assert.notEqual(b.id, a.id); assert.notEqual(c.id, a.id);
  assert.throws(() => registry.open(null, 7)); assert.throws(() => registry.open(1, '7'));
  assert.equal(registry.open(1, 7).snapshot.messages[0].text, 'user1');
});

test('concurrent tabs bypass cache and cannot overwrite a later lifetime', () => {
  let time = 0;
  const registry = new MasterSessionRegistry({ now: () => time });
  const a = registry.open(1, 7), b = registry.open(1, 7);
  assert.equal(b.id, a.id); assert.equal(b.snapshot, null);
  registry.release(b, snapshot('newer')); registry.release(a, snapshot('older'));
  assert.equal(registry.stats().sessions, 0);
  const c = registry.open(1, 7);
  registry.release(c, snapshot('current'));
  registry.release(a, snapshot('stale close callback'));
  assert.equal(registry.open(1, 7).snapshot.messages[0].text, 'current');
  time += 100000000; registry.prune();
  assert.equal(registry.stats().active, 1, 'active conversations do not expire as idle');
});

test('payload, count and attachment bounds evict only idle caches', () => {
  const events = [], registry = new MasterSessionRegistry({ policy: { maxIdleBytes: 150, maxSnapshotBytes: 140, maxSessions: 2, maxAttachmentsPerSession: 2 }, onEvent: (event, fields) => events.push({ event, fields }) });
  const active = registry.open(1, 1);
  const old = registry.open(1, 2); registry.release(old, snapshot('x'));
  const newer = registry.open(1, 3);
  assert.equal(registry.stats().sessions, 2);
  assert.equal(registry.describe(active).active, true);
  registry.release(newer, snapshot('z'.repeat(1000)));
  assert.equal(registry.stats().sessions, 1);
  const other = registry.open(2, 1);
  assert.throws(() => registry.open(3, 1), /Слишком много/);
  registry.open(1, 1);
  assert.throws(() => registry.open(1, 1), /нескольких вкладках/);
  registry.release(other);
  assert(events.some(row => row.event === 'session.evicted'));
  assert(!JSON.stringify(events).includes('messages'));
});

test('global byte cap removes oldest detached payload, never active sessions', () => {
  let time = 0;
  const registry = new MasterSessionRegistry({ policy: { maxIdleBytes: 200 }, now: () => time });
  const a = registry.open(1, 1); registry.release(a, snapshot('a'.repeat(30)));
  time++;
  const b = registry.open(1, 2); registry.release(b, snapshot('b'.repeat(30)));
  assert(registry.stats().idleBytes <= 200);
  assert.equal(registry.open(1, 1).snapshot, null);
  assert.equal(registry.open(1, 2).snapshot.messages[0].text, 'b'.repeat(30));
});

test('foreground work is isolated by conversation and rejects a second tab before its action runs', async () => {
  const registry = new MasterSessionRegistry(), a = registry.open(1, 7), b = registry.open(1, 7), other = registry.open(2, 7);
  let finish; const waiting = new Promise(resolve => { finish = resolve; });
  const run = registry.execute(a, () => waiting);
  await assert.rejects(registry.execute(b, () => assert.fail('Concurrent paid operation')), /ещё выполняется/);
  assert.equal(await registry.execute(other, async () => 'other user'), 'other user');
  assert.equal(registry.describe(a).pendingTurns, 1);
  finish('done'); assert.equal(await run, 'done');
  assert.equal(await registry.execute(b, async () => 'next tab'), 'next tab');
  await assert.rejects(registry.execute(b, async () => { throw Error('provider failed'); }), /provider failed/);
  assert.equal(registry.describe(a).pendingTurns, 0);
});

test('disconnect does not release a running operation into another tab; replacement work stays bounded', async () => {
  const registry = new MasterSessionRegistry(), a = registry.open(1, 7);
  let finish; const waiting = new Promise(resolve => { finish = resolve; });
  const first = registry.execute(a, () => waiting), replacement = registry.execute(a, () => waiting);
  await assert.rejects(registry.execute(a, () => assert.fail('Unbounded queue')), /ещё выполняется/);
  registry.release(a, snapshot('saved'));
  const reconnected = registry.open(1, 7);
  await assert.rejects(registry.execute(reconnected, () => assert.fail('Old operation still active')), /ещё выполняется/);
  finish(); await Promise.all([first, replacement]);
  assert.equal(await registry.execute(reconnected, async () => 'safe'), 'safe');
});
