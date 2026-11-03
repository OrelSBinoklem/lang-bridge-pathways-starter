import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash, createSign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const model = 'gemini-3.8-flash-tts';
export const voice = 'Enceladus';
export const release = 'gemini38-20261013';
const workspace = path.join(root, '.tmp/alphabet-flash-20261013');
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const style = 'Native Latvian pronunciation. A calm, clear Latvian teacher naming one alphabet letter once. '
  + 'Speak only the supplied Latvian letter name, not an English letter name, not a word or an explanation. '
  + 'Preserve Latvian short and long vowel distinctions and palatalized consonants. '
  + 'Natural isolated pronunciation, neutral warm voice, no whisper, singing, vocal effects or exaggerated stretching.';

export function buildJobs(source, selectedVoice = voice) {
  if (!['Enceladus', 'Aoede'].includes(selectedVoice)) throw Error('Unknown approved alphabet voice.');
  if (source.language !== 'lv' || source.items?.length !== 33
    || new Set(source.items.map(item => item.key)).size !== 33) throw Error('Expected the canonical 33 Latvian letters.');
  return source.items.map(item => {
    if (!/^[a-z0-9-]{1,64}$/.test(item.key) || typeof item.name !== 'string'
      || !/^[a-zāčēģīķļņšūž]{1,3}$/u.test(item.name) || typeof item.letter !== 'string') throw Error('Invalid letter definition.');
    const request = {
      contents: [{ role: 'user', parts: [{ text: `${item.name}.`, speechMetadata: { style } }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice: selectedVoice } } },
    };
    return { ...item, model, voice: selectedVoice, request, request_sha256: hash(JSON.stringify({ model, request })) };
  });
}

async function exists(file) {
  try { await access(file); return true; } catch (error) { if (error.code !== 'ENOENT') throw error; return false; }
}

async function tokenFromFile(file) {
  const credentials = JSON.parse(await readFile(file, 'utf8'));
  if (credentials.type !== 'service_account' || !credentials.private_key || !credentials.client_email
    || !/^[a-z][a-z0-9-]{4,62}$/.test(credentials.project_id ?? '')) throw Error('Invalid local service account.');
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT', kid: credentials.private_key_id })}.${encode({
    iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(credentials.private_key).toString('base64url')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', signal: AbortSignal.timeout(60000),
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const result = await response.json();
  if (!response.ok || typeof result.access_token !== 'string') {
    const description = String(result.error_description ?? '');
    const reason = /signature/i.test(description) ? 'JWT signature rejected'
      : /timeframe|iat|short-lived/i.test(description) ? 'JWT timestamp rejected'
        : /disabled/i.test(description) ? 'Service account or key disabled' : 'Unclassified rejection';
    throw Error(`Google authentication rejected: HTTP ${response.status}; ${reason}.`);
  }
  return { token: result.access_token, project: credentials.project_id };
}

export async function cachedReceipt(directory, job) {
  const stem = path.join(directory, job.key);
  if (await exists(`${stem}.receipt.json`)) {
    const receipt = JSON.parse(await readFile(`${stem}.receipt.json`, 'utf8'));
    const bytes = await readFile(`${stem}.wav`);
    if (receipt.request_sha256 !== job.request_sha256 || receipt.file_sha256 !== hash(bytes)
      || receipt.name !== job.name || receipt.model !== model || receipt.voice !== job.voice) throw Error(`Invalid cached recording: ${job.key}.`);
    return receipt;
  }
  if (await exists(`${stem}.request.json`) || await exists(`${stem}.wav`)) {
    throw Error(`Unresolved possibly billed request for ${job.key}; no automatic retry.`);
  }
  return null;
}

