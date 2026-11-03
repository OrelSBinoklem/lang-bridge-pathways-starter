import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultFlow, defaultContextInputs, createModuleDefinition } from '../../../../resources/tutor-flow/graph.mjs';
import { createFlowTestRunner } from './flowTestRunner.mjs';
import { FlowExecutionService } from './runtime/FlowExecutionService.mjs';
import { ExecutionCheckpointStore, executionFingerprint } from './runtime/ExecutionCheckpointStore.mjs';

const event = { type: 'user.message', transcript: 'Hello' };
async function fixture(t, limits = {}) {
  const root = new URL('../../../../.tmp/flow-recovery-tests/', import.meta.url);
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(fileURLToPath(root), 'run-'));
  const options = { directory: join(directory, 'records'), temporary: join(directory, 'writes'), limits };
  const store = new ExecutionCheckpointStore(options);
  return { store, options, service: new FlowExecutionService({ checkpoints: store }) };
}

test('real LangGraph pauses before model, new service restores disk state without repeating source calls', async t => {
  const { service, options } = await fixture(t); let reads = 0, calls = 0;
  const sources = { context_summary: 'Already learned' };
  const onEvent = value => { if (value.nodeId === 'source_0' && value.status === 'running') reads++; };
  const graph = defaultFlow(), recovery = { owner: 'admin:1', settings: { preset: 'standard' }, pauseBefore: 'model' };
  const first = await service.execute(graph, { event, sources, recovery, onEvent, runModel: async () => { calls++; return { ok: true, reply: 'Hi' }; } });
  assert.equal(first.paused, true); assert.deepEqual(first.next, ['model']); assert.equal(calls, 0);
  const before = reads;
  const restarted = new FlowExecutionService({ checkpoints: new ExecutionCheckpointStore(options) });
  const second = await restarted.execute(graph, { event, sources, onEvent, recovery: { ...recovery, pauseBefore: undefined, id: first.checkpoint.id, resume: true },
    runModel: async packet => { calls++; assert.equal(packet.parts.context_summary, 'Already learned'); return { ok: true, reply: 'Hi' }; } });
  assert.equal(second.answer.reply, 'Hi'); assert.equal(calls, 1); assert.equal(reads, before);
  const again = await restarted.execute(graph, { event, sources, recovery: { ...recovery, pauseBefore: undefined, id: first.checkpoint.id, resume: true },
    runModel: async () => { calls++; throw Error('must not repeat'); } });
  assert.equal(again.answer.reply, 'Hi'); assert.equal(calls, 1);
});

test('studio reconnect resumes exact saved dry run; authorization and mode cannot be bypassed', async t => {
  const { service } = await fixture(t); const events = [];
  let user = 1, allowed = true, paid = 0;
  const make = () => createFlowTestRunner({ send: value => events.push(value), authorize: () => allowed, owner: () => user,
    resolveConfig: async () => ({}), respond: async () => { paid++; }, executionService: service });
  const request = { graph: defaultFlow(), event, sources: {}, live: false, pauseBefore: 'model' };
  await make().run(request); assert.equal(events.at(-1).paused, true); const id = events.at(-1).checkpoint.id;
  user = 2; await make().run({ ...request, pauseBefore: '', resume: id }); assert.match(events.at(-1).error, /Нет доступа/);
  user = 1; await make().run({ ...request, pauseBefore: '', resume: id }); assert.equal(events.at(-1).done, true); assert(!events.at(-1).error); assert.equal(paid, 0);
  allowed = false; await make().run({ ...request, resume: id }); assert.match(events.at(-1).error, /администратору/);
});

test('cancellation after the provider returned stores its answer before observing abort', async t => {
  const { service } = await fixture(t); const controller = new AbortController(); let id, calls = 0;
  const recovery = { owner: 'conversation:1:7', settings: {} };
  await assert.rejects(service.execute(defaultFlow(), { event, recovery, signal: controller.signal,
    onEvent: e => { if (e.type === 'execution_checkpoint') id = JSON.parse(e.outputPreview).id; },
    runModel: async () => { calls++; controller.abort(Error('socket closed')); return { ok: true, reply: 'Received before abort' }; } }), /socket closed/);
  const result = await service.execute(defaultFlow(), { event, recovery: { ...recovery, id, resume: true },
    runModel: async () => { calls++; throw Error('must not repeat'); } });
  assert.equal(result.answer.reply, 'Received before abort'); assert.equal(calls, 1);
});

