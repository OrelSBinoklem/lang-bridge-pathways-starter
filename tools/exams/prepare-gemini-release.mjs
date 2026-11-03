import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [manifestPath, output, ...snapshots] = process.argv.slice(2);
if (!manifestPath || !output || !snapshots.length) throw Error('Usage: node prepare-gemini-release.mjs manifest output snapshot...');
const root = resolve('storage/app/private');
const previewRoot = realpathSync(resolve(root, 'exams/previews'));
const pack = JSON.parse(readFileSync(manifestPath, 'utf8'));
const source = snapshots.flatMap(path => JSON.parse(readFileSync(path, 'utf8')).variants);
const jobs = new Map(pack.jobs.map(job => [job.key, job]));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const prepared = new Map();
function encode(path, checksum) {
  const input = realpathSync(resolve(dirname(manifestPath), path));
  const rel = relative(previewRoot, input);
  if (isAbsolute(rel) || rel.startsWith('..')) throw Error('Audio escapes private previews.');
  const original = readFileSync(input);
  if (sha(original) !== checksum) throw Error('Native audio checksum mismatch.');
  if (prepared.has(checksum)) return prepared.get(checksum);
  mkdirSync('.tmp/gemini-release', { recursive: true });
  const encoded = `.tmp/gemini-release/${checksum}.mp3`;
  if (!existsSync(encoded)) execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', input, '-codec:a', 'libmp3lame', '-b:a', '128k', '-n', encoded]);
  execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', encoded, '-f', 'null', '-']);
  const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', encoded], { encoding: 'utf8' }).trim());
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 7200) throw Error('Invalid encoded duration.');
  const bytes = readFileSync(encoded), checksumMp3 = sha(bytes);
  const audioPath = `exams/gemini/${checksumMp3}.mp3`;
  mkdirSync(resolve(root, 'exams/gemini'), { recursive: true });
  const destination = resolve(root, audioPath);
  if (existsSync(destination)) { if (sha(readFileSync(destination)) !== checksumMp3) throw Error('Existing asset differs.'); }
  else writeFileSync(destination, bytes, { flag: 'wx' });
  writeFileSync(`${destination}.inspection.json`, JSON.stringify({ bytes_sha256: checksumMp3, seconds, strict_decode: true }));
  const result = { audio_path: audioPath, audio_seconds: seconds, checksum: checksumMp3, native_sha256: checksum };
  prepared.set(checksum, result);
  return result;
}
function attach(item, path, checksum, keys) {
  const encoded = encode(path, checksum);
  const texts = item.segments ? item.segments.map(segment => segment.text) : [item.prompt];
  const spoken = keys.map(key => { const job = jobs.get(key); if (!job) throw Error('Missing job.'); return job.text; }).join('\n');
  if (texts.join('\n') !== spoken) throw Error('Audio and definition text differ.');
  item.audio_path = encoded.audio_path;
  item.audio_seconds = encoded.audio_seconds;
  item.audio_generation = { version: 3, provider: 'google', model: pack.model_id,
    text_sha256: sha(JSON.stringify(texts)), bytes_sha256: encoded.checksum,
    native_sha256: checksum, request_sha256: keys, voices: [...new Set(keys.flatMap(key => jobs.get(key).voices))] };
}
const variants = pack.variants.map(form => {
  const snapshot = source.find(row => row.position === form.position && (row.level ?? row.content.level ?? 'A1') === form.level);
  if (!snapshot || snapshot.content_sha256 !== form.source_content_sha256) throw Error('Snapshot does not match generated form.');
  const content = structuredClone(snapshot.content);
  for (const task of content.sections[0].tasks) {
    const preview = form.listening.find(row => row.task_id === task.id);
    if (!preview) throw Error('Missing listening task.');
    const checksum = preview.audio.sha256 ?? jobs.get(preview.job_keys[0]).bytes_sha256;
    attach(task, preview.audio.path, checksum, preview.job_keys);
  }
  for (const task of content.sections[3].tasks) for (const question of task.questions) {
    const preview = form.speaking.flatMap(row => row.questions).find(row => row.question_id === question.id);
    if (!preview) throw Error('Missing speaking question.');
    const job = jobs.get(preview.job_key);
    attach(question, job.preview_path, job.bytes_sha256, [job.key]);
  }
  return { level: form.level, position: form.position, expected_sha256: snapshot.content_sha256,
    replace_sections: { listening: content.sections[0], speaking: content.sections[3] } };
});
if (variants.length !== 20) throw Error('Expected 20 exam forms.');
mkdirSync(dirname(resolve(output)), { recursive: true });
writeFileSync(output, JSON.stringify({ revision: 'gemini38-20261011', variants }, null, 2) + '\n');
console.log(JSON.stringify({ forms: variants.length, uniqueMp3: prepared.size, output, speedProcessing: false, paidCalls: 0 }));
