import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const catalog = JSON.parse(await readFile(new URL('../../config/tutor-tts.json', import.meta.url), 'utf8'));
const source = (await readFile(new URL('./tutorTts.ts', import.meta.url), 'utf8'))
  .replace("import catalog from '../../config/tutor-tts.json';", `const catalog = ${JSON.stringify(catalog)};`);
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { tutorTtsModel, tutorTtsVoice, tutorRequestConfig, geminiTtsPrice, tutorTtsPromotionNote, compactTutorEventForLog } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('shared catalog defaults to Flash with 30 voices and retains Flash-Lite and all four OpenAI models', () => {
  assert.equal(catalog.defaultModel, 'gemini-3.8-flash-tts');
  assert.equal(catalog.defaultVoice, 'Enceladus');
  assert.equal(tutorTtsModel(catalog.defaultModel).voices.length, 30);
  assert.deepEqual(tutorTtsModel('gemini-3.8-flash-lite-tts').voices, tutorTtsModel(catalog.defaultModel).voices);
  assert.equal(tutorTtsModel('gemini-3.8-flash-tts').id, 'gemini-3.8-flash-tts');
  assert.deepEqual(catalog.models.filter(model => model.provider === 'openai').map(model => model.id),
    ['gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15', 'tts-1', 'tts-1-hd']);
  assert.equal(tutorTtsVoice(catalog.defaultModel, 'onyx'), 'Enceladus');
  assert.equal(tutorTtsVoice('gpt-4o-mini-tts', 'Enceladus'), 'onyx');
  assert.equal(tutorTtsVoice(catalog.defaultModel, 'Kore'), 'Kore');
  assert.equal(tutorTtsVoice('tts-1', 'marin'), 'nova');
});

test('TTS fields are always sent; unrelated overrides are gated by test mode', () => {
  const config = { ttsModel: catalog.defaultModel, ttsVoice: 'Enceladus', ttsStartMode: 'first_sentence', tutorModel: 'test', reasoningEnabled: true };
  assert.deepEqual(tutorRequestConfig(config, false), { ttsModel: config.ttsModel, ttsVoice: config.ttsVoice, ttsStartMode: config.ttsStartMode });
  assert.deepEqual(tutorRequestConfig(config, true), config);
});

test('Gemini cost changes exactly at the 2027 UTC boundary', () => {
  assert.deepEqual(geminiTtsPrice(Date.UTC(2027, 0, 1) - 1), { input: 0.5, outputAudio: 9 });
  assert.deepEqual(geminiTtsPrice(Date.UTC(2027, 0, 1)), { input: 1, outputAudio: 18 });
  assert.deepEqual(geminiTtsPrice(Date.UTC(2027, 0, 1) - 1, 'gemini-3.8-flash-lite-tts'), { input: 0.5, outputAudio: 6 });
  assert.deepEqual(geminiTtsPrice(Date.UTC(2027, 0, 1), 'gemini-3.8-flash-lite-tts'), { input: 1, outputAudio: 12 });
});

test('calculator uses the selected Gemini tariff and leaves OpenAI rates available', async () => {
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
  const source = (await readFile(new URL('./tutor-config.ts', import.meta.url), 'utf8')).replace("from './tutorTts'", `from '${moduleUrl}'`);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { tutorTtsPrice } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  assert.deepEqual(tutorTtsPrice('gemini-3.8-flash-lite-tts', Date.UTC(2026, 9, 25)), { input: 0.5, outputAudio: 6 });
  assert.deepEqual(tutorTtsPrice('gemini-3.8-flash-tts', Date.UTC(2026, 9, 25)), { input: 0.5, outputAudio: 9 });
  assert.deepEqual(tutorTtsPrice('gemini-3.8-flash-lite-tts', Date.UTC(2027, 0, 1)), { input: 1, outputAudio: 12 });
  assert.equal(tutorTtsPrice('gpt-4o-mini-tts').outputAudio, 12);
});

test('promotion note states post-promotion prices and disappears after expiry', () => {
  const before = Date.UTC(2027, 0, 1) - 1;
  assert.ok(tutorTtsPromotionNote(catalog.defaultModel, before).includes('текст — $1, звук — $18'));
  assert.ok(tutorTtsPromotionNote('gemini-3.8-flash-lite-tts', before).includes('звук — $12'));
  assert.equal(tutorTtsPromotionNote(catalog.defaultModel, before + 1), null);
  assert.equal(tutorTtsPromotionNote('gpt-4o-mini-tts', before), null);
});

test('legacy and PCM audio never appear in debug logs, including malformed frames', () => {
  for (const type of ['tts.audio', 'tts.stream.chunk', 'tts.stream.start', 'tts.stream.end']) {
    const safe = compactTutorEventForLog(JSON.stringify({ type, audio: 'PRIVATE_AUDIO', streamId: 's', playbackId: 'p', sequence: 0 }));
    assert.ok(!safe.includes('PRIVATE_AUDIO'));
    assert.equal(JSON.parse(safe).playbackId, 'p');
  }
  assert.equal(compactTutorEventForLog('{"audio":"PRIVATE_AUDIO'), '[invalid tutor event]');
});
