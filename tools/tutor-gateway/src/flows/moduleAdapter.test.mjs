import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultFlow, defaultContextInputs, createModuleDefinition } from '../../../../resources/tutor-flow/graph.mjs';
import { respondToTutorTurn } from '../agent/tutorAgent.mjs';

test('internal helper uses its own model/cap and namespaced request, returning data to the real main adapter', async t => {
  const key = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'fixture-only';
  t.after(() => { if (key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = key; });
  const requests = [], traces = [], speech = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    requests.push(JSON.parse(init.body));
    const payload = { status: 'completed', output_text: JSON.stringify({ reply: requests.length === 1 ? 'HELPER_EVIDENCE' : 'MAIN_FINAL', command: null }), usage: { input_tokens: 100, output_tokens: 20 } };
    return requests.at(-1).stream ? new Response(`data: ${JSON.stringify({ type: 'response.completed', response: payload })}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } }) : Response.json(payload);
  });
  const graph = defaultFlow(), definition = createModuleDefinition({ id: 'helper', name: 'Internal helper' });
  definition.nodes = [definition.nodes[0],
    { id: 'prompt', type: 'prompt', position: { x: 300, y: 0 }, data: { text: 'Find the specific evidence in the connected source.' } },
    { id: 'context', type: 'context', position: { x: 600, y: 0 }, data: { inputs: defaultContextInputs(), order: ['in1', '$request'] } },
    { id: 'model', type: 'model', position: { x: 1000, y: 0 }, data: { model: 'gpt-5.4-mini', reasoning: 'medium', maxOutputTokens: 1200 } }, definition.nodes.at(-1)];
  const wire = (id, source, target, targetHandle = 'in', sourceHandle = 'out') => ({ id, source, target, targetHandle, sourceHandle });
  definition.edges = [wire('input_prompt', 'input_1', 'prompt'), wire('prompt_context', 'prompt', 'context', 'in1'), wire('context_model', 'context', 'model'), wire('model_output', 'model', 'output_1')];
  graph.nodes.push({ id: 'helper_call', type: 'module', position: { x: 1200, y: 900 }, data: { definition } });
  graph.edges.push(wire('gate_helper', 'count_gate', 'helper_call', 'in1', 'false'), wire('compact_helper', 'compact', 'helper_call', 'in1'), wire('helper_context', 'helper_call', 'context', 'in5', 'out1'));
  const result = await respondToTutorTurn({ transcript: 'Find the answer', flow: { graph, version_id: 1 }, config: { tutorModel: 'gpt-6-luna', reasoningEnabled: false, contextMode: 'full', maxOutputTokens: 8192 },
    messageStream: [{ role: 'user', text: 'Find the answer' }], onFlowData: event => traces.push(event), onSpeechPrefix: part => speech.push(part) });
  assert.equal(result.reply, 'MAIN_FINAL'); assert.equal(requests.length, 2);
  assert.equal(requests[0].model, 'gpt-5.4-mini'); assert.equal(requests[0].reasoning.effort, 'medium'); assert.equal(requests[0].max_output_tokens, 1200);
  assert.equal(requests[1].model, 'gpt-6-luna'); assert(JSON.stringify(requests[1].input).includes('HELPER_EVIDENCE'));
  assert(!JSON.stringify(requests[1].input).includes('cached_input_percent'));
  assert.equal(requests[0].stream, undefined); assert.equal(requests[1].stream, true);
  assert(traces.some(event => event.type === 'model_request' && event.nodeId === 'helper_call__model'));
  assert(traces.some(event => event.type === 'model_request' && event.nodeId === 'model'));
});
