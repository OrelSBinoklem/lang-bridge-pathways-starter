import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createBilling, describeRequest, normalizeUsage } from './billing.mjs';
import { readTutorResponseStream } from './agent/streaming.mjs';

const root = fileURLToPath(new URL('../../../.tmp/credit-tests/', import.meta.url));
const speech = 'https://aiplatform.googleapis.com/v1/projects/test/locations/global/publishers/google/models/gemini-3.8-flash-tts:streamGenerateContent?alt=sse';
const request = { method: 'POST', body: JSON.stringify({ model: 'gpt-5.4', max_output_tokens: 700, input: 'Test' }) };
async function fixture(t, provider, reserveStatus = 200, settlementReport = () => ({})) {
  await mkdir(root, { recursive: true });
  const outbox = await mkdtemp(`${root}/run-`);
  t.after(() => rm(outbox, { recursive: true, force: true }));
  const calls = [];
  const billing = createBilling({ enabled: true, endpoint: 'https://billing.test', secret: 's'.repeat(32), outbox,
    fetchImpl: async (url, init) => {
      if (url === 'https://billing.test') {
        const body = JSON.parse(init.body); calls.push(body);
        return Response.json(body.action === 'reserve' ? { operation: body.reference } : { ok: true, ...settlementReport(body) }, { status: body.action === 'reserve' ? reserveStatus : 200 });
      }
      return provider(url, init);
    } });
  return { billing, calls };
}

test('per-turn observers receive canonical settled costs once and remain isolated across users', async t => {
  const { billing, calls } = await fixture(t, async (_url, init) => {
    const tokens = JSON.parse(init.body).max_output_tokens;
    return Response.json({ usage: { input_tokens: 10, output_tokens: tokens } });
  }, 200, body => body.action === 'settle' ? { status: 'settled', cost_micros: body.usage.output_tokens * 100 } : {});
  const first = [], second = [];
  const pay = max_output_tokens => billing.fetch('https://api.openai.com/v1/responses', { ...request, body: JSON.stringify({ model: 'gpt-5.4', max_output_tokens }) });
  await Promise.all([
    billing.run('user-a', () => billing.withUsageObserver(event => first.push(event), () => pay(2))),
    billing.run('user-b', () => billing.withUsageObserver(event => second.push(event), () => pay(7))),
  ]);
  assert.deepEqual(first, [{ known: true, costUsd: .0002, model: 'gpt-5.4', kind: 'text' }]);
  assert.deepEqual(second, [{ known: true, costUsd: .0007, model: 'gpt-5.4', kind: 'text' }]);
  assert.equal(calls.filter(call => call.action === 'settle').length, 2);
});

test('missing canonical price is explicitly unknown and observer failure never repeats a debit', async t => {
  const { billing, calls } = await fixture(t, () => Response.json({ usage: { input_tokens: 10, output_tokens: 2 } }));
  const observed = [];
  await billing.run('user-a', () => billing.withUsageObserver(event => { observed.push(event); throw Error('Observer-only failure'); }, () => billing.fetch('https://api.openai.com/v1/responses', request)));
  assert.equal(observed.length, 1); assert.equal(observed[0].known, false); assert.equal(observed[0].costUsd, null);
  assert.equal(calls.filter(call => call.action === 'settle').length, 1);
});

test('usage includes cached, cache writes, audio and search fees', () => {
  assert.deepEqual(normalizeUsage({ response: { usage: { input_tokens: 100, output_tokens: 10, input_tokens_details: { cached_tokens: 40, cache_write_tokens: 10 } }, output: [{ type: 'web_search_call' }] } }),
    { input_tokens: 100, output_tokens: 10, cached_tokens: 40, cache_write_tokens: 10, input_audio_tokens: 0, web_search_calls: 1 });
  assert.deepEqual(normalizeUsage({ usage: { seconds: 12.5 } }), { seconds: 12.5 });
  assert.equal(normalizeUsage({ usage: {} }), null);
});

test('cannot call providers outside authenticated context', async t => {
  const { billing, calls } = await fixture(t, () => assert.fail('Provider reached'));
  await assert.rejects(billing.fetch('https://api.openai.com/v1/responses', request), /аккаунт/);
  assert.equal(calls.length, 0);
});