async function generate(jobs, credentials, directory) {
  await mkdir(directory, { recursive: true });
  const pending = [];
  for (const job of jobs) if (!await cachedReceipt(directory, job)) pending.push(job);
  if (!pending.length) return;
  const { token, project } = await tokenFromFile(credentials);
  const url = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${model}:generateContent`;
  for (const job of pending) {
    const stem = path.join(directory, job.key);
    await writeFile(`${stem}.request.json`, json({ ...job, started_at: new Date().toISOString(), post_processing_speed: false }), { flag: 'wx' });
    let response;
    try {
      response = await fetch(url, {
        method: 'POST', signal: AbortSignal.timeout(240000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(job.request),
      });
    } catch {
      throw Error(`Network failure for ${job.key}; billing uncertain, no retry.`);
    }
    const result = await response.json();
    if (!response.ok) {
      await writeFile(`${stem}.error.json`, json({ http: response.status, status: result.error?.status }), { flag: 'wx' });
      throw Error(`Google rejected ${job.key}: HTTP ${response.status}; stopped without retry.`);
    }
    const parts = (result.candidates?.[0]?.content?.parts ?? []).filter(part => part.inlineData?.data);
    if (parts.length !== 1) throw Error(`Unexpected audio for ${job.key}; no retry.`);
    const audio = Buffer.from(parts[0].inlineData.data, 'base64');
    if (audio.length < 1024 || audio.toString('ascii', 0, 4) !== 'RIFF'
      || audio.toString('ascii', 8, 12) !== 'WAVE') throw Error(`Invalid native WAV for ${job.key}; no retry.`);
    await writeFile(`${stem}.wav`, audio, { flag: 'wx' });
    await writeFile(`${stem}.receipt.json`, json({
      key: job.key, letter: job.letter, name: job.name, model, voice: job.voice,
      request_sha256: job.request_sha256, file_sha256: hash(audio),
      bytes: audio.length, usage_metadata: result.usageMetadata ?? null,
      generated_at: new Date().toISOString(), post_processing_speed: false,
    }), { flag: 'wx' });
    console.log(`Generated ${job.key}: ${audio.length} bytes.`);
  }
}

export function inspectWav(file) {
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', '24000', 'pipe:1']);
  let energy = 0, peak = 0;
  for (let offset = 0; offset < pcm.length; offset += 4) {
    const sample = pcm.readFloatLE(offset);
    if (!Number.isFinite(sample)) throw Error('Invalid decoded samples.');
    energy += sample ** 2;
    peak = Math.max(peak, Math.abs(sample));
  }
  const duration = pcm.length / 4 / 24000;
  const rms = Math.sqrt(energy / (pcm.length / 4));
  if (duration < 0.15 || duration > 6 || rms < 0.001 || peak > 1.001) throw Error(`Recording needs review: ${path.basename(file)} (${duration.toFixed(2)}s).`);
  return { duration_seconds: duration, rms, peak, decoded: true, pronunciation_verified: false };
}

async function publishLocal(source, jobs, directory, releaseName) {
  const clips = {};
  for (const job of jobs) {
    const receipt = await cachedReceipt(directory, job);
    if (!receipt) throw Error(`Missing ${job.key}. Generate the entire batch first.`);
    clips[job.key] = { ...receipt, inspection: inspectWav(path.join(directory, `${job.key}.wav`)) };
  }
  const out = path.join(root, 'frontend/public/audio/grammar/alphabet', releaseName);
  await mkdir(out, { recursive: true });
  for (const job of jobs) {
    const target = path.join(out, `${job.key}.mp3`);
    const mp3 = execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(directory, `${job.key}.wav`),
      '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '128k', '-f', 'mp3', 'pipe:1']);
    if (await exists(target)) {
      if (hash(await readFile(target)) !== hash(mp3)) throw Error(`Existing release audio differs: ${job.key}.`);
    } else await writeFile(target, mp3, { flag: 'wx' });
    clips[job.key] = { ...clips[job.key], source_wav_sha256: clips[job.key].file_sha256,
      file_sha256: hash(mp3), audio_url: `/audio/grammar/alphabet/${releaseName}/${job.key}.mp3` };
  }
  const manifest = json({ provider: 'google', model, voice: jobs[0].voice, language: 'lv', source: source.source,
    post_processing_speed: false, pronunciation_review: 'owner_listening_required', clips });
  const target = path.join(out, 'manifest.json');
  if (await exists(target)) {
    if (await readFile(target, 'utf8') !== manifest) throw Error('Existing release manifest differs.');
  } else await writeFile(target, manifest, { flag: 'wx' });
  console.log(`Prepared ${jobs.length} ${jobs[0].voice} MP3 files; previous recordings preserved.`);
}

async function main() {
  const args = process.argv.slice(2);
  for (const arg of args) if (!['--generate', '--publish-local'].includes(arg)
    && !arg.startsWith('--only=') && !arg.startsWith('--credentials=') && !arg.startsWith('--voice=')) throw Error('Unknown argument.');
  const source = JSON.parse(await readFile(path.join(root, 'resources/course/alphabet-letter-names.json'), 'utf8'));
  const selectedVoice = args.find(arg => arg.startsWith('--voice='))?.slice(8) ?? voice;
  const jobs = buildJobs(source, selectedVoice);
  const suffix = selectedVoice === voice ? '' : `-${selectedVoice.toLowerCase()}`;
  const directory = `${workspace}${suffix}`;
  const releaseName = `${release}${suffix}`;
  const only = args.find(arg => arg.startsWith('--only='))?.slice(7).split(',');
  if (only?.some(key => !jobs.some(job => job.key === key)) || new Set(only).size !== (only?.length ?? 0)) throw Error('Unknown or duplicate selected letter.');
  const selected = only ? jobs.filter(job => only.includes(job.key)) : jobs;
  if (!selected.length) throw Error('No letters selected.');
  console.log(json({ model, voice: selectedVoice, clips: selected.length,
    spoken_characters: selected.reduce((sum, job) => sum + [...job.name].length + 1, 0),
    database_writes: false, automatic_paid_retry: false }));
  if (args.includes('--generate')) {
    const credentials = args.find(arg => arg.startsWith('--credentials='))?.slice(14);
    if (!credentials) throw Error('Pass a local service-account file with --credentials. It is never copied to the output.');
    await generate(selected, credentials, directory);
  }
  if (args.includes('--publish-local')) {
    if (only) throw Error('Only the complete alphabet can be published.');
    await publishLocal(source, jobs, directory, releaseName);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
