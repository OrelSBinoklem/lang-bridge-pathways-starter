import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createModuleDefinition, validateModuleDefinition, validateGraph, executeFlow, defaultFlow, defaultContextInputs, flowSettings, nodeCatalog, FlowExecutionSession } from './graph.mjs';

const node = (id, type, data = {}) => ({ id, type, position: { x: 0, y: 0 }, data });
const edge = (source, target, sourceHandle = 'out', targetHandle = 'in') => ({ id: `${source}_${target}_${sourceHandle}_${targetHandle}`, source, target, sourceHandle, targetHandle });
function definition(nodes = [node('input', 'module_input', { port: 'in1' }), node('source', 'source', { source: 'important_notes', limitChars: 24000 }), node('output', 'module_output', { port: 'out1' })], edges = [edge('input', 'source'), edge('source', 'output')]) {
  return { ...createModuleDefinition(), nodes, edges };
}
function graph(def = definition(), visual = true) {
  const nodes = [
    ...['user.message', 'user.audio', 'tool.result'].map((event, i) => node(`event${i}`, 'event', { event })),
    node('instance', 'module', { definition: def }),
    node('context', 'context', visual ? { inputs: defaultContextInputs(), order: ['in1', '$request'] } : { order: ['instance', '$request'] }),
    node('model', 'model', { model: 'preset', reasoning: 'preset', maxOutputTokens: 8192 }),
    node('tools', 'tools', { allCommands: true, allowedCommands: [], maxSteps: 6 }), node('reply', 'reply'), node('speech', 'speech', { enabled: true }),
  ];
  return { version: 2, name: 'Test modules', nodes, edges: [
    ...[0, 1, 2].map(i => edge(`event${i}`, 'instance', 'out', 'in1')), edge('instance', 'context', 'out1', visual ? 'in1' : 'in'),
    edge('context', 'model'), edge('model', 'tools'), edge('tools', 'reply'), edge('reply', 'speech'),
  ] };
}
const event = { type: 'user.message', transcript: 'Hello' };

test('PHP and browser validators share module/port ID fixtures', () => {
  const ids = JSON.parse(readFileSync(new URL('../../tests/Fixtures/tutor-flow-module-ids.json', import.meta.url), 'utf8'));
  ids.valid.push('a'.repeat(80)); ids.invalid.push('a'.repeat(81));
  for (const [kind, values] of Object.entries(ids)) for (const id of values) {
    const d = definition(); d.id = id; d.inputs[0].id = id; d.nodes[0].data.port = id; d.outputs[0].id = id; d.nodes[2].data.port = id;
    if (kind === 'valid') assert.doesNotThrow(() => validateModuleDefinition(d));
    else assert.throws(() => validateModuleDefinition(d));
  }
});

test('pure factories, facade exports, stable ports, strict shape and immutable old graphs', () => {
  const old = defaultFlow(), bytes = JSON.stringify(old);
  assert.equal(JSON.stringify(validateGraph(old)), bytes);
  assert.equal(nodeCatalog.module.label, 'Модуль'); assert.equal(nodeCatalog.module_input.group, 'Границы модуля');
  const boundaryRoot = defaultFlow(); boundaryRoot.nodes.push(node('input', 'module_input', { port: 'in1' })); assert.throws(() => validateGraph(boundaryRoot), /только внутри/);
  for (const inputs of [1, 16]) for (const outputs of [1, 16]) {
    const d = createModuleDefinition({ id: 'custom', inputs, outputs });
    assert.equal(d.inputs.length, inputs); assert.equal(d.outputs.length, outputs);
    assert.deepEqual(validateModuleDefinition(d), d);
  }
  for (const mutate of [d => { d.path = 'evil.mjs'; }, d => { d.nodes[1].data.command = 'eval'; }, d => { d.inputs[0].id = 'constructor'; }, d => { d.outputs[0].id = '__proto__'; }, d => { d.version = 0; }, d => { d.nodes[1].type = 'tools'; }, d => { d.nodes[0].data.port = 'missing'; }, d => { d.nodes.push(d.nodes[0]); }, d => { d.nodes[1].data.text = () => ''; }, d => { d.nodes[1].id = 'nested__id'; }, d => { d.nodes[1].data.text = 'x'.repeat(131073); }]) {
    const d = createModuleDefinition(); mutate(d); assert.throws(() => validateModuleDefinition(d));
  }
  for (const count of [0, 17, 1.2]) assert.throws(() => createModuleDefinition({ inputs: count }));
  const d = createModuleDefinition(); d.nodes[1].data.text = 'changed'; assert.equal(createModuleDefinition().nodes[1].data.text, '');
});

