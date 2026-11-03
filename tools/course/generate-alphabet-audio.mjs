import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import dotenv from '../tutor-gateway/node_modules/dotenv/lib/main.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const source = JSON.parse(await readFile(path.join(root, 'resources/course/alphabet-letter-names.json'), 'utf8'));
const env = dotenv.parse(await readFile(path.join(root, 'tools/tutor-gateway/.env')));
const args = process.argv.slice(2);
const generate = args.includes('--generate');
const only = args.find(arg => arg.startsWith('--only='))?.slice(7).split(',');
const items = source.items.filter(item => !only || only.includes(item.key));
if (!items.length || (only && only.some(key => !source.items.some(item => item.key === key)))) throw Error('Unknown letter key.');
const courseVoices = JSON.parse(await readFile(path.join(root, 'resources/course/listening-pilot-a1-audio.json'), 'utf8'));
const preparedVoice = Object.values(courseVoices)[0]?.['variant:1']?.audio_generation?.voice_ids?.a;
const voice = env.ELEVENLABS_DIALOGUE_VOICE_A_ID || env.ELEVENLABS_TTS_VOICE_ID || preparedVoice;
if (generate && (!env.ELEVENLABS_API_KEY || !voice)) throw Error('ElevenLabs key/voice is not configured.');
const out = path.join(root, 'frontend/public/audio/grammar/alphabet');
const manifestPath = path.join(out, 'manifest.json');
let manifest = { provider: 'elevenlabs', model: 'eleven_v3', language: 'lv', source: source.source, clips: {} };
try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch (cause) { if (cause.code !== 'ENOENT') throw cause; }
console.log(`${generate ? 'Generate' : 'Preview'}: ${items.length} letter names, ${items.reduce((sum, item) => sum + item.name.length + 1, 0)} characters.`);
if (!generate) process.exit(0);
await mkdir(out, { recursive: true });
for (const item of items) {
  const target = path.join(out, `${item.key}.mp3`);
  const digest = createHash('sha256').update(JSON.stringify({ text: `${item.name}.`, voice, model: 'eleven_v3', language: 'lv' })).digest('hex');
  let exists = false;
  try { await access(target); exists = true; } catch (cause) { if (cause.code !== 'ENOENT') throw cause; }
  if (exists) {
    if (manifest.clips[item.key]?.input_sha256 !== digest) throw Error(`Existing audio differs for ${item.key}; review before replacement.`);
    console.log(`Cached: ${item.key}`); continue;
  }
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
    method: 'POST', signal: AbortSignal.timeout(90000),
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `${item.name}.`, model_id: 'eleven_v3', language_code: 'lv',
      voice_settings: { stability: 1 } }),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))).detail;
    const code = typeof detail?.status === 'string' ? detail.status.replace(/[^a-z0-9_-]/gi, '') : 'unknown';
    throw Error(`ElevenLabs HTTP ${response.status} (${code}) for ${item.key}; generation stopped.`);
  }
  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length < 1000) throw Error(`Empty/invalid clip for ${item.key}.`);
  await writeFile(target, audio, { flag: 'wx' });
  manifest.clips[item.key] = { letter: item.letter, name: item.name,
    audio_url: `/audio/grammar/alphabet/${item.key}.mp3`, input_sha256: digest,
    file_sha256: createHash('sha256').update(audio).digest('hex'),
    character_cost: response.headers.get('character-cost'), generated_at: new Date().toISOString() };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated: ${item.key}, ${audio.length} bytes.`);
}
