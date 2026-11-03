import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const levels = {
  A2: { points: 15, seconds: 1500, matrix: [5, 5, 5] },
  B1: { points: 20, seconds: 2400, matrix: [7, 7, 6] },
  B2: { points: 25, seconds: 2400, matrix: [9, 8, 8] },
};

export function inspectListeningPack(pack) {
  const errors = [], warnings = [], variants = [], allIds = new Set(), passages = new Map();
  const entries = Array.isArray(pack?.variants) ? pack.variants : [];
  if (entries.length !== 5 || JSON.stringify(entries.map(e => e.position).sort()) !== '[1,2,3,4,5]') errors.push('Exactly five variants, positions 1-5, are required.');
  if (new Set(entries.map(e => e.level)).size !== 1) errors.push('One level per listening pack is required.');
  for (const entry of entries) {
    const label = `${entry.level} #${entry.position}`, expected = levels[entry.level];
    const section = entry.replace_sections?.listening;
    if (JSON.stringify(Object.keys(entry.replace_sections ?? {})) !== '["listening"]' || entry.question_changes?.length) errors.push(`${label}: listening-only scope required.`);
    if (!expected || section?.skill !== 'listening') { errors.push(`${label}: invalid listening section.`); continue; }
    if (!/^[a-f0-9]{64}$/.test(entry.expected_sha256 ?? '')) errors.push(`${label}: baseline hash missing.`);
    if (section.seconds !== expected.seconds) errors.push(`${label}: timer changed.`);
    if (JSON.stringify((section.tasks ?? []).map(t => t.questions?.length)) !== JSON.stringify(expected.matrix)) errors.push(`${label}: question matrix changed.`);
    let points = 0, characters = 0, words = 0;
    for (const task of section.tasks ?? []) {
      for (const id of [task.id, ...(task.questions ?? []).map(q => q.id)]) {
        if (!/^[a-z0-9_-]+$/.test(id ?? '') || allIds.has(id)) errors.push(`${label}: invalid/duplicate ID ${id}.`);
        allIds.add(id);
      }
      if (!task.segments?.length) errors.push(`${task.id}: empty speech.`);
      let taskCharacters = 0;
      for (const segment of task.segments ?? []) {
        if (!['male', 'female'].includes(segment.speaker) || typeof segment.text !== 'string' || !segment.text.trim()) errors.push(`${task.id}: invalid speaker/text.`);
        if (/[\[\]\p{Script=Cyrillic}]/u.test(segment.text ?? '')) errors.push(`${task.id}: keep tags/directorial text out of the transcript.`);
        if (segment.delivery != null && !['calm', 'thoughtful', 'friendly'].includes(segment.delivery)) errors.push(`${task.id}: unsupported delivery.`);
        if (segment.pace != null && segment.pace !== 'slow') errors.push(`${task.id}: unsupported speech pace.`);
        taskCharacters += [...String(segment.text ?? '').trim()].length + (segment.delivery ? [...`[${segment.delivery}] `].length : 0);
      }
      const transcript = (task.segments ?? []).map(s => String(s.text ?? '').trim()).join('\n');
      if (task.transcript !== transcript) errors.push(`${task.id}: transcript does not equal clean speech.`);
      if (taskCharacters > 5000) errors.push(`${task.id}: exceeds safety character limit.`);
      const normalized = transcript.toLocaleLowerCase('lv').replace(/\s+/gu, ' ').trim();
      if (passages.has(normalized)) errors.push(`${task.id}: identical passage to ${passages.get(normalized)}.`);
      passages.set(normalized, task.id);
      characters += taskCharacters;
      words += (transcript.match(/[\p{L}\p{M}]+/gu) ?? []).length;
      for (const q of task.questions ?? []) {
        if (!(Number.isFinite(q.points) && q.points > 0)) errors.push(`${q.id}: invalid points.`);
        points += q.points;
        if (q.type === 'choice') {
          const options = q.options ?? [];
          if (options.length < 2 || new Set(options.map(o => o.id)).size !== options.length || !options.some(o => o.id === q.correct)) errors.push(`${q.id}: invalid choices/key.`);
          if (new Set(options.map(o => o.text)).size !== options.length) errors.push(`${q.id}: duplicate option text.`);
        } else if (q.type !== 'short' || !q.accepted?.length) errors.push(`${q.id}: objective key required.`);
        for (const text of [q.prompt, q.explanation, ...(q.options ?? []).map(o => o.text)]) {
          if (/[\p{Script=Cyrillic}]/u.test(text ?? '')) warnings.push(`${q.id}: Cyrillic in Latvian field.`);
        }
        if (!q.explanation?.trim()) errors.push(`${q.id}: evidence comment missing.`);
        for (const lang of ['ru', 'uk']) if (!q.explanation_translations?.[lang]?.trim()) errors.push(`${q.id}: missing ${lang} comment translation.`);
      }
    }
    if (points !== expected.points) errors.push(`${label}: section points changed.`);
    variants.push({ level: entry.level, position: entry.position, minutes: section.seconds / 60, points, spoken_words: words, input_characters: characters });
  }
  return { revision: pack.revision, errors, warnings, variants,
    limitations: 'Structural checks and exact passage duplication only; semantic evidence, gender consistency, pronunciation, pace and CEFR calibration need editorial review.' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const paths = process.argv.slice(2);
  if (!paths.length) paths.push(...['a2', 'b1', 'b2'].map(l => `resources/course/exams/revisions/2026-10-03-${l}-listening.json`));
  const reports = paths.map(file => inspectListeningPack(JSON.parse(readFileSync(path.resolve(root, file), 'utf8'))));
  mkdirSync(path.join(root, '.tmp/exam-listening-revisions'), { recursive: true });
  writeFileSync(path.join(root, '.tmp/exam-listening-revisions/quality-check.json'), JSON.stringify(reports, null, 2));
  for (const r of reports) {
    console.log(`${r.revision}: ${r.errors.length} errors; ${r.warnings.length} flags; ${r.variants.reduce((s, v) => s + v.input_characters, 0)} input characters.`);
    for (const error of r.errors) console.error(error);
  }
  if (reports.some(r => r.errors.length)) process.exitCode = 1;
}