test('nested helper result survives a parent failure, with no duplicate helper request', async t => {
  const { service, options } = await fixture(t); let id, failed = false;
  const graph = defaultFlow(), definition = createModuleDefinition({ id: 'helper', name: 'Internal helper' });
  definition.nodes = [definition.nodes[0],
    { id: 'prompt', type: 'prompt', position: { x: 300, y: 0 }, data: { text: 'Find evidence.' } },
    { id: 'context', type: 'context', position: { x: 600, y: 0 }, data: { inputs: defaultContextInputs(), order: ['in1', '$request'] } },
    { id: 'model', type: 'model', position: { x: 1000, y: 0 }, data: { model: 'preset', reasoning: 'preset', maxOutputTokens: 1200 } }, definition.nodes.at(-1)];
  const wire = (id, source, target, targetHandle = 'in', sourceHandle = 'out') => ({ id, source, target, targetHandle, sourceHandle });
  definition.edges = [wire('a', 'input_1', 'prompt'), wire('b', 'prompt', 'context', 'in1'), wire('c', 'context', 'model'), wire('d', 'model', 'output_1')];
  graph.nodes.push({ id: 'helper_call', type: 'module', position: { x: 1200, y: 900 }, data: { definition } });
  graph.edges.push(wire('gate_helper', 'count_gate', 'helper_call', 'in1', 'false'), wire('compact_helper', 'compact', 'helper_call', 'in1'), wire('helper_context', 'helper_call', 'context', 'in5', 'out1'));
  const calls = [], recovery = { owner: 'admin:4', settings: {} };
  const runModel = async (packet, _data, execution) => {
    calls.push(execution.nodeId);
    if (execution.nodeId === 'model') assert(JSON.stringify(packet).includes('HELPER_EVIDENCE'));
    return { ok: true, reply: execution.modulePath.length ? 'HELPER_EVIDENCE' : 'FINAL' };
  };
  await assert.rejects(service.execute(graph, { event, recovery, runModel, onEvent: e => {
    if (e.type === 'execution_checkpoint') id = JSON.parse(e.outputPreview).id;
    if (!failed && e.nodeId === 'helper_call__model' && e.status === 'completed') { failed = true; throw Error('parent interrupted'); }
  } }), /parent interrupted/);
  const result = await new FlowExecutionService({ checkpoints: new ExecutionCheckpointStore(options) }).execute(graph, { event, runModel, recovery: { ...recovery, id, resume: true } });
  assert.equal(result.answer.reply, 'FINAL'); assert.deepEqual(calls, ['helper_call__model', 'model']);
});

test('compaction is not repeated and restored sources contain the compacted state', async t => {
  const { service, options } = await fixture(t); let calls = 0;
  const sources = { message_stream: Array.from({ length: 21 }, (_, n) => ({ role: 'user', text: `Question ${n}` })), context_summary: 'Before', parameter_state: { done: false } };
  const recovery = { owner: 'conversation:3:9', settings: {} };
  const first = await service.execute(defaultFlow(), { event, sources, recovery: { ...recovery, pauseBefore: 'model' }, runCompact: async () => {
    calls++; return { context_summary: 'After', parameter_state: { done: true }, message_stream: [{ role: 'user', text: 'Kept' }], user_message_count: 1 };
  } });
  const result = await new FlowExecutionService({ checkpoints: new ExecutionCheckpointStore(options) }).execute(defaultFlow(), { event, sources, recovery: { ...recovery, id: first.checkpoint.id, resume: true },
    runCompact: async () => { calls++; throw Error('duplicate compression'); }, runModel: async packet => {
      assert.equal(packet.parts.context_summary, 'After'); assert.deepEqual(packet.parts.parameter_state, { done: true }); assert.equal(packet.parts.message_stream.length, 1);
      return { ok: true, reply: 'Continued' };
    } });
  assert.equal(result.answer.reply, 'Continued'); assert.equal(calls, 1);
});

