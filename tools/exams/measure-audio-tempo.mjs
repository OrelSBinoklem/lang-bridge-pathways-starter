import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, realpathSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function pauseExcludedDuration(log, duration) {
  if (!Number.isFinite(duration) || duration <= 0) throw Error('Invalid duration.');
  const gaps = []; let start = null;
  for (const line of log.split(/\r?\n/)) {
    const beginning = line.match(/silence_start:\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)/i);
    if (beginning) start = Number(beginning[1]);
    const end = line.match(/silence_end:\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)/i);
    if (end && start !== null) { gaps.push([start, Number(end[1])]); start = null; }
  }
  if (start !== null) gaps.push([start, duration]);
  let quiet = 0, previousEnd = 0;
  for (const [rawStart, rawEnd] of gaps) {
    if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) throw Error('Invalid silence timestamp.');
    const a = Math.max(0, previousEnd, rawStart), b = Math.min(duration, rawEnd);
    if (b > a) quiet += b - a;
    previousEnd = Math.max(previousEnd, b);
  }
  const active = duration - quiet;
  if (active <= 0) throw Error('No active speech estimate; review manually.');
  return { activeSeconds: active, quietSeconds: quiet };
}

export function lexicalWords(text) {
  if (typeof text !== 'string' || /[\[\]]/u.test(text)) throw Error('Clean transcript required.');
  return (text.match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*|\d+/gu) ?? []).length;
}

export function measureRecording(row) {
  const words = lexicalWords(row.transcript);
  if (!words) throw Error('Empty transcript.');
  const run = (binary, args) => {
    const result = spawnSync(binary, args, { encoding: 'utf8', maxBuffer: 12e6 });
    if (result.error || result.status !== 0) throw Error(`${binary} failed; no tempo result.`);
    return result;
  };
  const audio = realpathSync(row.path);
  const duration = Number(JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', audio]).stdout).format.duration);
  const measurements = [-40, -35, -30].map(threshold => {
    const result = run('ffmpeg', ['-v', 'info', '-nostats', '-xerror', '-i', audio, '-af', `silencedetect=noise=${threshold}dB:d=0.2`, '-f', 'null', '-']);
    const span = pauseExcludedDuration(result.stderr, duration);
    return { thresholdDb: threshold, ...span, wpm: words * 60 / span.activeSeconds };
  });
  return { voice: row.voice_key ?? null, path: audio, bytesSha256: createHash('sha256').update(readFileSync(audio)).digest('hex'),
    words, duration, targetWpm: 100, wpm: measurements[1].wpm, measurements,
    warnings: /\d/u.test(row.transcript) ? ['Numerals counted as written tokens; expand spoken numbers before relying on WPM.'] : [],
    method: 'Silencedetect >=0.2s; central -35dB, sensitivity -40/-30dB. Not an ASR/VAD phonetic measurement. Naturalness requires listening.' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [manifest, output] = process.argv.slice(2);
  if (!manifest || !output) throw Error('Usage: node tools/exams/measure-audio-tempo.mjs manifest.json .tmp/report.json');
  const root = realpathSync(fileURLToPath(new URL('../../.tmp', import.meta.url)));
  const directory = realpathSync(path.dirname(output));
  const destination = path.join(directory, path.basename(output));
  const relative = path.relative(root, existsSync(destination) ? realpathSync(destination) : destination);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Write reports only inside repository .tmp.');
  if (path.resolve(destination) === realpathSync(manifest)) throw Error('Do not overwrite the input manifest.');
  const rows = JSON.parse(readFileSync(manifest, 'utf8'));
  const report = rows.map(measureRecording);
  writeFileSync(destination, JSON.stringify(report, null, 2));
  for (const row of report) console.log(`${row.voice ?? row.path}: ${Math.round(row.wpm)} wpm; ${row.words} written words; ${row.duration.toFixed(2)}s total.`);
}
