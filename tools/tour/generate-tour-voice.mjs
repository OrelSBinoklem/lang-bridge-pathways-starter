// Voices the guide cat (and the table octopus) with Gemini Flash-Lite TTS (Vertex AI, local service account).
//   node tools/tour/generate-tour-voice.mjs --samples --credentials=<file>          three voice samples
//   node tools/tour/generate-tour-voice.mjs --tour --voice=Puck --credentials=<file> every line of the home tour
//   node tools/tour/generate-tour-voice.mjs --words-tour --max-usd=1 --credentials=<file> Fenrir RU/UK category tour
//   node tools/tour/generate-tour-voice.mjs --octopus --credentials=<file>         the octopus lines in each of its
//     candidate voices (resources/table-bot/octopus-lines.json) to frontend/public/audio/table-bot/
// Like the other audio tools: one request per clip with a receipt, no automatic retry of a possibly billed
// request, cached clips are reused, MP3 + manifest go to frontend/public/audio/tour/<release>/.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash, createSign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const model = 'gemini-3.8-flash-lite-tts';
export const SAMPLE_VOICES = ['Puck', 'Leda', 'Fenrir'];
const SAMPLE_TEXT = { key: 'sample', ru: 'Привет! Я кот Рунцис. Давай покажу, что где на сайте — это займёт всего минуту.' };
// Decoded audio is bigger than Node's default 1 MB pipe buffer for clips over ~11 s.
const PIPE = { maxBuffer: 64 * 1024 * 1024 };
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const style = lang => `A friendly cartoon cat mascot guiding a new learner around a language-learning website. `
  + `Speak natural ${lang === 'uk' ? 'Ukrainian' : 'Russian'} with native pronunciation. Warm, playful and cheerful, a light smile `
  + 'in the voice, clear diction, a lively but unhurried pace. Read the text exactly once. No meowing, purring, singing or sound effects.';
const octopusStyle = () => 'A cheerful cartoon octopus, a grammar teacher, showing a learner several grammar tables at once. '
  + 'Speak natural Russian with native pronunciation; say the English grammar words (be, not, do, does, did, is, there, -s) in English '
  + 'and «Sveiki» in Latvian. Friendly and a little playful, clear diction, an unhurried pace. Read the text exactly once. No sound effects.';

export function buildJobs(lines, voice, styleOf = style) {
  if (!/^[A-Z][a-z]+$/.test(voice)) throw Error('Invalid voice name.');
  return lines.flatMap(line => ['ru', 'uk'].filter(lang => typeof line[lang] === 'string').map(lang => {
    const text = line[lang].trim();
    if (!/^[a-z0-9-]{1,48}$/.test(line.key) || !text || text.length > 400) throw Error(`Invalid tour line ${line.key}.`);
    const request = {
      contents: [{ role: 'user', parts: [{ text, speechMetadata: { style: styleOf(lang) } }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice } } },
    };
    return { key: `${line.key}-${lang}`, line: line.key, lang, text, voice, model, request, request_sha256: hash(JSON.stringify({ model, request })) };
  }));
}

// Deliberately conservative ceilings, not a published price quote: $2/M input and $20/M output.
// Gemini TTS rejects maxOutputTokens. Reserve 32K output tokens before EACH request,
// plus actual usage from all previous receipts. Short-line batch estimate is separate.
export function boundedTourPreflight(jobs, maxUsd) {
  if (!Number.isFinite(maxUsd) || maxUsd <= 0 || !jobs.length) throw Error('A positive tour budget and jobs are required.');
  for (const job of jobs) if (job.text.length > 160) throw Error('Bounded tour lines must be short.');
  const input = job => Buffer.byteLength(JSON.stringify(job.request)) * 2 / 1e6;
  const reserve = Math.max(...jobs.map(job => input(job) + 32768 * 20 / 1e6));
  const estimate = jobs.reduce((sum, job) => sum + input(job) + 1024 * 20 / 1e6, 0);
  if (reserve > maxUsd || estimate > maxUsd) throw Error('Conservative reservation exceeds budget.');
  return { jobs: jobs.length, max_usd: maxUsd, reserve_per_request_usd: reserve, estimated_batch_usd: estimate, input_ceiling_usd_per_million: 2, output_ceiling_usd_per_million: 20 };
}

