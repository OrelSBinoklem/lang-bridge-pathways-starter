import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const levels = {
  A2: { points: 15, seconds: 1800, matrix: [4, 6, 5] },
  B1: { points: 20, seconds: 2400, matrix: [5, 4, 5, 6] },
  B2: { points: 25, seconds: 2400, matrix: [4, 6, 8, 7] },
};
const wordCount = text => (String(text ?? '').match(/[\p{L}\p{M}]+/gu) ?? []).length;

export function inspectReadingPack(pack) {
  const errors = [], warnings = [], variants = [], signatures = [], allIds = new Set();
  const entries = Array.isArray(pack?.variants) ? pack.variants : [];
  if (entries.length !== 5) errors.push('Pack must contain five independent variants.');
  const positions = entries.map(entry => entry.position).sort((a, b) => a - b);
  if (JSON.stringify(positions) !== '[1,2,3,4,5]') errors.push('Positions must be 1-5 exactly once.');
  if (new Set(entries.map(entry => entry.level)).size !== 1) errors.push('Use one level per reading pack.');
  for (const entry of entries) {
    const label = `${entry.level} #${entry.position}`;
    const expected = levels[entry.level];
    const section = entry.replace_sections?.reading;
    if (Object.keys(entry.replace_sections ?? {}).some(skill => skill !== 'reading') || entry.question_changes?.length) {
      errors.push(`${label}: reading packs must not patch other skills or questions outside the section.`);
    }
    if (!expected || !section || section.skill !== 'reading') { errors.push(`${label}: missing reading section.`); continue; }
    if (section.seconds !== expected.seconds) errors.push(`${label}: wrong timer.`);
    if (!/^[a-f0-9]{64}$/.test(entry.expected_sha256 ?? '')) errors.push(`${label}: missing baseline hash.`);
    const ids = new Set(), keys = new Set(), tasks = [];
    let points = 0;
    for (const task of section.tasks ?? []) {
      if (ids.has(task.id) || allIds.has(task.id)) errors.push(`${label}: duplicate ID ${task.id}.`);
      ids.add(task.id); allIds.add(task.id);
      let taskPoints = 0;
      for (const q of task.questions ?? []) {
        if (ids.has(q.id) || allIds.has(q.id)) errors.push(`${label}: duplicate ID ${q.id}.`);
        ids.add(q.id); allIds.add(q.id);
        if (!Number.isFinite(q.points) || q.points <= 0) errors.push(`${q.id}: invalid points.`);
        taskPoints += q.points;
        const options = q.options ?? [];
        if (q.type === 'choice') {
          if (options.length < 2 || new Set(options.map(o => o.id)).size !== options.length) errors.push(`${q.id}: invalid option IDs.`);
          if (!options.some(o => o.id === q.correct)) errors.push(`${q.id}: key not among options.`);
          if (new Set(options.map(o => o.text)).size !== options.length) errors.push(`${q.id}: duplicate options.`);
        } else if (q.type === 'short') {
          if (!q.accepted?.length) errors.push(`${q.id}: no accepted answers.`);
        } else errors.push(`${q.id}: reading must use objective questions.`);
        if (!q.explanation?.trim()) errors.push(`${q.id}: no editorial evidence.`);
        for (const lang of ['ru', 'uk']) if (!q.explanation_translations?.[lang]?.trim()) errors.push(`${q.id}: missing ${lang} translation.`);
        const lv = [q.prompt, q.explanation, ...options.map(o => o.text)].join('\n');
        if (/[\p{Script=Cyrillic}]/u.test(lv)) warnings.push(`${q.id}: Cyrillic text in Latvian fields; review required.`);
        keys.add(JSON.stringify({ type: q.type, prompt: q.prompt, points: q.points, options, correct: q.correct, accepted: q.accepted }));
      }
      points += taskPoints;
      tasks.push({ id: task.id, body_words: wordCount(task.text), questions: task.questions?.length ?? 0, points: taskPoints });
      if (/[\p{Script=Cyrillic}]/u.test(task.text ?? '')) warnings.push(`${task.id}: Cyrillic text in passage; review required.`);
    }
    if (points !== expected.points) errors.push(`${label}: ${points} points instead of ${expected.points}.`);
    if (JSON.stringify(tasks.map(task => task.questions)) !== JSON.stringify(expected.matrix)) {
      errors.push(`${label}: question matrix must be ${expected.matrix.join('+')}.`);
    }
    variants.push({ level: entry.level, position: entry.position, minutes: section.seconds / 60, points,
      body_words: tasks.reduce((sum, task) => sum + task.body_words, 0), tasks });
    signatures.push(keys);
  }
  const shared = signatures.length === 5 ? [...signatures[0]].filter(key => signatures.every(set => set.has(key))).length : null;
  return { revision: pack.revision, errors, warnings, variants, shared_questions_across_all_five: shared,
    limitations: 'Exact repetitions only; no proof of semantic independence, correct Latvian, CEFR calibration or real learner vocabulary.' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const paths = process.argv.slice(2);
  if (!paths.length) paths.push(...['a2', 'b1', 'b2'].map(level => `resources/course/exams/revisions/2026-10-03-${level}-reading.json`));
  const reports = paths.map(file => inspectReadingPack(JSON.parse(readFileSync(path.resolve(root, file), 'utf8'))));
  const output = path.join(root, '.tmp/exam-reading-revisions');
  mkdirSync(output, { recursive: true });
  writeFileSync(path.join(output, 'quality-check.json'), `${JSON.stringify(reports, null, 2)}\n`);
  for (const report of reports) {
    console.log(`${report.revision}: ${report.variants.length} variants, ${report.errors.length} errors, ${report.warnings.length} review flags.`);
    for (const error of report.errors) console.error(error);
    for (const warning of report.warnings) console.warn(warning);
  }
  if (reports.some(report => report.errors.length)) process.exitCode = 1;
}
