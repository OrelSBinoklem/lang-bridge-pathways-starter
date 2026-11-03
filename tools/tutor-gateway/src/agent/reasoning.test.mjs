import test from 'node:test';
import assert from 'node:assert/strict';
import { reasoningProfile, reasoningRequest, resolveTutorTurnConfig } from './reasoning.mjs';
import { respondToTutorTurn } from './tutorAgent.mjs';
import { resolveClientPresetConfig } from '../presets.mjs';

test('global preset cap lowers output without changing ordinary or complex reasoning defaults', () => {
  const ordinary = { tutorModel: 'gpt-6.1-terra', reasoningEnabled: false, reasoningEffort: 'none' };
  assert.equal(reasoningRequest(ordinary, ordinary.tutorModel).maxOutputTokens, 700);
  assert.equal(reasoningRequest({ ...ordinary, maxOutputTokens: 8192 }, ordinary.tutorModel).maxOutputTokens, 700);
  const complex = resolveTutorTurnConfig({ ...ordinary, maxOutputTokens: 2400 }, 'complex');
  assert.equal(reasoningRequest(complex, ordinary.tutorModel).maxOutputTokens, 2400);
  const thinking = { tutorModel: 'gpt-6-luna', reasoningEnabled: true, reasoningEffort: 'low' };
  assert.equal(reasoningRequest(thinking, thinking.tutorModel).maxOutputTokens, 8192);
  assert.equal(reasoningRequest({ ...thinking, maxOutputTokens: 1800 }, thinking.tutorModel).maxOutputTokens, 1800);
});

test('complex turn preserves model, voice and ordinary settings without mutation', () => {
  const base = Object.freeze({ tutorModel: 'gpt-5.4', ttsVoice: 'onyx', reasoningEnabled: false, reasoningEffort: 'none' });
  const complex = resolveTutorTurnConfig(base, 'complex');
  assert.equal(complex.tutorModel, base.tutorModel);
  assert.equal(complex.ttsVoice, base.ttsVoice);
  assert.equal(complex.reasoningEffort, 'high');
  assert.equal(complex.reasoningBaseEffort, 'none');
  assert.equal(resolveTutorTurnConfig(base).reasoningEffort, 'none');
  assert.equal(base.reasoningEnabled, false);
});

test('all catalog reasoning models and dated snapshots map complex requests to high', () => {
  for (const model of ['gpt-6.1-terra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-6.1-sol', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'o3', 'o4-mini', 'gpt-5.4-2026-03-05']) {
    assert.equal(resolveTutorTurnConfig({ tutorModel: model }, 'complex').reasoningEffort, 'high');
  }
});

test('unsupported and unknown models reject complex mode before any model request', () => {
  for (const model of ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'unverified-model']) {
    assert.equal(reasoningProfile(model).high, null);
    assert.throws(() => resolveTutorTurnConfig({ tutorModel: model }, 'complex'), /не поддерживает/);
    assert.equal(reasoningRequest(resolveTutorTurnConfig({ tutorModel: model }), model).reasoning, undefined);
  }
});

test('none and incompatible efforts normalize to the model supported minimum', () => {
  assert.equal(resolveTutorTurnConfig({ tutorModel: 'gpt-6.1-sol', reasoningEnabled: false }).reasoningEffort, 'low');
  assert.equal(resolveTutorTurnConfig({ tutorModel: 'o3', reasoningEffort: 'xhigh' }).reasoningEffort, 'low');
  assert.equal(reasoningRequest(resolveTutorTurnConfig({ tutorModel: 'gpt-6.1-sol' }), 'gpt-6.1-sol').maxOutputTokens, 8192);
});

test('GPT-6.1 uses a late configuration update and keeps baseline effort intact', () => {
  const config = resolveTutorTurnConfig({ tutorModel: 'gpt-6.1-sol', reasoningEnabled: false }, 'complex');
  const result = reasoningRequest(config, config.tutorModel);
  assert.deepEqual(result.reasoning, { effort: 'low' });
  assert.deepEqual(result.update, { type: 'configuration_update', reasoning: { effort: 'high' } });
  assert.equal(reasoningRequest(resolveTutorTurnConfig({ tutorModel: 'gpt-6.1-sol' }), 'gpt-6.1-sol').update, null);
});

test('model requests preserve prompt/cache key and history; high has room for reasoning', async (t) => {
  const key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only-not-a-real-key';
  t.after(() => { if (key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = key; });
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"reply":"Atbilde","command":null}' }] }], usage: { input_tokens: 2000, input_tokens_details: { cached_tokens: 1024 } } }) };
  });
  const context = { transcript: 'A question', recentContext: ['user: previous question', 'assistant: previous answer'] };
  for (const model of ['gpt-5.4', 'gpt-6-sol', 'gpt-6.1-sol', 'gpt-6.1-terra']) {
    const base = { tutorModel: model, reasoningEnabled: false, reasoningEffort: 'none' };
    for (const mode of [undefined, 'complex', undefined]) await respondToTutorTurn({ ...context, config: resolveTutorTurnConfig(base, mode) });
    const [normal, complex, restored] = requests.slice(-3);
    assert.equal(normal.model, complex.model);
    assert.equal(normal.prompt_cache_key, complex.prompt_cache_key);
    assert.deepEqual(normal.input.slice(0, 2), complex.input.slice(0, 2));
    assert.deepEqual(normal.input.at(-1), complex.input.at(-1));
    assert.deepEqual(normal, restored);
    assert.equal(complex.max_output_tokens, 8192);
    assert.equal(model === 'gpt-6.1-sol' ? complex.input[2].reasoning.effort : complex.reasoning.effort, 'high');
    if (model === 'gpt-6-sol' || model === 'gpt-6.1-terra') assert.deepEqual(normal.reasoning, { effort: 'none' });
  }
});

test('maximum preset uses GPT-6 Sol none and enables high only for the complex turn', () => {
  const request = Object.freeze({ preset: 'uncompromising', tutorModel: 'forged', reasoningEnabled: true, reasoningEffort: 'max' });
  const preset = resolveClientPresetConfig(request, false);
  for (const mode of [undefined, 'complex', undefined]) {
    const config = resolveTutorTurnConfig(preset, mode);
    assert.equal(config.tutorModel, 'gpt-6-sol');
    assert.equal(config.reasoningEnabled, mode === 'complex');
    assert.equal(config.reasoningEffort, mode === 'complex' ? 'high' : 'none');
    assert.deepEqual(reasoningRequest(config, config.tutorModel).reasoning, { effort: mode === 'complex' ? 'high' : 'none' });
  }
  assert.equal(preset.reasoningEnabled, false); assert.equal(preset.reasoningEffort, 'none');
});

test('incomplete reasoning response is reported, not replaced with a fake success', async (t) => {
  const key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only-not-a-real-key';
  t.after(() => { if (key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = key; });
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] }) }));
  const result = await respondToTutorTurn({ transcript: 'question', config: resolveTutorTurnConfig({ tutorModel: 'gpt-5.4' }, 'complex') });
  assert.equal(result.ok, false);
  assert.equal(result.metadata.error.reason, 'max_output_tokens');
});