test('preset billing is isolated across concurrent sessions and restored after nested calls', async t => {
  const {billing,calls}=await fixture(t,()=>Response.json({usage:{input_tokens:5,output_tokens:2}}));
  let release;const barrier=new Promise(resolve=>{release=resolve;});
  const pay=()=>billing.fetch('https://api.openai.com/v1/responses',request);
  const first=billing.run('economy-user',()=>billing.withPreset('economy',async()=>{
    await barrier;await pay();
    await billing.withPreset('standard',pay);
    await pay();
    await billing.context('message',{conversation_id:1,tutor_preset:'forged'});
  }));
  await billing.run('other-user',()=>billing.withPreset('uncompromising',pay));
  await billing.run('quality-user',()=>billing.withPreset('quality',pay));
  release();await first;
  await billing.run('default-user',pay);
  const reservations=calls.filter(call=>call.action==='reserve');
  assert.deepEqual(reservations.map(call=>[call.session,call.tutor_preset]),[
    ['other-user','uncompromising'],['quality-user','quality'],['economy-user','economy'],['economy-user','standard'],['economy-user','economy'],['default-user',null],
  ]);
  assert.equal(calls.find(call=>call.action==='context.message').tutor_preset,'economy');
  assert.throws(()=>billing.withPreset('__proto__',()=>{}),/Invalid billing preset/);
  assert.equal(calls.filter(call=>call.action==='settle').length,6);
});

test('zero balance blocks provider before any paid call', async t => {
  const { billing, calls } = await fixture(t, () => assert.fail('Provider reached'), 402);
  await assert.rejects(billing.run('session', () => billing.fetch('https://api.openai.com/v1/responses', request)), /кредитов/);
  assert.equal(calls.length, 1);
});

test('JSON calls settle actual usage once', async t => {
  const { billing, calls } = await fixture(t, () => Response.json({ usage: { input_tokens: 50, output_tokens: 20 } }));
  const response = await billing.run('session', () => billing.fetch('https://api.openai.com/v1/responses', request));
  assert.equal((await response.json()).usage.input_tokens, 50);
  assert.equal(calls.filter(c => c.action === 'settle').length, 1);
  assert.equal(calls[1].usage.output_tokens, 20);
});

test('stream forwards audio before final usage; settlement survives split SSE chunks', async t => {
  let source;
  const { billing, calls } = await fixture(t, () => new Response(new ReadableStream({ start(c) { source = c; } }), { headers: { 'Content-Type': 'text/event-stream' } }));
  const response = await billing.run('session', () => billing.fetch(speech, { body: '{}' }));
  const reader = response.body.getReader();
  source.enqueue(Buffer.from('data: {"candidates":[]}\n\n'));
  assert.equal((await reader.read()).done, false);
  assert.equal(calls.length, 1);
  source.enqueue(Buffer.from('data: {"usageMetadata":{"promptTokenCount":10,'));
  source.enqueue(Buffer.from('"candidatesTokenCount":20},"candidates":[{"finishReason":"STOP"}]}\n\n')); source.close();
  while (!(await reader.read()).done) { /* drain */ }
  assert.deepEqual(calls[1].usage, { input_tokens: 10, output_tokens: 20 });
});

test('cancelled stream is held for review, never silently charged or released', async t => {
  const { billing, calls } = await fixture(t, () => new Response(new ReadableStream({}), { headers: { 'Content-Type': 'text/event-stream' } }));
  const response = await billing.run('session', () => billing.fetch(speech, { body: '{}' }));
  await response.body.cancel();
  assert.equal(calls[1].usage, null);
  assert.equal(calls[1].rejected, false);
});

test('terminal response usage survives the normal consumer closing before transport EOF', async t => {
  const event={type:'response.completed',response:{status:'completed',usage:{input_tokens:1200,output_tokens:60},output_text:'Synthetic'}};
  let transportCancelled=false;
  const {billing,calls}=await fixture(t,()=>new Response(new ReadableStream({
    start(controller){controller.enqueue(Buffer.from(`data: ${JSON.stringify(event)}\n\n`));},
    cancel(){transportCancelled=true;},
  }),{headers:{'Content-Type':'text/event-stream'}}));
  const response=await billing.run('s',()=>billing.fetch('https://api.openai.com/v1/responses',request));
  const result=await readTutorResponseStream(response,{onSpeechPrefix:()=>{},startedAt:Date.now()});
  assert.equal(result.payload.status,'completed');assert.equal(transportCancelled,true);
  assert.deepEqual(calls.find(call=>call.action==='settle').usage,{input_tokens:1200,output_tokens:60,cached_tokens:0,cache_write_tokens:0,input_audio_tokens:0,web_search_calls:0});
  assert.equal(calls.filter(call=>call.action==='settle').length,1);
});

test('Flash-Lite reservation uses its own model and settles final Google usage once', async t => {
  const { billing, calls } = await fixture(t, () => new Response('data: {"usageMetadata":{"promptTokenCount":20,"candidatesTokenCount":2000},"candidates":[{"finishReason":"STOP"}]}\n\n', { headers: { 'Content-Type': 'text/event-stream' } }));
  const url = speech.replace('gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts');
  const response = await billing.run('session', () => billing.fetch(url, { body: '{}' }));
  await response.text();
  assert.equal(calls[0].model, 'gemini-3.8-flash-lite-tts');
  assert.deepEqual(calls[1].usage, { input_tokens: 20, output_tokens: 2000 });
  assert.equal(calls.filter(call => call.action === 'settle').length, 1);
});