export function receiptCostCeiling(receipt) {
  const usage = receipt.usage_metadata;
  if (!Number.isFinite(usage?.promptTokenCount) || !Number.isFinite(usage?.candidatesTokenCount)) throw Error('Missing usage: stop bounded generation.');
  return (usage.promptTokenCount * 2 + usage.candidatesTokenCount * 20) / 1e6;
}

async function exists(file) {
  try { await access(file); return true; } catch (error) { if (error.code !== 'ENOENT') throw error; return false; }
}

async function token(file) {
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
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', signal: AbortSignal.timeout(60000),
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signer.sign(credentials.private_key).toString('base64url')}` }),
  });
  const result = await response.json();
  if (!response.ok || typeof result.access_token !== 'string') throw Error(`Google authentication rejected: HTTP ${response.status}.`);
  return { token: result.access_token, project: credentials.project_id };
}

async function cached(directory, job) {
  const stem = path.join(directory, job.key);
  if (await exists(`${stem}.receipt.json`)) {
    const receipt = JSON.parse(await readFile(`${stem}.receipt.json`, 'utf8'));
    if (receipt.request_sha256 !== job.request_sha256 || receipt.file_sha256 !== hash(await readFile(`${stem}.wav`))) throw Error(`Invalid cached clip ${job.key}.`);
    return receipt;
  }
  if (await exists(`${stem}.request.json`)) throw Error(`Unresolved possibly billed request for ${job.key}; no automatic retry.`);
  return null;
}

async function generate(jobs, credentials, directory, budget = null) {
  await mkdir(directory, { recursive: true });
  const pending = [];
  let spentCeiling = 0;
  for (const job of jobs) {
    const receipt = await cached(directory, job);
    if (!receipt) pending.push(job); else if (budget) spentCeiling += receiptCostCeiling(receipt);
  }
  if (!pending.length) return;
  const auth = await token(credentials);
  const url = `https://aiplatform.googleapis.com/v1/projects/${auth.project}/locations/global/publishers/google/models/${model}:generateContent`;
  for (const job of pending) {
    if (budget && spentCeiling + budget.reserve_per_request_usd > budget.max_usd) throw Error('Budget reserve exhausted; no further requests.');
    const stem = path.join(directory, job.key);
    await writeFile(`${stem}.request.json`, json({ key: job.key, voice: job.voice, model, text: job.text, request: job.request, request_sha256: job.request_sha256, started_at: new Date().toISOString() }), { flag: 'wx' });
    let response;
    try {
      response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(240000), headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(job.request) });
    } catch { throw Error(`Network failure for ${job.key}; billing uncertain, no retry.`); }
    const result = await response.json();
    if (!response.ok) { await writeFile(`${stem}.error.json`, json({ http: response.status, status: result.error?.status, message: result.error?.message }), { flag: 'wx' }); throw Error(`Google rejected ${job.key}: HTTP ${response.status}.`); }
    const parts = (result.candidates?.[0]?.content?.parts ?? []).filter(part => part.inlineData?.data);
    if (parts.length !== 1) throw Error(`Unexpected audio for ${job.key}.`);
    const audio = Buffer.from(parts[0].inlineData.data, 'base64');
    if (audio.length < 1024 || audio.toString('ascii', 0, 4) !== 'RIFF') throw Error(`Invalid WAV for ${job.key}.`);
    await writeFile(`${stem}.wav`, audio, { flag: 'wx' });
    await writeFile(`${stem}.receipt.json`, json({ key: job.key, voice: job.voice, model, text: job.text, request_sha256: job.request_sha256, file_sha256: hash(audio), bytes: audio.length, usage_metadata: result.usageMetadata ?? null, generated_at: new Date().toISOString() }), { flag: 'wx' });
    if (budget) {
      spentCeiling += receiptCostCeiling({ usage_metadata: result.usageMetadata });
      await writeFile(path.join(directory, 'budget-usage.json'), json({ ...budget, spent_ceiling_usd: spentCeiling }));
    }
    console.log(`Generated ${job.key} (${job.voice}): ${audio.length} bytes.`);
  }
}

function duration(file) {
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', '24000', 'pipe:1'], PIPE);
  return pcm.length / 4 / 24000;
}

