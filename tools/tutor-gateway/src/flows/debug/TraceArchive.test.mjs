import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { TraceArchive } from './TraceArchive.mjs';
import { createTraceMonitor } from './TraceMonitor.mjs';
import { defaultFlow } from '../../../../../resources/tutor-flow/graph.mjs';

const root = fileURLToPath(new URL('../../../../../.tmp/', import.meta.url));
async function fixture(run, limits = {}) {
  await mkdir(root, { recursive: true }); const directory = await mkdtemp(join(root, 'trace-archive-'));
  let now = 1800000000000; const store = new TraceArchive({ directory, limits, clock: () => now }); await store.ready;
  try { await run(store, { directory, tick: n => { now += n; } }); }
  finally { await store.pending; assert(resolve(directory).startsWith(resolve(root) + '\\') || resolve(directory).startsWith(resolve(root) + '/')); await rm(directory, { recursive: true }); }
}
const input = (userId = 1) => ({ userId, conversationId: 7, graph: defaultFlow(), versionId: 4, preset: 'standard', model: 'fixture-model', event: { type: 'user.message', transcript: 'Labdien' }, sources: { context_summary: 'Existing summary' } });

test('recording is opt-in, full data survive restart with immutable graph and no audio/credentials', async () => fixture(async (store, { directory }) => {
  assert.equal(await store.begin(input()), null); await store.watch(1);
  const graph = input(), id = await store.begin(graph);
  const full = 'A'.repeat(12000);
  store.append(id, { nodeId: 'source_0', type: 'source', status: 'completed', outputPreview: full, audio: 'private-audio', secret: 'private-secret' });
  await store.finish(id);
  const restarted = new TraceArchive({ directory }); await restarted.ready;
  const result = await restarted.detail(1, id);
  assert.equal(result.events[0].outputPreview, full); assert.equal(result.graph.nodes[0].data.event, 'user.message');
  assert(!JSON.stringify(result).includes('private-secret')); assert(!JSON.stringify(result).includes('private-audio'));
  assert.equal((await restarted.list(1)).runs.length, 1); await assert.rejects(restarted.detail(2, id));
  await assert.rejects(restarted.detail(1, '../../index')); assert((await readFile(`${directory}/${id}.json`, 'utf8')).includes('fixture-model'));
}));

test('count, age, per-user and global byte quotas prune only debug records', async () => fixture(async (store, { tick }) => {
  await store.watch(1); await store.watch(2);
  const ids = [];
  for (let i = 0; i < 4; i++) { tick(1); const id = await store.begin(input()); ids.push(id); store.append(id, { nodeId: 'x', type: 'source', status: 'completed', outputPreview: 'Z'.repeat(2000) }); await store.finish(id); }
  assert.equal((await store.list(1)).runs.length, 2); await assert.rejects(store.detail(1, ids[0]));
  const second = await store.begin(input(2)); await store.finish(second);
  assert((await store.list(2)).totalBytes <= store.limits.totalBytes);
  tick(86400001); assert.equal((await store.list(1)).runs.length, 0); assert.equal((await store.list(2)).recording, false);
}, { runsPerUser: 2, userBytes: 30000, totalBytes: 35000 }));

test('oversized events and active capture allocation are bounded and omissions are explicit', async () => fixture(async store => {
  await store.watch(1);
  const id = await store.begin(input());
  store.append(id, { nodeId: 'x', type: 'source', status: 'completed', outputPreview: 'x'.repeat(10000) });
  assert.equal((await store.detail(1, id)).omitted, 1);
  assert((await store.list(1)).activeBytes <= store.limits.activeBytes);
  for (let n = 0; n < 20; n++) await store.begin(input());
  assert(store.active.size <= 8); assert(store.status(1).activeBytes <= store.limits.activeBytes);
  assert(store.status(1).droppedRuns > 0);
  await store.finish(id);
}, { eventBytes: 1000, activeBytes: 10000 }));

test('monitor rejects all actions before admin authorization and scopes details to selected user', async () => fixture(async store => {
  const sent = [], admin = {}, regular = {};
  const monitor = createTraceMonitor({ archive: store, authorized: ws => ws === admin, send: (ws, data) => sent.push({ ws, data }) });
  await monitor.handle(regular, { type: 'debug.monitor', id: 'x', action: 'watch', userId: 1, enabled: true });
  assert(sent.at(-1).data.error.includes('администраторам')); assert.equal(store.status(1).recording, false);
  await monitor.handle(admin, { type: 'debug.monitor', id: 'x', action: 'watch', userId: 1, enabled: true });
  assert.equal(sent.at(-1).data.data.recording, true);
  const id = await store.begin(input()); store.append(id, { nodeId: 'x', type: 'source', status: 'completed' }); await store.finish(id);
  await monitor.handle(admin, { type: 'debug.monitor', id: 'y', action: 'detail', userId: 2, runId: id }); assert(sent.at(-1).data.error);
  await monitor.handle(admin, { type: 'debug.monitor', id: 'z', action: 'list', userId: 1, conversationId: 999 }); assert.equal(sent.at(-1).data.data.runs.length, 0);
  monitor.close(admin);
}));

test('active checkpoints survive gateway restart, report interruption and never duplicate a history entry', async () => fixture(async (store, { directory }) => {
  await store.watch(1); const id = await store.begin(input());
  store.append(id, { nodeId: 'source_0', type: 'source', status: 'running', inputPreview: 'last active data' });
  await store.checkpoint(); await store.checkpoint();
  assert.equal((await store.list(1)).runs.length, 1);
  const restarted = new TraceArchive({ directory }); await restarted.ready;
  const record = await restarted.detail(1, id);
  assert.equal(record.status, 'failed'); assert(record.error.includes('перезапущен'));
  assert.equal(record.events[0].inputPreview, 'last active data');
  await store.finish(id); assert.equal((await store.list(1)).runs.length, 1);
}));

test('expired or revoked admin permission is rechecked before any archive access', async () => fixture(async store => {
  const sent = [];
  const monitor = createTraceMonitor({ archive: store, authorized: () => true, verify: async () => { throw Error('expired'); }, send: (_ws, value) => sent.push(value) });
  await monitor.handle({}, { type: 'debug.monitor', id: 'expired', userId: 1, action: 'watch', enabled: true });
  assert(sent[0].error.includes('отозван')); assert.equal(store.status(1).recording, false);
}));

test('slow observers cannot queue unbounded full snapshots or parallel archive reads', async () => fixture(async store => {
  const sent = [], ws = {}; let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const monitor = createTraceMonitor({ archive: store, authorized: () => true, verify: () => barrier, send: (_ws, value) => sent.push(value) });
  const first = monitor.handle(ws, { type: 'debug.monitor', id: '1', userId: 1, action: 'list' });
  const second = monitor.handle(ws, { type: 'debug.monitor', id: '2', userId: 1, action: 'list' });
  await monitor.handle(ws, { type: 'debug.monitor', id: '3', userId: 1, action: 'list' });
  assert(sent.find(item => item.id === '3').error.includes('Дождитесь'));
  release(); await Promise.all([first, second]); monitor.close(ws);
  await monitor.handle({ bufferedAmount: 5 * 1024 * 1024 }, { type: 'debug.monitor', id: 'slow', userId: 1, action: 'list' });
  assert(sent.find(item => item.id === 'slow').error.includes('Дождитесь'));
}));
