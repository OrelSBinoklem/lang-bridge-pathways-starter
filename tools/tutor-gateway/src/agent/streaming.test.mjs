import test from 'node:test';
import assert from 'node:assert/strict';
import { readSpeechPrefix, readSseEvents } from './streaming.mjs';
import { respondToTutorTurn } from './tutorAgent.mjs';
import { createEarlySpeech } from '../audio/earlySpeech.mjs';

const segment = (text, complete = false, speaker = 'tutor') => ({ text, complete, speaker, style: 'neutral_teacher' });
const speechJson = (text, command = null) => JSON.stringify({
  command, speech_segments: [{ style: 'neutral_teacher', speaker: 'tutor', text }], reply: text,
});

test('partial JSON yields only decoded speech after command and voice metadata', () => {
  assert.equal(readSpeechPrefix('{"speech_segments":[{"text":"Hello! '), null);
  assert.equal(readSpeechPrefix('{"command":{"name":"navigate"},"speech_segments":[{"style":"neutral_teacher","speaker":"tutor","text":"Done! '), null);
  const prefix = '{"command":null,"speech_segments":[{"style":"gentle_correction","speaker":"tutor","text":"';
  assert.equal(readSpeechPrefix(`${prefix}Labdien! \\u010`)[0].text, 'Labdien! ');
  assert.equal(readSpeechPrefix(`${prefix}Labdien! \\u0101`)[0].text, 'Labdien! \u0101');
  assert.equal(readSpeechPrefix(`${prefix}A \\"quote\\" and \\nline`)[0].text, 'A "quote" and \nline');
  assert.equal(readSpeechPrefix(`${prefix}A \\ud83d`)[0].text, 'A ');
  assert.equal(readSpeechPrefix(`${prefix}A \\ud83d\\ude00`)[0].text, 'A \u{1f600}');
  assert.equal(readSpeechPrefix(speechJson('Labi!'))[0].complete, true);
});

test('metadata after text waits for the complete segment, with no JSON punctuation spoken', () => {
  assert.equal(readSpeechPrefix('{"command":null,"speech_segments":[{"text":"Labi! ')[0], null);
  const data = readSpeechPrefix('{"command":null,"speech_segments":[{"text":"Labi!","speaker":"dialogue_b","style":"warm_encouragement"}],');
  assert.equal(data[0].text, 'Labi!');
  assert.equal(data[0].speaker, 'dialogue_b');
  assert.equal(data[0].complete, true);
});

test('sentence queue starts before completion, retains fragments, roles and order without duplicates', async () => {
  const spoken = [];
  const errors = [];
  const queue = createEarlySpeech({ speak: async (item) => spoken.push(item), onError: (error) => errors.push(error) });
  queue.update([segment('Lab')]);
  await queue.done;
  assert.equal(spoken.length, 0);
  queue.update([segment('Labdien! Es')]);
  await queue.done;
  assert.equal(spoken[0].text, 'Labdien!');
  queue.update([segment('Labdien! Es esmu skolot\u0101js. ', true), segment('Sveiki! ', false, 'dialogue_b')]);
  queue.finish([segment('Labdien! Es esmu skolot\u0101js.'), segment('Sveiki!', false, 'dialogue_b')]);
  await queue.done;
  assert.deepEqual(spoken.map((item) => item.text), ['Labdien!', 'Es esmu skolot\u0101js.', 'Sveiki!']);
  assert.equal(spoken[2].speaker, 'dialogue_b');
  assert.deepEqual(errors, []);
});

test('numbers, abbreviations and unfinished tokens are not sent as standalone speech', async () => {
  const spoken = [];
  const queue = createEarlySpeech({ speak: async (item) => spoken.push(item.text), onError: assert.fail });
  queue.update([segment('1. ')]);
  await queue.done;
  assert.equal(spoken.length, 0);
  queue.update([segment('1. Cena ir 3.50 eiro. Turp')]);
  await queue.done;
  assert.deepEqual(spoken, ['1. Cena ir 3.50 eiro.']);
  queue.finish([segment('1. Cena ir 3.50 eiro. Turpin\u0101m')]);
  await queue.done;
  assert.deepEqual(spoken, ['1. Cena ir 3.50 eiro.', 'Turpin\u0101m']);
});

