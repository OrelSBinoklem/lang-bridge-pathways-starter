import { readFile } from 'node:fs/promises';
import { createSign } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { ttsCatalog } from './ttsConfig.mjs';

const defaultGoogleProfile = ttsCatalog.models.find(item => item.provider === 'google' && item.id === ttsCatalog.defaultModel)
  || ttsCatalog.models.find(item => item.provider === 'google');
const abortError = () => new DOMException('Speech cancelled.', 'AbortError');
const checkAbort = signal => {
  if (!signal?.aborted) return;
  if (signal.reason?.name === 'TimeoutError') throw new DOMException('Google speech timed out.', 'TimeoutError');
  throw abortError();
};

// A single token refresh is shared by concurrent turns. It never logs or persists credentials.
export function createGoogleAuth({ fetchImpl = globalThis.fetch, read = readFile, now = Date.now, env = process.env } = {}) {
  let cached = null, refreshing = null;
  async function refresh(filename) {
    const c = JSON.parse(await read(filename, 'utf8'));
    if (c.type !== 'service_account' || !c.private_key || !c.client_email || !/^[a-z][a-z0-9-]{4,62}$/.test(c.project_id ?? '')) {
      throw new Error('Invalid Google speech service-account configuration.');
    }
    const time = Math.floor(now() / 1000);
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT', kid: c.private_key_id })}.${encode({ iss: c.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: time, exp: time + 3600 })}`;
    const signer = createSign('RSA-SHA256'); signer.update(unsigned);
    const assertion = `${unsigned}.${signer.sign(c.private_key).toString('base64url')}`;
    const r = await fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    if (!r.ok) throw new Error(`Google speech authentication failed (HTTP ${r.status}).`);
    const value = await r.json();
    if (typeof value.access_token !== 'string' || !value.access_token || !(value.expires_in > 60)) throw new Error('Invalid Google authentication response.');
    cached = { filename, token: value.access_token, project: c.project_id, expiresAt: now() + (Math.min(value.expires_in, 3600) - 60) * 1000 };
    return cached;
  }
  return async function authenticate(signal) {
    checkAbort(signal);
    const filename = env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!filename) throw new Error('Google speech is not configured: GOOGLE_APPLICATION_CREDENTIALS is missing.');
    let result;
    if (cached?.filename === filename && cached.expiresAt > now()) result = cached;
    else {
      if (!refreshing) refreshing = refresh(filename).finally(() => { refreshing = null; });
      result = await refreshing;
      if (result.filename !== filename) return authenticate(signal);
    }
    checkAbort(signal);
    return { token: result.token, project: result.project };
  };
}

