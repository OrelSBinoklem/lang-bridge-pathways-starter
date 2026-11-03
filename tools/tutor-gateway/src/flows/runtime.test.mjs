import test from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { defaultFlow, topological, validateGraph, FlowExecutionSession } from '../../../../resources/tutor-flow/graph.mjs';
import { FlowExecutionService } from './runtime/FlowExecutionService.mjs';
import { compileTutorGraph } from './runtime/LangGraphCompiler.mjs';
import { createBilling } from '../billing.mjs';

const event = { type: 'user.message', transcript: 'Hello' };
const history = count => [...Array.from({ length: count }, (_, i) => [{ role: 'user', text: `Question ${i}` }, { role: 'assistant', text: `Answer ${i}` }]).flat(), { role: 'user', text: 'Current' }];

test('saved cards compile into actual StateGraph nodes; legacy graphs select native', async () => {
  const graph = defaultFlow(), session = new FlowExecutionSession(graph, { event });
  const compiled = compileTutorGraph(graph, { session });
  const drawable = await compiled.getGraphAsync();
  assert(graph.nodes.every(node => Object.hasOwn(drawable.nodes, node.id)));
  const state = await compiled.invoke({});
  assert.equal(Object.keys(state.nodeResults).length, graph.nodes.length);
  assert.equal(state.nodeResults.compact.status, 'skipped'); assert.equal(session.finish().answer.ok, true);
  const service = new FlowExecutionService();
  const legacy = structuredClone(graph); delete legacy.engine;
  assert.equal((await service.execute(legacy, { event })).engine, 'native');
  assert.equal((await service.execute(graph, { event })).engine, 'langgraph');
  assert.throws(() => validateGraph({ ...graph, engine: 'langflow' }), /движок/);
  assert.throws(() => validateGraph({ ...graph, runtimeUrl: 'http://untrusted.test' }), /неизвестные/);
});

test('one paid node executes once even if asked twice; dependencies cannot be skipped', async () => {
  let calls = 0;
  const session = new FlowExecutionSession(defaultFlow(), { event, runModel: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return { ok: true, reply: 'Hi' }; } });
  await assert.rejects(session.runNode('model'), /ещё не завершены/);
  for (const id of topological(session.graph)) { if (id === 'model') await Promise.all([session.runNode(id), session.runNode(id)]); else await session.runNode(id); }
  assert.equal(calls, 1); assert.equal(session.finish().answer.reply, 'Hi');
  assert.throws(() => new FlowExecutionSession(defaultFlow(), { event }).finish(), /не завершил/);
});

test('native and LangGraph produce identical model packets on both condition branches', async () => {
  const service = new FlowExecutionService();
  for (const count of [2, 20]) {
    const outputs = [];
    for (const engine of ['native', 'langgraph']) {
      let compactCalls = 0, modelCalls = 0;
      const graph = { ...defaultFlow(), engine }, stream = history(count), kept = stream.slice(-11);
      const result = await service.execute(graph, { event, sources: { message_stream: stream, context_summary: 'Before', parameter_state: { task: { completed: false } } },
        runCompact: async (_config, input) => { compactCalls++; assert.deepEqual(input.parts.message_stream, stream);
          return { message_stream: kept, context_summary: 'After', parameter_state: { task: { completed: true } }, user_message_count: 6 }; },
        runModel: async packet => { modelCalls++; return { ok: true, reply: 'Same', metadata: { usage: { input_tokens: 1200, output_tokens: 50 } } }; },
      });
      assert.equal(compactCalls, count === 20 ? 1 : 0); assert.equal(modelCalls, 1);
      assert.equal(result.packet.parts.context_summary, count === 20 ? 'After' : 'Before');
      assert.equal(result.packet.parts.message_stream.length, count === 20 ? 11 : stream.length);
      outputs.push(result.packet);
    }
    assert.deepEqual(outputs[0], outputs[1]);
  }
});

test('parallel LangGraph turns keep user state and billing sessions isolated', async () => {
  const service = new FlowExecutionService(), scope = new AsyncLocalStorage(), observed = [], operations = [];
  const billing = createBilling({ enabled: true, endpoint: 'https://billing.fixture', secret: 's'.repeat(32), fetchImpl: async (url, init) => {
    if (url === 'https://billing.fixture') { const body = JSON.parse(init.body); operations.push(body); return Response.json(body.action === 'reserve' ? { operation: body.reference } : { ok: true }); }
    return Response.json({ usage: { input_tokens: 20, output_tokens: 5 } });
  } });
  const results = await Promise.all(['user-A', 'user-B'].map(owner => scope.run(owner, () => billing.run(owner, () => service.execute(defaultFlow(), {
    event, sources: { parameter_state: { notes: [owner] } }, runModel: async packet => {
      await new Promise(resolve => setTimeout(resolve, owner === 'user-A' ? 8 : 1));
      observed.push([scope.getStore(), packet.parts.parameter_state.notes[0]]);
      await billing.fetch('https://api.openai.com/v1/responses', { method: 'POST', body: JSON.stringify({ model: 'gpt-6-luna', input: owner, max_output_tokens: 700 }) });
      return { ok: true, reply: owner };
    },
  })))));
  assert.deepEqual(new Set(results.map(result => result.answer.reply)), new Set(['user-A', 'user-B']));
  assert(observed.every(([owner, note]) => owner === note));
  assert.deepEqual(new Set(operations.filter(op => op.action === 'reserve').map(op => op.session)), new Set(['user-A', 'user-B']));
  assert.equal(operations.filter(op => op.action === 'settle').length, 2);
});

test('model failure is not automatically retried and cancellation never completes reply', async () => {
  const service = new FlowExecutionService(); let calls = 0; const trace = [];
  await assert.rejects(service.execute(defaultFlow(), { event, onEvent: e => trace.push(e), runModel: async () => { calls++; throw Error('provider failed'); } }), /provider failed/);
  assert.equal(calls, 1); assert(!trace.some(e => e.nodeId === 'reply' && e.status === 'completed'));
  const controller = new AbortController(); let started;
  const ready = new Promise(resolve => { started = resolve; }); const cancelledTrace = [];
  const pending = service.execute(defaultFlow(), { event, signal: controller.signal, onEvent: e => cancelledTrace.push(e),
    runModel: (_packet, _config, execution) => new Promise((_, reject) => { started(); execution.signal.addEventListener('abort', () => reject(execution.signal.reason), { once: true }); }) });
  await ready; controller.abort(new Error('cancelled turn'));
  await assert.rejects(pending, /cancelled turn/); assert(!cancelledTrace.some(e => e.nodeId === 'reply' && e.status === 'completed'));
});

test('LangGraph never uploads conversation traces even when process tracing is enabled', async t => {
  const keys = ['LANGSMITH_TRACING', 'LANGCHAIN_TRACING_V2', 'LANGCHAIN_TRACING'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) process.env[key] = 'true';
  t.after(() => { for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; });
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    requests.push({ url: String(url), method: init.method || 'GET', body: init.body });
    return Response.json({ version: '0.18.0' });
  });
  const result = await new FlowExecutionService().execute(defaultFlow(), { event });
  assert.equal(result.answer.ok, true);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.deepEqual(requests, []);
});
