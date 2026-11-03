import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultFlow, executeFlow } from '../../../../resources/tutor-flow/graph.mjs';
import { assembleContext, defaultContextInputs, modelContextBlocks, modelContextByteLength, serializeContext } from '../../../../resources/tutor-flow/assembly.mjs';
import { defaultNodeStrategies } from '../../../../resources/tutor-flow/node-strategies.mjs';
import { stateEvent } from '../../../../resources/tutor-flow/journal.mjs';
import { orderedPrompt } from '../context/orderedPrompt.mjs';

const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
const oversized = /Контекст превышает 240 КБ/;
const transcript = 'Начать практику: відповідаю зараз';
const event = { type: 'user.message', transcript };
const delta = stateEvent([{ path: 'task.completed', value: true }]);
const sources = size => ({
  context_summary: 'Existing summary',
  parameter_state: { task: { completed: false }, page: '/grammar' },
  message_stream: [
    { id: 1, role: 'user', text: 'Show this grammar table' },
    { id: 2, role: 'tool', text: JSON.stringify({ command: 'grammar.table.highlight', result: { documentation: 'x'.repeat(size), matched: 1 } }) },
    { id: 3, role: 'assistant', text: 'Table highlighted' },
    { id: 4, ...delta },
    { id: 5, role: 'user', text: transcript },
  ],
});

function packetFor(value, { mode = 'object', event: inputEvent = event, child = null } = {}) {
  const node = { id: 'context', type: 'context', data: { mode, inputs: defaultContextInputs() } };
  const source = { parts: { message_stream: value }, blocks: [{ id: 'journal', kind: 'source', source: 'message_stream', value }] };
  const links = [{ edge: { targetHandle: 'in4' }, value: child || source }];
  return { node, links, packet: assembleContext(node, links, inputEvent) };
}

test('a tool-heavy journal passes despite mirrored service views, preserving history, delta, current turn and graph settings', async () => {
  const graph = defaultFlow(), input = sources(50000), originalGraph = structuredClone(graph), originalInput = structuredClone(input);
  let calls = 0;
  const { packet } = await executeFlow(graph, { event, sources: input, runModel: async incoming => {
    calls++;
    assert.deepEqual(incoming.parts.message_stream, input.message_stream);
    assert.deepEqual(incoming.parts.parameter_state, input.parameter_state);
    assert.equal(incoming.transcript, transcript);
    return { ok: true, reply: 'Ready', command: null };
  } });
  assert.equal(calls, 1);
  assert(bytes(packet) > 240000);
  assert(modelContextByteLength(packet) < 60000);
  assert.deepEqual(input, originalInput);
  assert.deepEqual(graph, originalGraph);
  assert.deepEqual(packet.parts.message_stream.find(message => message.id === 4), { id: 4, ...delta });
  assert.equal(packet.parts.message_stream.at(-1).text, transcript);
});

test('all merge modes and serializer formats measure the same messages actually rendered for the model', async () => {
  for (const mode of ['object', 'text', 'json']) for (const format of ['messages', 'text', 'json']) {
    const graph = defaultFlow();
    graph.nodes.find(node => node.type === 'context').data.mode = mode;
    graph.nodes.find(node => node.type === 'serialize').data.format = format;
    const input = sources(50000), toolResult = { ok: true, matched: 1 };
    const { packet } = await executeFlow(graph, { event: { ...event, toolResult }, sources: input });
    const original = structuredClone(packet);
    const request = { transcript, transcript_candidates: [], transcription_strategy: null, toolResult };
    const actual = orderedPrompt({ developers: [], model: 'gpt-4.1-mini', blocks: modelContextBlocks(packet), request, responseFormat: {} }).input.slice(1);
    assert.equal(modelContextByteLength(packet), bytes(actual), `${mode}/${format}`);
    assert(modelContextByteLength(packet) < 240000);
    assert(JSON.stringify(actual).includes('task.completed'));
    assert(JSON.stringify(actual).includes('current_request'));
    assert.deepEqual(packet, original);
  }
});

test('nested assembly views do not multiply an object journal that the model receives once', () => {
  const stream = sources(50000).message_stream;
  const child = packetFor(stream).packet;
  const { node, links, packet } = packetFor(stream, { child });
  assert(bytes(packet) > 400000);
  assert(modelContextByteLength(packet) < 60000);
  assert.doesNotThrow(() => defaultNodeStrategies.execute(node, { activeInputs: () => links, event }, []));
  assert.deepEqual(modelContextBlocks(packet).find(block => block.source === 'message_stream').value, stream);
});

test('current request and previous tool result are counted even with no source data', () => {
  const huge = { type: 'user.message', transcript: 'Ж'.repeat(120000) };
  for (const inputEvent of [huge, { ...event, toolResult: { ok: true, text: huge.transcript } }]) {
    const { node } = packetFor([]);
    assert.throws(() => defaultNodeStrategies.execute(node, { activeInputs: () => [], event: inputEvent }, []), oversized);
  }
});

test('real oversized model content is rejected in every merge mode before calling a model', () => {
  for (const mode of ['object', 'text', 'json']) {
    const { node, links } = packetFor([{ role: 'tool', text: 'Ж'.repeat(125000) }], { mode });
    assert.throws(() => defaultNodeStrategies.execute(node, { activeInputs: () => links, event }, []), oversized);
  }
});

test('serialization expansion is checked again and cannot bypass the limit at the model boundary', async () => {
  // A journal's quote characters are plain message content in object mode, but must be escaped in serialized JSON.
  const { packet } = packetFor([{ role: 'user', text: '"'.repeat(70000) }]);
  assert(modelContextByteLength(packet) < 240000);
  const serialized = { ...packet, serialization: serializeContext(packet, 'json') };
  assert(modelContextByteLength(serialized) > 240000);
  assert.throws(() => defaultNodeStrategies.execute({ type: 'serialize', data: { format: 'json' } }, {}, [packet]), oversized);
  let called = false;
  await assert.rejects(defaultNodeStrategies.execute({ type: 'model', data: {} }, { runModel: () => { called = true; } }, [serialized]), oversized);
  assert.equal(called, false);
});

test('the exact 240000-byte UTF-8 boundary is retained', () => {
  const make = count => packetFor([{ role: 'user', text: 'x'.repeat(count) }]);
  const overhead = modelContextByteLength(make(0).packet);
  const within = make(240000 - overhead), above = make(240001 - overhead);
  assert.equal(modelContextByteLength(within.packet), 240000);
  assert.equal(modelContextByteLength(above.packet), 240001);
  assert.doesNotThrow(() => defaultNodeStrategies.execute(within.node, { activeInputs: () => within.links, event }, []));
  assert.throws(() => defaultNodeStrategies.execute(above.node, { activeInputs: () => above.links, event }, []), oversized);
});
