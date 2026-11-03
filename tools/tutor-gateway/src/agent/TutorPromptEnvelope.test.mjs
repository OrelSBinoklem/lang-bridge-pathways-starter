import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTutorRules } from './TutorRulesBuilder.mjs';
import { tutorPromptManifest, TUTOR_RESPONSE_FORMAT } from './TutorPromptEnvelope.mjs';
import { buildTutorModelRequest, respondToTutorTurn } from './tutorAgent.mjs';
import { createFlowTestRunner } from '../flows/FlowTestRunner.mjs';
import { defaultFlow, flowSettings } from '../../../../resources/tutor-flow/graph.mjs';

const configuration = { tutorModel: 'gpt-4.1-mini', reasoningEnabled: false, contextMode: 'full' };
test('inspection prefix is byte-for-byte identical to the request actually passed to fetch in both context modes', async t => {
  const key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'fixture-only';
  t.after(() => { if (key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = key; });
  const bodies = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return Response.json({ status: 'completed', output_text: JSON.stringify({ reply: 'Sveiki!', command: null }) });
  });
  for (const mode of ['full', 'basic']) {
    const config = { ...configuration, contextMode: mode, longMemoryEnabled: false };
    const settings = flowSettings(defaultFlow(), config);
    const manifest = tutorPromptManifest(config, settings.policy);
    await respondToTutorTurn({ transcript: 'Sveiki!', config, flow: { graph: defaultFlow() }, messageStream: [{ role: 'user', text: 'Sveiki!' }] });
    assert.deepEqual(bodies.at(-1).input.slice(0, 4).map(message => typeof message.content === 'string' ? message.content : message.content[0].text), manifest.sections.map(section => section.text));
    assert(manifest.sections[0].text.startsWith(buildTutorRules({ basic: mode === 'basic' })));
    assert(manifest.sections[0].text.includes('Поиск в старых беседах'));
    assert(manifest.sections[0].characters > 10000);
  }
});

test('inspection enforces admin authorization, exposes no secret config, and never calls a model', async () => {
  const sent = [];
  let admin = false, calls = 0;
  const runner = createFlowTestRunner({ send: value => sent.push(value), respond: () => { throw Error('Model must not be called'); },
    authorize: () => admin, resolveConfig: async () => { calls++; return { ...configuration, apiKey: 'PRIVATE_SECRET' }; } });
  const request = { requestId: 'inspection-1', preset: 'standard', graph: defaultFlow() };
  await runner.inspectPrompt(request);
  assert.equal(sent.at(-1).ok, false); assert.equal(calls, 0);
  admin = true;
  await runner.inspectPrompt(request);
  assert.equal(sent.at(-1).ok, true);
  assert.equal(sent.at(-1).data.sections.length, 4);
  assert(!JSON.stringify(sent).includes('PRIVATE_SECRET'));
  assert.deepEqual(sent.at(-1).data.responseFormat, TUTOR_RESPONSE_FORMAT);
});

test('free graph test assembles the whole model request with zero provider calls and simulated compaction', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('No network providers in a free test'); });
  const sent = [];
  const runner = createFlowTestRunner({ send: value => sent.push(value), respond: () => { throw Error('Paid responder must not be called'); },
    authorize: () => true, resolveConfig: async () => configuration });
  await runner.run({ graph: defaultFlow(), preset: 'standard', event: { type: 'user.message', transcript: 'CURRENT_TURN' },
    sources: { message_stream: [...Array.from({ length: 21 }, () => [{ role: 'user', text: 'old' }, { role: 'assistant', text: 'answer' }]).flat(), { role: 'user', text: 'CURRENT_TURN' }], parameter_state: {} }, live: false });
  assert(!sent.at(-1).error, sent.at(-1).error);
  const preview = sent.flatMap(message => message.events || []).find(event => event.type === 'model_request_preview');
  assert(preview);
  const body = JSON.parse(preview.inputPreview);
  assert(JSON.stringify(body.input).includes('CURRENT_TURN'));
  assert(JSON.stringify(body.input).includes('здесь будет резюме'));
  assert.equal(body.model, configuration.tutorModel);
  assert.equal(sent.at(-1).dryRun, true);
  assert.equal(sent.at(-1).usage, null);
  const pure = buildTutorModelRequest({ transcript: 'PURE', config: configuration });
  assert(JSON.stringify(pure.body.input).includes('PURE'));
});
