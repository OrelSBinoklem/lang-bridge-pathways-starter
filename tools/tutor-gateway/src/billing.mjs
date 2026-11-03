import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readdir, readFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tutorDiagnostics } from './diagnostics.mjs';

export function normalizeUsage(event) {
  const payload = event.response || event;
  if (payload.usageMetadata) {
    const u = payload.usageMetadata;
    return Number.isFinite(u.promptTokenCount) && Number.isFinite(u.candidatesTokenCount)
      ? { input_tokens: u.promptTokenCount, output_tokens: u.candidatesTokenCount } : null;
  }
  const u = payload.usage;
  if (!u) return Number.isFinite(payload.duration) ? { seconds: payload.duration } : null;
  if (Number.isFinite(u.seconds)) return { seconds: u.seconds };
  const input = u.input_tokens ?? u.prompt_tokens;
  const output = u.output_tokens ?? u.completion_tokens ?? (payload.data ? 0 : undefined);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;
  const d = u.input_tokens_details || u.input_token_details || u.prompt_tokens_details || {};
  return { input_tokens: input, output_tokens: output, cached_tokens: d.cached_tokens || 0,
    cache_write_tokens: d.cache_write_tokens || d.cache_creation_tokens || 0, input_audio_tokens: d.audio_tokens || 0,
    web_search_calls: (payload.output || []).filter((v) => v.type === 'web_search_call').length };
}

export function describeRequest(url, init = {}) {
  const endpoint = new URL(url);
  if (!['api.openai.com', 'aiplatform.googleapis.com', 'api.elevenlabs.io'].includes(endpoint.hostname)) return null;
  if (endpoint.hostname === 'api.elevenlabs.io') throw new Error('ElevenLabs пока не подключён к кредитам. Выберите Google или OpenAI.');
  const google = endpoint.hostname === 'aiplatform.googleapis.com';
  const form = init.body instanceof FormData;
  const body = form ? {} : JSON.parse(init.body || '{}');
  const model = google ? endpoint.pathname.match(/\/models\/([^:]+):/)?.[1] : form ? init.body.get('model') : body.model;
  const kind = google || endpoint.pathname.endsWith('/speech') ? 'speech' : form ? 'transcription' : endpoint.pathname.endsWith('/embeddings') ? 'embedding' : 'text';
  if (!google && !['/v1/responses', '/v1/audio/speech', '/v1/audio/transcriptions', '/v1/embeddings'].includes(endpoint.pathname)) throw new Error('AI endpoint is not metered.');
  if (form && (init.body.get('file')?.size || 0) > 25 * 1024 * 1024) throw new Error('Аудиозапись слишком большая.');
  if (body.service_tier && !['auto', 'default'].includes(body.service_tier)) throw new Error('Этот тариф модели не подключён к кредитам.');
  const purpose = init.creditPurpose || ({ speech: 'speech', transcription: 'transcription', embedding: 'memory', text: 'bot_answer' })[kind];
  return { model, kind, purpose, input_bytes: form ? 0 : Buffer.byteLength(init.body || ''),
    max_output_tokens: body.max_output_tokens ?? 16000, characters: kind === 'speech' && !google ? [...String(body.input || '')].length : 0 };
}