test('HTTP 429 releases reservation; network failures retain reservation', async t => {
  const first = await fixture(t, () => new Response('', { status: 429 }));
  await first.billing.run('s', () => first.billing.fetch(speech, { body: '{}' }));
  assert.equal(first.calls[1].rejected, true);
  const second = await fixture(t, () => { throw new Error('offline'); });
  await assert.rejects(second.billing.run('s', () => second.billing.fetch(speech, { body: '{}' })), /offline/);
  assert.equal(second.calls[1].rejected, false);
});

test('unknown paid endpoint and ElevenLabs fail closed', () => {
  assert.throws(() => describeRequest('https://api.openai.com/v1/realtime', request), /not metered/);
  assert.throws(() => describeRequest('https://api.elevenlabs.io/v1/text-to-speech', request), /ElevenLabs/);
});

test('billing purpose distinguishes answers, speech and context updates', () => {
  assert.equal(describeRequest('https://api.openai.com/v1/responses', request).purpose, 'bot_answer');
  assert.equal(describeRequest('https://api.openai.com/v1/responses', { ...request, creditPurpose: 'conversation_summary' }).purpose, 'conversation_summary');
  assert.equal(describeRequest(speech, { body: '{}' }).purpose, 'speech');
});

test('multiline SSE and final event without newline retain actual usage', async t => {
  const data = 'data: {"type":"response.completed",\r\ndata: "response":{"usage":{"input_tokens":10,"output_tokens":20}}}';
  const { billing, calls } = await fixture(t, () => new Response(data, { headers: { 'Content-Type': 'text/event-stream' } }));
  const response = await billing.run('s', () => billing.fetch('https://api.openai.com/v1/responses', request));
  assert.equal(await response.text(), data);
  assert.equal(calls[1].usage.output_tokens, 20);
});

test('normal EOF without terminal event still requires review', async t => {
  const { billing, calls } = await fixture(t, () => new Response('data: {"usage":{"input_tokens":10,"output_tokens":20}}\n\n', { headers: { 'Content-Type': 'text/event-stream' } }));
  const response = await billing.run('s', () => billing.fetch('https://api.openai.com/v1/responses', request));
  await response.text();
  assert.equal(calls[1].usage, null);
  assert.equal(calls[1].rejected, false);
});

test('balance invalidations are scoped, follow confirmed writes and unsubscribe on disconnect', async t => {
  const { billing } = await fixture(t, () => Response.json({ usage: { input_tokens: 5, output_tokens: 2 } }));
  let current = 0, other = 0;
  const stop = billing.subscribe('current', () => current++);
  const stopOther = billing.subscribe('other', () => other++);
  t.after(stopOther);
  await billing.run('current', () => billing.fetch('https://api.openai.com/v1/responses', request));
  assert.equal(current, 2, 'reserve and settlement each invalidate');
  assert.equal(other, 0);
  stop();
  await billing.run('current', () => billing.fetch('https://api.openai.com/v1/responses', request));
  assert.equal(current, 2);
});

test('rejected reservations do not announce a balance change', async t => {
  const { billing } = await fixture(t, () => assert.fail('Provider reached'), 402);
  let changes = 0;
  const stop = billing.subscribe('s', () => changes++);
  t.after(stop);
  await assert.rejects(billing.run('s', () => billing.fetch('https://api.openai.com/v1/responses', request)));
  assert.equal(changes, 0);
});

test('successful outbox retries notify only the matching connected session', async t => {
  await mkdir(root, { recursive: true });
  const outbox = await mkdtemp(`${root}/notifications-`);
  t.after(() => rm(outbox, { recursive: true, force: true }));
  let offline = true, changes = 0;
  const billing = createBilling({ enabled: true, endpoint: 'https://billing.test', secret: 's'.repeat(32), outbox,
    fetchImpl: async (url, init) => {
      if (url !== 'https://billing.test') return Response.json({ usage: { input_tokens: 5, output_tokens: 2 } });
      const body = JSON.parse(init.body);
      if (body.action === 'settle' && offline) throw new Error('offline');
      return Response.json(body.action === 'reserve' ? { operation: '12345678-1234-1234-1234-123456789012' } : { ok: true });
    } });
  const stop = billing.subscribe('s', () => changes++);
  t.after(stop);
  await billing.run('s', () => billing.fetch('https://api.openai.com/v1/responses', request));
  assert.equal(changes, 1);
  offline = false;
  await billing.retryPending();
  assert.equal(changes, 2);
  await billing.retryPending();
  assert.equal(changes, 2);
});