test('fragment boundaries, cycles, handles, own node limit and expanded graph limits', () => {
  const wrap = d => definition([node('input', 'module_input', { port: 'in1' }), node('nested', 'module', { definition: d }), node('output', 'module_output', { port: 'out1' })], [edge('input', 'nested', 'out', 'in1'), edge('nested', 'output', 'out1')]);
  const three = wrap(wrap(definition())); assert.doesNotThrow(() => validateGraph(graph(three)));
  assert.throws(() => validateModuleDefinition(wrap(three)), /3/);
  const bad = graph(); bad.edges.find(e => e.source === 'instance').sourceHandle = 'missing'; assert.throws(() => validateGraph(bad), /выход/);
  const badInput = graph(); badInput.edges[0].targetHandle = 'missing'; assert.throws(() => validateGraph(badInput), /вход/);
  const cycle = definition(); cycle.edges.push(edge('source', 'input')); assert.throws(() => validateModuleDefinition(cycle));
  const orphan = definition(); orphan.nodes.push(node('orphan', 'prompt', { text: '' })); assert.throws(() => validateModuleDefinition(orphan));
  const many = definition(); many.nodes = [many.nodes[0], ...Array.from({ length: 62 }, (_, i) => node(`p${i}`, 'prompt', { text: '' })), many.nodes[2]];
  many.edges = many.nodes.slice(1).map((n, i) => edge(many.nodes[i].id, n.id));
  // Prompt-to-prompt is intentionally invalid; expand through permitted nested modules instead.
  const base = createModuleDefinition({ inputs: 16, outputs: 16 });
  const big = graph(base); big.nodes = big.nodes.filter(n => n.type !== 'module'); big.edges = big.edges.filter(e => e.source !== 'instance' && e.target !== 'instance');
  for (let i = 0; i < 8; i++) { big.nodes.push(node(`m${i}`, 'module', { definition: base })); big.edges.push(edge('event0', `m${i}`, 'out', 'in1'), edge(`m${i}`, 'context', 'out1', 'in1')); }
  assert.throws(() => validateGraph(big), /256/);
  many.nodes.push(node('extra', 'prompt', { text: '' })); assert.throws(() => validateModuleDefinition(many), /64/);
});

test('runtime carries actual blocks through exact ports and does not execute parent tools again', async () => {
  for (const visual of [true, false]) {
    let modelCalls = 0;
    const result = await executeFlow(graph(definition(), visual), { event, sources: { important_notes: ['Owner note'] }, runModel: async packet => {
      modelCalls++; assert.deepEqual(packet.parts.important_notes, ['Owner note']);
      assert(packet.blocks.some(b => b.id === 'instance__source' && b.value[0] === 'Owner note'));
      if (visual) assert.deepEqual(packet.bundle.entries[0].value, ['Owner note']);
      return { ok: true, reply: 'Main answer' };
    } });
    assert.equal(modelCalls, 1); assert.equal(result.answer.reply, 'Main answer');
    assert.equal(result.trace.filter(e => e.type === 'tools' && e.status === 'completed').length, 1);
    assert(result.trace.some(e => e.nodeId === 'instance__output' && e.status === 'completed'));
  }
});