async function publish(jobs, directory, release, base = 'tour') {
  const out = path.join(root, 'frontend/public/audio', base, release);
  await mkdir(out, { recursive: true });
  const clips = {};
  for (const job of jobs) {
    const receipt = await cached(directory, job);
    if (!receipt) throw Error(`Missing ${job.key}; generate first.`);
    const wav = path.join(directory, `${job.key}.wav`);
    const mp3 = execFileSync('ffmpeg', ['-v', 'error', '-i', wav, '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '96k', '-f', 'mp3', 'pipe:1'], PIPE);
    await writeFile(path.join(out, `${job.key}.mp3`), mp3);
    clips[job.key] = { text: job.text, voice: job.voice, seconds: Number(duration(wav).toFixed(2)), url: `/audio/${base}/${release}/${job.key}.mp3`, file_sha256: hash(mp3) };
  }
  await writeFile(path.join(out, 'manifest.json'), json({ provider: 'google', model, release, clips }));
  console.log(`Published ${jobs.length} clips to /audio/${base}/${release}/.`);
}

async function main() {
  const args = process.argv.slice(2);
  const credentials = args.find(a => a.startsWith('--credentials='))?.slice(14);
  const kinds = ['words', 'grammar', 'course', 'chat', 'exams'].filter(kind => args.includes(`--${kind}-tour`));
  if (kinds.length > 1) throw Error('Select exactly one tour per bounded batch.');
  if (kinds.length) {
    const kind = kinds[0];
    const source = JSON.parse(await readFile(path.join(root, `resources/tour/${kind}-tour.json`), 'utf8'));
    const jobs = buildJobs(source.lines, 'Fenrir');
    const budget = Number(args.find(a => a.startsWith('--max-usd='))?.slice(10));
    const preflight = boundedTourPreflight(jobs, budget);
    console.log(JSON.stringify(preflight));
    if (args.includes('--preflight')) return;
    if (!credentials) throw Error('Pass --credentials=<local service account file>.');
    const directory = path.join(root, `.tmp/tour-voice/${source.release}-fenrir${kind === 'words' ? '-v2' : ''}`);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'budget.json'), json(preflight));
    // First create one RU/UK pilot. The complete run reuses those exact receipts.
    const selected = args.includes('--pilot') ? jobs.slice(0, 2) : jobs;
    await generate(selected, credentials, directory, preflight);
    if (!args.includes('--pilot')) await publish(jobs, directory, `${source.release}-fenrir`);
    return;
  }
  if (!credentials) throw Error('Pass --credentials=<local service account file>.');
  if (args.includes('--samples')) {
    for (const voice of SAMPLE_VOICES) {
      const jobs = buildJobs([SAMPLE_TEXT], voice).map(j => ({ ...j, key: `sample-${voice.toLowerCase()}` }));
      const directory = path.join(root, '.tmp/tour-voice/samples');
      await generate(jobs, credentials, directory);
      await publish(jobs, directory, `samples/${voice.toLowerCase()}`);
    }
    return;
  }
  if (args.includes('--tour')) {
    const voice = args.find(a => a.startsWith('--voice='))?.slice(8);
    if (!voice) throw Error('Pass --voice=<name>.');
    const source = JSON.parse(await readFile(path.join(root, 'resources/tour/home-tour.json'), 'utf8'));
    const jobs = buildJobs(source.lines, voice);
    const directory = path.join(root, `.tmp/tour-voice/${source.release}-${voice.toLowerCase()}`);
    await generate(jobs, credentials, directory);
    await publish(jobs, directory, `${source.release}-${voice.toLowerCase()}`);
    return;
  }
  if (args.includes('--octopus')) {
    const source = JSON.parse(await readFile(path.join(root, 'resources/table-bot/octopus-lines.json'), 'utf8'));
    for (const voice of source.voices) {
      const jobs = buildJobs(source.lines, voice, octopusStyle);
      const directory = path.join(root, `.tmp/tour-voice/${source.release}-${voice.toLowerCase()}`);
      await generate(jobs, credentials, directory);
      await publish(jobs, directory, `${source.release}-${voice.toLowerCase()}`, 'table-bot');
    }
    return;
  }
  throw Error('Use --samples, --tour, --words-tour, --grammar-tour, --course-tour, --chat-tour, --exams-tour or --octopus.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