export async function* readSpeechEvents(body, signal) {
  if (!body) throw new Error('Google speech returned an empty response.');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '', lines = [], size = 0;
  const parse = () => {
    const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    lines = []; size = 0;
    if (!data || data === '[DONE]') return null;
    try { return JSON.parse(data); } catch { throw new Error('Invalid Google speech stream event.'); }
  };
  const cancel = () => { reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      checkAbort(signal);
      const { done, value } = await reader.read();
      checkAbort(signal);
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (pending.length + size > 2 * 1024 * 1024) throw new Error('Google speech stream event exceeds size limit.');
      let end;
      while ((end = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, end).replace(/\r$/, '');
        pending = pending.slice(end + 1);
        if (!line) { const event = parse(); if (event) yield event; }
        else { lines.push(line); size += line.length; }
      }
      if (done) break;
    }
    if (pending) lines.push(pending.replace(/\r$/, ''));
    const last = parse(); if (last) yield last;
  } finally {
    signal?.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

const auth = createGoogleAuth();

export async function streamGoogleSpeech({ text, model = defaultGoogleProfile.id, voice, instructions, signal, onChunk,
  fetchImpl = globalThis.fetch, authenticate = auth, clock = () => performance.now() }) {
  const googleProfile = ttsCatalog.models.find(item => item.provider === 'google' && item.id === model);
  if (!googleProfile) throw new Error('Unsupported Google speech model.');
  voice ??= googleProfile.defaultVoice;
  if (typeof text !== 'string' || !text.trim() || text.length > 4096) throw new Error('Google speech expects 1-4096 characters.');
  if (!googleProfile.voices.includes(voice)) throw new Error('Unsupported Google speech voice.');
  if (typeof onChunk !== 'function') throw new Error('Missing speech stream receiver.');
  checkAbort(signal);
  const started = clock();
  const timeout = AbortSignal.timeout(120000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const { token, project } = await authenticate(requestSignal);
  checkAbort(requestSignal);
  const body = { contents: [{ role: 'user', parts: [{ text: text.trim(), speechMetadata: { style: instructions } }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice } } } };
  let response;
  try {
    response = await fetchImpl(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${googleProfile.id}:streamGenerateContent?alt=sse`, {
      method: 'POST', signal: requestSignal, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch (error) {
    if (error?.status === 402 || error?.status === 401) throw error;
    checkAbort(signal);
    throw new Error('Google speech connection failed or timed out. No automatic retry.');
  }
  if (!response.ok) throw new Error(`Google speech failed (HTTP ${response.status}). No automatic retry.`);
  if (!response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('Google speech returned an unsupported stream format.');
  let bytes = 0, sequence = 0, firstAudioMs = null, usage = null, completed = false;
  for await (const event of readSpeechEvents(response.body, requestSignal)) {
    checkAbort(requestSignal);
    if (event.error) throw new Error(`Google speech stream failed (code ${Number(event.error.code) || 'unknown'}).`);
    if (event.promptFeedback?.blockReason) throw new Error('Google speech request was blocked.');
    usage = event.usageMetadata ?? usage;
    if ((event.candidates?.length ?? 0) > 1) throw new Error('Google speech returned multiple audio candidates.');
    for (const candidate of event.candidates ?? []) {
      if (candidate.finishReason && candidate.finishReason !== 'STOP') throw new Error('Google speech ended before completing the phrase.');
      if (candidate.finishReason === 'STOP') completed = true;
      for (const part of candidate.content?.parts ?? []) {
        if (!part.inlineData?.data) continue;
        const { data, mimeType } = part.inlineData;
        if (!/^audio\/(?:l16|pcm)(?:;|$)/i.test(mimeType ?? '') || (/rate=(\d+)/i.test(mimeType) && Number(mimeType.match(/rate=(\d+)/i)[1]) !== 24000)) throw new Error('Google speech returned unsupported PCM audio.');
        if (typeof data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error('Invalid Google speech audio encoding.');
        const pcm = Buffer.from(data, 'base64');
        if (!pcm.length || pcm.length % 2 || pcm.toString('ascii', 0, 4) === 'RIFF') throw new Error('Invalid Google speech PCM packet.');
        bytes += pcm.length;
        if (bytes > 48000 * 180) throw new Error('Google speech exceeded the audio duration limit.');
        firstAudioMs ??= Math.round(clock() - started);
        // Bound socket messages, retaining sample boundaries and sequence across provider packets.
        for (let offset = 0; offset < pcm.length; offset += 9600) {
          checkAbort(requestSignal);
          await onChunk({ pcm: pcm.subarray(offset, offset + 9600), sequence: sequence++ });
        }
      }
    }
  }
  checkAbort(requestSignal);
  if (!bytes) throw new Error('Google speech returned no audio.');
  if (!completed) throw new Error('Google speech stream ended without a completion marker.');
  return { provider: 'google', model: googleProfile.id, voice, firstAudioMs, latencyMs: Math.round(clock() - started),
    sizeBytes: bytes, audioDurationSeconds: bytes / 48000, chunks: sequence, usage: usage ? {
      inputTokens: Number(usage.promptTokenCount) || 0, outputAudioTokens: Number(usage.candidatesTokenCount) || 0,
    } : null };
}