test('nested model result becomes port data, keeps explicit config, and never publishes child answer', async () => {
  const d = definition([
    node('input', 'module_input', { port: 'in1' }), node('context', 'context'), node('serialize', 'serialize', { format: 'messages' }),
    node('model', 'model', { model: 'gpt-6-luna', reasoning: 'low', maxOutputTokens: 700 }), node('output', 'module_output', { port: 'out1' }),
  ], [edge('input', 'context'), edge('context', 'serialize'), edge('serialize', 'model'), edge('model', 'output')]);
  const calls = [], observed = [], executionIds = [];
  const result = await executeFlow(graph(d), { event, onEvent: e => observed.push(e), runModel: async (packet, config, execution) => {
    calls.push(config.model);
    executionIds.push([execution.nodeId, execution.modulePath, execution.localNodeId]);
    if (config.model !== 'preset') return { ok: true, reply: 'Child', command: { name: 'proposed' }, metadata: { promptCache: 'PRIVATE_COST_METADATA' }, raw: { redundant: true }, speechSegments: [{ text: 'Child' }] };
    assert.equal(packet.parts.instance__out1.reply, 'Child'); assert.equal(packet.bundle.entries[0].value.command.name, 'proposed');
    assert.deepEqual(packet.parts.instance__out1, { ok: true, reply: 'Child', command: { name: 'proposed' } });
    return { ok: true, reply: 'Main' };
  } });
  assert.deepEqual(calls, ['gpt-6-luna', 'preset']); assert.equal(result.answer.reply, 'Main'); assert.equal(result.packet.parts.instance__out1.reply, 'Child');
  assert.deepEqual(executionIds, [['instance__model', ['instance'], 'model'], ['model', [], 'model']]);
  assert(observed.some(e => e.nodeId === 'instance__model' && e.status === 'completed'));
});

test('branch and skipped propagation selects only the exact module output', async () => {
  const d = definition([
    node('input', 'module_input', { port: 'in1' }), node('gate', 'condition', { field: 'transcript', operator: 'equals', value: 'yes' }),
    node('yes', 'module_output', { port: 'yes' }), node('no', 'module_output', { port: 'no' }),
  ], [edge('input', 'gate'), edge('gate', 'yes', 'true'), edge('gate', 'no', 'false')]);
  d.outputs = [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }];
  const g = graph(d); const out = g.edges.find(e => e.source === 'instance'); out.sourceHandle = 'yes';
  for (const transcript of ['yes', 'no']) {
    const session = new FlowExecutionSession(g, { event: { ...event, transcript } });
    if (transcript === 'yes') { await session.runAll(); assert(session.values.get('instance').outputs.yes); assert(!session.values.get('instance').outputs.no); }
    else { await assert.rejects(session.runAll(), /не завершил/); assert.equal(session.values.has('model'), false); }
  }
});

test('isolated nested invocations, shared callbacks/signal, failures visible and no retries', async () => {
  const inner = definition();
  const d = definition([node('input', 'module_input', { port: 'in1' }), node('inner', 'module', { definition: inner }), node('output', 'module_output', { port: 'out1' })], [edge('input', 'inner', 'out', 'in1'), edge('inner', 'output', 'out1')]);
  const results = await Promise.all(['A', 'B'].map(owner => executeFlow(graph(d), { event, sources: { important_notes: [owner] } })));
  assert.deepEqual(results.map(r => r.packet.parts.important_notes), [['A'], ['B']]);
  assert(results[0].trace.some(e => e.nodeId === 'instance__inner__source'));
  const seen = [];
  await assert.rejects(executeFlow(graph(), { event, onEvent: e => { seen.push(e); if (e.nodeId === 'instance__source' && e.status === 'running') throw Error('callback failed'); } }), /callback failed/);
  assert(seen.some(e => e.nodeId === 'instance__source' && e.status === 'failed')); assert(!seen.some(e => e.nodeId === 'model'));
  const controller = new AbortController(), trace = [];
  await assert.rejects(executeFlow(graph(), { event, signal: controller.signal, onEvent: e => { trace.push(e); if (e.nodeId === 'instance__source' && e.status === 'running') controller.abort(Error('cancel child')); } }), /cancel child/);
  assert(trace.some(e => e.nodeId === 'instance__source' && e.status === 'failed'));
  assert(!trace.some(e => e.nodeId === 'model'));
  const dataEvents = [];
  await assert.rejects(executeFlow(graph(), { event, onData: async e => { dataEvents.push(e); if (e.nodeId === 'instance__source' && e.status === 'completed') throw Error('async callback failed'); } }), /async callback failed/);
  assert(dataEvents.some(e => e.nodeId === 'instance__source' && e.status === 'failed'));
  assert(!dataEvents.some(e => e.nodeId === 'model'));
});