test('long valid context fits bounded compressed scheduler history and restores unchanged', async t => {
  const { service, store, options } = await fixture(t);
  const text = 'Learning languages takes practice. '.repeat(1200), sources = { message_stream: [{ role: 'user', text }] };
  const recovery = { owner: 'size-regression', settings: {} };
  const result = await service.execute(defaultFlow(), { event, sources, recovery });
  assert(result.checkpoint.bytes < 4 * 1048576);
  const record = await store.read(result.checkpoint.id);
  assert(Object.keys(record.checkpoints).length <= 3);
  const again = await new FlowExecutionService({ checkpoints: new ExecutionCheckpointStore(options) }).execute(defaultFlow(), { event, sources, recovery: { ...recovery, id: result.checkpoint.id, resume: true } });
  assert.equal(again.packet.parts.message_stream[0].text, text); assert.deepEqual(again.answer, result.answer);
});

test('failure after paid node preserves result even if trace observer crashes', async t => {
  const { service, options } = await fixture(t); let calls = 0, id;
  const recovery = { owner: 'user:12', settings: { model: 'fixture' } };
  await assert.rejects(service.execute(defaultFlow(), { event, recovery,
    onEvent: value => { if (value.type === 'execution_checkpoint') id = JSON.parse(value.outputPreview).id; if (value.nodeId === 'model' && value.status === 'completed') throw Error('observer failed'); },
    runModel: async () => { calls++; return { ok: true, reply: 'Paid answer' }; } }), /observer failed/);
  assert(id);
  const result = await new FlowExecutionService({ checkpoints: new ExecutionCheckpointStore(options) }).execute(defaultFlow(), {
    event, recovery: { ...recovery, id, resume: true }, runModel: async () => { calls++; throw Error('duplicate provider call'); } });
  assert.equal(result.answer.reply, 'Paid answer'); assert.equal(calls, 1);
});

test('unknown outcome never automatically retries external calls; other owners and changed graphs cannot resume', async t => {
  const { service, store } = await fixture(t); let calls = 0, id;
  const graph = defaultFlow(), recovery = { owner: 'user:1', settings: {} };
  await assert.rejects(service.execute(graph, { event, recovery,
    onEvent: value => { if (value.type === 'execution_checkpoint') id = JSON.parse(value.outputPreview).id; },
    runModel: async () => { calls++; throw Error('connection lost after sending'); } }), /connection lost/);
  const opts = { event, recovery: { ...recovery, id, resume: true }, runModel: async () => { calls++; return { ok: true }; } };
  await assert.rejects(service.execute(graph, opts), /Автоповтор запрещён/); assert.equal(calls, 1);
  await assert.rejects(service.execute(graph, { ...opts, recovery: { ...opts.recovery, owner: 'user:2' } }), /Нет доступа/);
  await assert.rejects(service.execute({ ...graph, name: 'Changed' }, opts), /изменились/);
  assert.equal(store.active.size, 0);
});

test('limits reject before external calls; locks, expiry and retention are bounded', async t => {
  const { store } = await fixture(t, { maxRuns: 2, ownerRuns: 2, runBytes: 2000, activeRuns: 2 });
  const opts = { owner: 'one', fingerprint: executionFingerprint({}) };
  const first = await store.acquire(opts);
  await assert.rejects(store.acquire({ ...opts, id: first.record.id, resume: true }), /уже запущено/);
  await first.start('model', 'model');
  await assert.rejects(first.complete('model', { status: 'completed', result: 'x'.repeat(4000) }), /лимита памяти/);
  assert.equal((await store.read(first.record.id)).nodes.model.status, 'running');
  await assert.rejects(first.close('failed'), /лимита памяти/); assert.equal(store.active.size, 0);
  for (let n = 0; n < 3; n++) { const lease = await store.acquire(opts); await lease.close('completed'); }
  const latest = await store.acquire(opts); const raw = await readFile(join(store.directory, `${latest.record.id}.json`), 'utf8');
  assert(!raw.includes('"owner":"one"')); await latest.close('completed');
});

test('transient Windows target locks retry only the atomic file replacement', async t => {
  const { options } = await fixture(t); let attempts = 0;
  const store = new ExecutionCheckpointStore({ ...options, replace: async (...args) => {
    if (++attempts <= 2) throw Object.assign(Error('scanner holds target'), { code: 'EPERM' });
    return rename(...args);
  } });
  const lease = await store.acquire({ owner: 'fixture', fingerprint: executionFingerprint({}) });
  assert.equal(attempts, 3); await lease.close('completed');
  assert.equal((await store.read(lease.record.id)).status, 'completed');
});
