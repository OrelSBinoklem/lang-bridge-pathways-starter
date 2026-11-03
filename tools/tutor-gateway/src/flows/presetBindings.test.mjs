import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultFlow } from '../../../../resources/tutor-flow/graph.mjs';
import { resolveClientPresetConfig } from '../presets.mjs';
import { respondToTutorTurn } from '../agent/tutorAgent.mjs';
import { createFlowTestRunner } from './flowTestRunner.mjs';

const catalog = () => ({
  economy: { tutorModel: 'gpt-6-luna', reasoningEnabled: true, reasoningEffort: 'low', maxOutputTokens: 1800 },
  standard: { tutorModel: 'gpt-5.4-mini', reasoningEnabled: true, reasoningEffort: 'medium', maxOutputTokens: 3000 },
  uncompromising: { tutorModel: 'gpt-6.1-terra', reasoningEnabled: false, reasoningEffort: 'none', maxOutputTokens: 8192 },
});
function provider(t) {
  const key = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'fixture-only';
  t.after(() => { if (key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = key; });
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ status: 'completed', output_text: '{"reply":"Sveiki!","command":null}', usage: { input_tokens: 100, output_tokens: 10 } }) };
  });
  return requests;
}

test('preset bindings resolve each saved tariff in the real provider body; only selected global edits change it', async t => {
  const requests = provider(t), presets = catalog(), graph = defaultFlow();
  for (const id of ['economy', 'standard', 'uncompromising']) {
    const config = resolveClientPresetConfig({ preset: id, tutorModel: 'FORGED', maxOutputTokens: 8192 }, false, presets);
    const result = await respondToTutorTurn({ transcript: 'Labdien!', config, flow: { graph, version_id: 6 } });
    assert.equal(result.metadata.flow.preset, id); assert.equal(result.metadata.usage.output_tokens, 10);
  }
  assert.deepEqual(requests.map(r => r.model), ['gpt-6-luna', 'gpt-5.4-mini', 'gpt-6.1-terra']);
  assert.deepEqual(requests.map(r => r.max_output_tokens), [1800, 3000, 700]);
  assert.deepEqual(requests.map(r => r.reasoning.effort), ['low', 'medium', 'none']);
  presets.economy = { ...presets.economy, tutorModel: 'gpt-5.4-mini', reasoningEffort: 'medium', maxOutputTokens: 2200 };
  for (const id of ['economy', 'standard']) await respondToTutorTurn({ transcript: 'Labdien!', config: resolveClientPresetConfig({ preset: id }, false, presets), flow: { graph } });
  assert.equal(requests[3].model, 'gpt-5.4-mini'); assert.equal(requests[3].max_output_tokens, 2200);
  assert.equal(requests[4].model, requests[1].model); assert.equal(requests[4].max_output_tokens, requests[1].max_output_tokens);
});

test('an explicit node cap remains a guard over global tariff variables', async t => {
  const requests = provider(t), graph = defaultFlow(); graph.nodes.find(n => n.type === 'model').data.maxOutputTokens = 1200;
  const config = resolveClientPresetConfig({ preset: 'economy' }, false, catalog());
  await respondToTutorTurn({ transcript: 'Hello', config, flow: { graph } });
  assert.equal(requests[0].max_output_tokens, 1200);
});

test('studio forwards selected tariff to the server resolver and preserves standard for old clients', async () => {
  const selected = [], seen = [], events = [], presets = catalog();
  const runner = createFlowTestRunner({ authorize: () => true, send: e => events.push(e),
    resolveConfig: async id => { selected.push(id); return resolveClientPresetConfig({ preset: id }, true, presets); },
    respond: async args => { seen.push(args.config); return { ok: true, reply: 'Mock provider result' }; } });
  for (const preset of ['economy', 'standard', 'uncompromising', undefined]) {
    await runner.run({ graph: defaultFlow(), preset, live: true, event: { type: 'user.message', transcript: 'Hello' }, sources: {} });
    assert(!events.at(-1).error); assert.equal(events.at(-1).preset, preset || 'standard');
  }
  assert.deepEqual(selected, ['economy', 'standard', 'uncompromising', 'standard']);
  assert.deepEqual(seen.map(c => c.tutorModel), ['gpt-6-luna', 'gpt-5.4-mini', 'gpt-6.1-terra', 'gpt-5.4-mini']);
  const count = seen.length;
  await runner.run({ graph: defaultFlow(), preset: 'forged', live: true, event: { type: 'user.message', transcript: 'Hello' }, sources: {} });
  assert(events.at(-1).error.includes('тариф')); assert.equal(seen.length, count);
});

test('live studio respects disabled global compaction just like the ordinary tutor', async () => {
  const events = [];
  const runner = createFlowTestRunner({ authorize: () => true, send: e => events.push(e),
    resolveConfig: async () => ({ ...catalog().economy, contextCompressionEnabled: false }),
    respond: args => args.runFlowCompact({ keepPairs: 5 }, { parts: {} }) });
  await runner.run({ graph: defaultFlow(), preset: 'economy', live: true, event: { type: 'user.message', transcript: 'Hello' }, sources: {} });
  assert(events.at(-1).error.includes('Сжатие выключено'));
});