export function createBilling({ enabled = process.env.CREDITS_ENABLED === 'true', fetchImpl = globalThis.fetch,
  endpoint = process.env.CREDITS_API_URL, secret = process.env.CREDITS_GATEWAY_SECRET,
  outbox = fileURLToPath(new URL('../../../.tmp/credit-settlements/', import.meta.url)), diagnostics = tutorDiagnostics } = {}) {
  const context = new AsyncLocalStorage();
  const presetContext = new AsyncLocalStorage();
  const usageObservers = new AsyncLocalStorage();
  const listeners = new Map();
  const adminSessions = new Set();
  const identities = new Map();
  if (enabled && (!endpoint || !secret || secret.length < 32)) throw new Error('Credit gateway configuration missing');
  async function api(payload) {
    const started=Date.now();
    const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Credit-Gateway': secret },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      diagnostics.log('billing.api.failed',{action:payload.action,operation:payload.operation,status_code:response.status,duration_ms:Date.now()-started});
      const error = new Error(response.status === 402 ? 'Недостаточно кредитов. Проверьте баланс.' : response.status === 401 ? 'Сессия бота истекла. Закройте и снова откройте бота.' : payload.action.startsWith('context.') ? 'Не удалось сохранить или восстановить контекст беседы.' : 'Не удалось подтвердить оплату AI-запроса.');
      error.status = response.status;
      throw error;
    }
    const result = await response.json();
    if (payload.session && (['reserve', 'settle'].includes(payload.action) || payload.action === 'context.message' && payload.metadata?.longMemoryEnabled)) {
      for (const listener of listeners.get(payload.session) || []) {
        try { listener(); } catch { console.error('Credit change notification failed'); }
      }
    }
    return result;
  }
  async function settlement(payload) {
    // Persist before sending: a restart or lost acknowledgement must not lose the debit.
    await mkdir(outbox, { recursive: true, mode: 0o700 });
    const path = `${outbox}/${payload.operation}.json`;
    await writeFile(path, JSON.stringify(payload), { mode: 0o600 });
    try { const result = await api(payload); await unlink(path); diagnostics.log('billing.settle.ack',{operation:payload.operation}); return result; }
    catch (error) { diagnostics.log('billing.settle.queued',{operation:payload.operation,error_type:error.name}); console.error('Credit settlement queued', payload.operation); }
  }
  async function retryPending() {
    for (const name of await readdir(outbox).catch(() => [])) {
      if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
      try { diagnostics.log('billing.settle.retry',{operation:name.slice(0,-5)}); await api(JSON.parse(await readFile(`${outbox}/${name}`, 'utf8'))); await unlink(`${outbox}/${name}`); diagnostics.log('billing.settle.retry_ack',{operation:name.slice(0,-5)}); }
      catch (error) { diagnostics.log('billing.settle.retry_failed',{operation:name.slice(0,-5),error_type:error.name}); }
    }
  }
  async function meteredFetch(url, init) {
    if (!enabled) return fetchImpl(url, init);
    const descriptor = describeRequest(url, init);
    if (!descriptor) return fetchImpl(url, init);
    const session = context.getStore();
    if (!session) throw new Error('Войдите в аккаунт для использования AI.');
    const callId=randomUUID(), started=Date.now();
    diagnostics.log('billing.reserve.request',{...descriptor,call_id:callId,preset:presetContext.getStore()});
    let operation;
    try { ({operation}=await api({ action:'reserve',session,reference:callId,...descriptor,tutor_preset:presetContext.getStore()??null })); }
    catch(error){diagnostics.log('billing.reserve.failed',{...descriptor,call_id:callId,status_code:error.status,error_type:error.name});throw error;}
    const log=(event,fields={})=>diagnostics.log(event,{...descriptor,call_id:callId,operation,...fields});
    log('billing.reserved',{duration_ms:Date.now()-started});
    let settled = false;
    const finish = async (usage = null, rejected = false, reason = 'completed') => {
      if (settled) return;
      settled = true;
      log('billing.settle.request',{reason,has_usage:usage!==null,rejected,duration_ms:Date.now()-started,...usage});
      const result = await settlement({ action: 'settle', session, operation, usage, rejected });
      const known = Number.isSafeInteger(result?.cost_micros) && result.cost_micros >= 0;
      for (const observer of usageObservers.getStore() || []) {
        try { observer({ known, costUsd: known ? result.cost_micros / 1000000 : null, model: descriptor.model, kind: descriptor.kind }); }
        catch { diagnostics.log('billing.observer.failed', { ok: false }); }
      }
    };
    let response;
    log('provider.start');
    try { response = await fetchImpl(url, init); }
    catch (error) { log('provider.failed',{error_type:error.name,cancelled:error.name==='AbortError'}); await finish(null,false,'provider_fetch_error'); throw error; }
    log('provider.headers',{status_code:response.status,duration_ms:Date.now()-started,request_id:response.headers.get('x-request-id')||response.headers.get('x-goog-request-id')||undefined});
    if (!response.ok) { await finish(null, response.status >= 400 && response.status < 500,'provider_http_error'); return response; }
    const sse = response.headers.get('content-type')?.includes('text/event-stream');
    if (!sse) {
      try {
        const buffer = await response.arrayBuffer();
        let payload = {};
        if (response.headers.get('content-type')?.includes('json')) payload = JSON.parse(Buffer.from(buffer).toString('utf8'));
        const usage=normalizeUsage(payload)||(['tts-1','tts-1-hd'].includes(descriptor.model)?{input_tokens:0,output_tokens:0}:null);
        log('provider.json.completed',{has_usage:usage!==null,...usage});
        await finish(usage,false,usage?'completed':'json_missing_usage');
        return new Response(buffer, { status: response.status, headers: response.headers });
      } catch (error) { log('provider.json.failed',{error_type:error.name}); await finish(null,false,'provider_json_error'); throw error; }
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '', lines = [], size = 0, usage = null, terminal = false, chunks=0, bytes=0, events=0, terminalEvent='none';
    const parseEvent = () => {
      const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      lines = []; size = 0;
      if (!data || data === '[DONE]') return;
      const event = JSON.parse(data);
      events++;
      terminal ||= ['response.completed', 'response.incomplete', 'response.failed', 'speech.audio.done'].includes(event.type)
        || (event.candidates || []).some(candidate => candidate.finishReason);
      usage = normalizeUsage(event) || usage;
      if (['response.completed','response.incomplete','response.failed','speech.audio.done'].includes(event.type)) terminalEvent=event.type;
      else if ((event.candidates||[]).some(candidate=>candidate.finishReason)) terminalEvent='google.finish';
    };
    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const result = await reader.read();
          if(!result.done){if(chunks===0)log('provider.stream.first_byte',{first_byte_ms:Date.now()-started});chunks++;bytes+=result.value.byteLength;}
          pending += result.done ? decoder.decode() : decoder.decode(result.value, { stream: true });
          let boundary;
          while ((boundary = pending.indexOf('\n')) !== -1) {
            const line = pending.slice(0, boundary).replace(/\r$/, ''); pending = pending.slice(boundary + 1);
            if (!line) parseEvent();
            else { lines.push(line); size += line.length; }
          }
          if (pending.length + size > 4 * 1024 * 1024) throw new Error('Oversized provider event');
          if (result.done) {
            if (pending) lines.push(pending.replace(/\r$/, ''));
            parseEvent();
            log('provider.stream.completed',{terminal,terminal_event:terminalEvent,has_usage:usage!==null,chunks,stream_bytes:bytes,events,duration_ms:Date.now()-started,...usage});
            await finish(terminal ? usage : null,false,!terminal?'stream_missing_terminal':!usage?'stream_missing_usage':'completed'); controller.close(); return;
          }
          controller.enqueue(result.value);
        } catch (error) { log('provider.stream.failed',{error_type:error.name,cancelled:error.name==='AbortError',terminal,has_usage:usage!==null,chunks,stream_bytes:bytes,events}); await finish(terminal?usage:null,false,terminal&&usage?'stream_error_after_terminal':'stream_error'); controller.error(error); await reader.cancel().catch(() => {}); }
      },
      async cancel(reason) { log('provider.stream.cancelled',{cancelled:true,terminal,has_usage:usage!==null,chunks,stream_bytes:bytes,events,duration_ms:Date.now()-started}); await finish(terminal?usage:null,false,terminal&&usage?'consumer_closed_after_terminal':'consumer_cancelled'); await reader.cancel(reason).catch(() => {}); },
    });
    return new Response(stream, { status: response.status, headers: response.headers });
  }
  return { enabled, fetch: meteredFetch, run: (session, callback) => context.run(session, callback), retryPending,
    withUsageObserver: (observer, callback) => usageObservers.run([...(usageObservers.getStore() || []), observer], callback),
    withPreset: (preset, callback) => {
      if (preset != null && !['economy', 'standard', 'quality', 'uncompromising'].includes(preset)) throw new Error('Invalid billing preset');
      return presetContext.run(preset ?? null, callback);
    },
    canConfigure: session => !enabled || adminSessions.has(session),
    identity: session => identities.get(session) ?? null,
    verifyAdmin: session => api({ action: 'debug.authorize', session }),
    presets: async ({ withProfiles = false } = {}) => {
      const session = context.getStore();
      const result = await api({ action: 'presets', session });
      return withProfiles ? result : result.presets;
    },
    flow: async () => {
      if (!enabled) return null;
      const session = context.getStore();
      return (await api({ action: 'flow.active', session })).flow;
    },
    context: (action, payload) => {
      const session = context.getStore();
      if (!enabled || !session) throw new Error('Authenticated tutor context is unavailable.');
      return api({ ...payload, action: `context.${action}`, session, tutor_preset: presetContext.getStore() ?? null });
    },
    subscribe: (session, listener) => {
      if (!listeners.has(session)) listeners.set(session, new Set());
      const callbacks = listeners.get(session);
      callbacks.add(listener);
      return () => { callbacks.delete(listener); if (!callbacks.size && listeners.get(session) === callbacks) listeners.delete(session); };
    },
    authenticate: async (ticket) => {
      const result = await api({ action: 'authenticate', ticket });
      if (result.is_admin === true) adminSessions.add(result.session);
      if (Number.isSafeInteger(result.user_id) && result.user_id > 0) identities.set(result.session, result.user_id);
      return result.session;
    },
    forget: session => { adminSessions.delete(session); identities.delete(session); } };
}