test('tools loop strict bounded policy survives flowSettings without changing old graph shape', () => {
  const g = defaultFlow(), policy = g.nodes.find(n => n.type === 'tools').data;
  policy.loop = { timeoutMs: 1000, maxRepeatedCommand: 2, maxCostUsd: 0.001 };
  assert.deepEqual(flowSettings(g).policy.loop, policy.loop);
  for (const bad of [{ timeoutMs: 999, maxRepeatedCommand: 2 }, { timeoutMs: 1000, maxRepeatedCommand: 1 }, { timeoutMs: 1000, maxRepeatedCommand: 4 }, { timeoutMs: 1000, maxRepeatedCommand: 2, maxCostUsd: 0 }, { timeoutMs: 1000, maxRepeatedCommand: 2, path: 'evil' }]) {
    policy.loop = bad; assert.throws(() => validateGraph(g));
  }
});

test('parent condition metadata stops at module input, while inactive ports remain skipped', async () => {
  const d = definition([node('input', 'module_input', { port: 'in1' }), node('output', 'module_output', { port: 'out1' })], [edge('input', 'output')]);
  const g = graph(d);
  g.nodes.push(node('gate', 'condition', { field: 'transcript', operator: 'equals', value: 'Hello' }));
  g.edges = g.edges.filter(e => e.target !== 'instance');
  g.edges.push(...[0, 1, 2].map(i => edge(`event${i}`, 'gate')), edge('gate', 'instance', 'true', 'in1'), edge('gate', 'context', 'false', 'in1'));
  for (const transcript of ['Hello', 'No']) {
    const result = await executeFlow(g, { event: { ...event, transcript } });
    assert.equal(result.answer.ok, true);
    assert.equal(result.trace.some(e => e.nodeId === 'instance__output' && e.status === 'completed'), transcript === 'Hello');
  }
});

test('modules execute inside the actual LangGraph scheduler with identical packets and model metadata', async () => {
  const { FlowExecutionService } = await import('../../tools/tutor-gateway/src/flows/runtime/FlowExecutionService.mjs');
  const service = new FlowExecutionService(), results = [];
  for (const engine of ['native', 'langgraph']) {
    const calls = [];
    const result = await service.execute({ ...graph(), engine }, { event, sources: { important_notes: ['Same'] }, runModel: async (_packet, _settings, execution) => {
      calls.push(execution.nodeId); return { ok: true, reply: 'Same' };
    } });
    assert.deepEqual(calls, ['model']);
    assert(result.trace.some(e => e.nodeId === 'instance__source' && e.status === 'completed'));
    results.push(result.packet);
  }
  assert.deepEqual(results[0], results[1]);
});

test('sibling model outputs keep distinct source keys through context refresh and serialization', async () => {
  const { modelContextBlocks } = await import('./assembly.mjs');
  const d = definition([
    node('input', 'module_input', { port: 'in1' }), node('context', 'context'), node('model', 'model', { model: 'gpt-6-luna', reasoning: 'low', maxOutputTokens: 700 }), node('output', 'module_output', { port: 'out1' }),
  ], [edge('input', 'context'), edge('context', 'model'), edge('model', 'output')]);
  const g = graph(d); g.nodes.push(node('instance2', 'module', { definition: d }));
  g.edges.push(edge('event0', 'instance2', 'out', 'in1'), edge('instance2', 'context', 'out1', 'in2'));
  await executeFlow(g, { event, runModel: async (packet, config, execution) => {
    if (config.model !== 'preset') return { ok: true, reply: execution.modulePath[0] };
    const blocks = modelContextBlocks(packet).filter(b => b.kind === 'source');
    assert.deepEqual(blocks.map(b => b.value.reply), ['instance', 'instance2']);
    assert.deepEqual(Object.keys(packet.parts), ['instance__out1', 'instance2__out1']);
    return { ok: true, reply: 'Main' };
  } });
});