test('cancellation and TTS failure stop pending sentences without unhandled rejections', async () => {
  const spoken = [];
  const queue = createEarlySpeech({ speak: async (item) => spoken.push(item.text), onError: assert.fail });
  queue.update([segment('First sentence. Second sentence. ', true)]);
  queue.cancel();
  await queue.done;
  assert.deepEqual(spoken, []);
  const errors = [];
  const broken = createEarlySpeech({ speak: async () => { throw new Error('provider failed'); }, onError: (error) => errors.push(error.message) });
  broken.update([segment('First sentence. Second sentence. ', true)]);
  await broken.done;
  assert.deepEqual(errors, ['provider failed']);
});

test('changed final text cancels remaining audio and reports a diagnostic', async () => {
  const errors = [];
  const queue = createEarlySpeech({ speak: async () => {}, onError: (error) => errors.push(error.message) });
  queue.update([segment('First sentence. More')]);
  await queue.done;
  queue.finish([segment('Different answer.')]);
  await queue.done;
  assert.deepEqual(errors, ['streamed_speech_does_not_match_final_reply']);
});

test('SSE handles CRLF, split UTF-8 and events across arbitrary network boundaries', async () => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(': keepalive\r\n\r\ndata: {"type":"response.output_text.delta","delta":"\u0101"}\r\n\r\ndata: [DONE]\r\n\r\n');
  const body = new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } });
  const events = [];
  for await (const event of readSseEvents(body)) events.push(event);
  assert.deepEqual(events, [{ type: 'response.output_text.delta', delta: '\u0101' }]);
});

test('real request path starts TTS before response.completed and keeps usage/cache metadata', async (t) => {
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only';
  t.after(() => { if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; });
  const encoder = new TextEncoder();
  let stream;
  let request;
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    request = JSON.parse(init.body);
    return new Response(new ReadableStream({ start(controller) { stream = controller; } }), {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  });
  let notifySpeech;
  const earlyAudio = new Promise((resolve) => { notifySpeech = resolve; });
  const spoken = [];
  const queue = createEarlySpeech({ speak: async (item) => { spoken.push(item.text); notifySpeech(); }, onError: assert.fail });
  let completed = false;
  const promise = respondToTutorTurn({ transcript: 'Sveiki', onSpeechPrefix: queue.update }).then((result) => { completed = true; return result; });
  await new Promise((resolve) => setImmediate(resolve));
  const raw = speechJson('Labdien! Es esmu skolot\u0101js.');
  const boundary = raw.indexOf('Es esmu');
  const event = (payload) => stream.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  event({ type: 'response.output_text.delta', delta: raw.slice(0, boundary) });
  await earlyAudio;
  assert.equal(completed, false);
  assert.equal(request.stream, true);
  assert.deepEqual(spoken, ['Labdien!']);
  event({ type: 'response.output_text.delta', delta: raw.slice(boundary) });
  event({ type: 'response.completed', response: { status: 'completed', output_text: raw,
    usage: { input_tokens: 2000, input_tokens_details: { cached_tokens: 1800 }, output_tokens: 120 } } });
  const result = await promise;
  queue.finish(result.speechSegments);
  await queue.done;
  assert.equal(result.ok, true);
  assert.equal(result.metadata.promptCache.cached_input_percent, 90);
  assert.equal(result.metadata.usage.output_tokens, 120);
  assert.equal(result.metadata.streaming, true);
  assert.deepEqual(spoken, ['Labdien!', 'Es esmu skolot\u0101js.']);
});

test('interrupted stream is an error and cannot silently become a successful reply', async (t) => {
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only';
  t.after(() => { if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; });
  t.mock.method(globalThis, 'fetch', async () => new Response('data: {"type":"response.output_text.delta","delta":"{}"}\n\n'));
  await assert.rejects(respondToTutorTurn({ transcript: 'question', onSpeechPrefix: () => {} }), /ended_without_result/);
});
