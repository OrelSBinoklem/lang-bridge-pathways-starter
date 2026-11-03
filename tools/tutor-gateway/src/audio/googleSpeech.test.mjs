import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createGoogleAuth, readSpeechEvents, streamGoogleSpeech } from './googleSpeech.mjs';
import { resolveTtsConfig, ttsCatalog } from './ttsConfig.mjs';
import { streamSpeechToSocket } from './streamSpeech.mjs';

const pcm = Buffer.alloc(20000, 42);
const packet = { candidates: [{ content: { parts: [{ inlineData: { data: pcm.toString('base64'), mimeType: 'audio/L16;rate=24000' } }] } }] };
const done = { candidates: [{ finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 } };
const sse = events => new Response(events.map(e => `data: ${JSON.stringify(e)}\r\n\r\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
const auth = async () => ({ token: 'test-only', project: 'test-project' });
const run = (events, extra = {}) => streamGoogleSpeech({ text: 'Labdien!', authenticate: auth, fetchImpl: async () => sse(events), onChunk: () => {}, ...extra });

test('catalog separates providers and preserves old clients', () => {
  assert.equal(ttsCatalog.defaultModel, 'gemini-3.8-flash-tts');
  assert.equal(ttsCatalog.models[0].voices.length, 30);
  assert.deepEqual(resolveTtsConfig({}, {}), { model: 'gpt-4o-mini-tts', provider: 'openai', voice: 'onyx' });
  assert.equal(resolveTtsConfig({ ttsModel: ttsCatalog.defaultModel, ttsVoice: 'onyx' }, {}).voice, 'Enceladus');
  assert.equal(resolveTtsConfig({ ttsModel: 'tts-1', ttsVoice: 'Enceladus' }, {}).voice, 'nova');
  assert.throws(() => resolveTtsConfig({ ttsModel: 'unknown' }), /Unsupported/);
});

test('both Google selections reach their own streaming endpoint and socket metadata without fallback', async () => {
  for (const model of ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts']) {
    const events = [], urls = [];
    const ws = { OPEN: 1, readyState: 1, bufferedAmount: 0, send: value => events.push(JSON.parse(value)) };
    const ok = await streamSpeechToSocket({ ws, segment: { text: 'Labdien!' }, model, voice: 'Enceladus', playbackId: 'model-test',
      synthesize: options => streamGoogleSpeech({ ...options, authenticate: auth,
        fetchImpl: async url => { urls.push(url); return sse([packet, done]); } }) });
    assert.equal(ok, true);
    assert.equal(urls.length, 1);
    assert.ok(urls[0].endsWith(`/models/${model}:streamGenerateContent?alt=sse`));
    assert.equal(events[0].metadata.model, model);
    assert.equal(events.at(-1).metadata.model, model);
    assert.equal(events.at(-1).ok, true);
    assert.ok(events.some(event => event.type === 'tts.stream.chunk'));
  }
});

test('invalid or non-Google model is rejected before authentication or generation', async () => {
  for (const model of ['unknown', 'gpt-4o-mini-tts']) {
    await assert.rejects(run([], { model, authenticate: () => assert.fail('must not authenticate'), fetchImpl: () => assert.fail('must not generate') }), /Unsupported Google speech model/);
  }
});

test('SSE parser handles byte boundaries, CRLF, comments, multiline and EOF', async () => {
  const encoded = new TextEncoder().encode(': ping\r\ndata: {"text":\r\ndata: "\u0101\u0123"}\r\n\r\ndata: {"done":true}');
  let i = 0;
  const body = new ReadableStream({ pull(c) { if (i === encoded.length) c.close(); else c.enqueue(encoded.slice(i, ++i)); } });
  assert.deepEqual(await Array.fromAsync(readSpeechEvents(body)), [{ text: '\u0101\u0123' }, { done: true }]);
});

test('audio is delivered before stream completion and bounded in ordered sample chunks', async () => {
  let controller;
  const body = new ReadableStream({ start(c) { controller = c; c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(packet)}\n\n`)); } });
  const chunks = [];
  const result = await run([], { fetchImpl: async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.generationConfig.speechConfig.voiceConfig.voice, 'Enceladus');
    assert.equal(request.contents[0].parts[0].text, 'Labdien!');
    return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
  }, onChunk: chunk => {
    chunks.push(chunk);
    if (chunks.length === 3) { controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(done)}\n\n`)); controller.close(); }
  } });
  assert.deepEqual(chunks.map(c => c.sequence), [0, 1, 2]);
  assert.deepEqual(Buffer.concat(chunks.map(c => c.pcm)), pcm);
  assert.equal(chunks[0].pcm.length, 9600);
  assert.equal(result.sizeBytes, pcm.length);
  assert.deepEqual(result.usage, { inputTokens: 10, outputAudioTokens: 20 });
});

test('rejects malformed, refused, empty, truncated and wrong-rate streams without retry', async () => {
  await assert.rejects(run([packet]), /completion marker/);
  await assert.rejects(run([done]), /no audio/);
  await assert.rejects(run([{ error: { code: 429, message: 'private' } }]), /code 429/);
  await assert.rejects(run([{ promptFeedback: { blockReason: 'SAFETY' } }]), /blocked/);
  await assert.rejects(run([{ candidates: [{ finishReason: 'MAX_TOKENS' }] }]), /completing/);
  const wrong = structuredClone(packet);
  wrong.candidates[0].content.parts[0].inlineData.mimeType = 'audio/L16;rate=48000';
  await assert.rejects(run([wrong, done]), /unsupported PCM/);
  await assert.rejects(run([], { fetchImpl: async () => new Response('data: broken\n\n', { headers: { 'content-type': 'text/event-stream' } }) }), /Invalid Google speech stream event/);
  let requests = 0;
  await assert.rejects(run([], { fetchImpl: async () => { requests++; return new Response('private details', { status: 503 }); } }), /HTTP 503/);
  assert.equal(requests, 1);
});

test('abort stops PCM immediately and cancels blocked reader', async () => {
  const abort = new AbortController();
  let chunks = 0;
  await assert.rejects(run([packet, done], { signal: abort.signal, onChunk: () => { chunks++; abort.abort(); } }), { name: 'AbortError' });
  assert.equal(chunks, 1);
  let cancelled = false;
  const other = new AbortController();
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  const reading = Array.fromAsync(readSpeechEvents(body, other.signal));
  other.abort();
  await assert.rejects(reading, { name: 'AbortError' });
  assert.equal(cancelled, true);
});

test('deadline expiry stays a visible timeout, not a user cancellation', async () => {
  const signal = AbortSignal.abort(new DOMException('deadline', 'TimeoutError'));
  await assert.rejects(run([packet, done], { signal }), { name: 'TimeoutError' });
  const messages = [];
  const ws = { OPEN: 1, readyState: 1, bufferedAmount: 0, send: raw => messages.push(JSON.parse(raw)) };
  await streamSpeechToSocket({ ws, segment: { text: 'Labdien!' }, voice: 'Aoede', playbackId: 'timeout',
    signal: new AbortController().signal, synthesize: async () => { throw new DOMException('deadline', 'TimeoutError'); } });
  assert.equal(messages.at(-1).ok, false);
  assert.equal(messages.at(-1).cancelled, false);
  assert.equal(messages.at(-1).error.code, 'google_tts_failed');
});

test('OAuth refresh is shared, cached and renewed without exposing provider response', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  let time = 100000, calls = 0;
  const authenticate = createGoogleAuth({ env: { GOOGLE_APPLICATION_CREDENTIALS: 'fixture' }, now: () => time,
    read: async () => JSON.stringify({ type: 'service_account', private_key: privateKey, client_email: 'fixture@example.test', project_id: 'test-project' }),
    fetchImpl: async () => { calls++; return Response.json({ access_token: 'fixture-only', expires_in: 3600 }); } });
  const [a, b] = await Promise.all([authenticate(), authenticate()]);
  assert.deepEqual(a, b);
  await authenticate(); assert.equal(calls, 1);
  time += 3600000; await authenticate(); assert.equal(calls, 2);
  await assert.rejects(createGoogleAuth({ env: {} })(), /not configured/);
});

test('socket protocol, cancellation and backpressure never duplicate synthesis', async () => {
  const messages = [];
  const ws = { OPEN: 1, readyState: 1, bufferedAmount: 0, send: raw => messages.push(JSON.parse(raw)) };
  const options = { ws, segment: { text: 'Labdien!' }, voice: 'Enceladus', playbackId: 'turn1', streamId: 'segment1' };
  assert.equal(await streamSpeechToSocket({ ...options, synthesize: async ({ onChunk }) => { await onChunk({ pcm, sequence: 0 }); return { sizeBytes: pcm.length }; } }), true);
  assert.deepEqual(messages.map(m => m.type), ['tts.stream.start', 'tts.stream.chunk', 'tts.stream.end']);
  assert(messages.every(m => m.playbackId === 'turn1' && m.streamId === 'segment1'));
  messages.length = 0;
  const controller = new AbortController();
  assert.equal(await streamSpeechToSocket({ ...options, signal: controller.signal, synthesize: async ({ onChunk }) => { controller.abort(); await onChunk({ pcm, sequence: 0 }); } }), false);
  assert.equal(messages.at(-1).cancelled, true);
  assert.equal(messages.some(m => m.type === 'tts.stream.chunk'), false);
  messages.length = 0; ws.bufferedAmount = 3 * 1024 * 1024;
  assert.equal(await streamSpeechToSocket({ ...options, synthesize: async ({ onChunk }) => onChunk({ pcm, sequence: 0 }) }), false);
  assert.equal(messages.at(-1).ok, false);
  assert.equal(messages.at(-1).error.code, 'google_tts_failed');
});
