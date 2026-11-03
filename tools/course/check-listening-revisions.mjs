import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export const digest = value => createHash('sha256').update(JSON.stringify(canonical(value)) ?? 'null').digest('hex');
const words = text => (text.match(/[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*/gu) ?? []).length;
const levelOf = category => category <= 1774 ? 'A1' : category <= 1785 ? 'A2' : category <= 1795 ? 'B1' : 'B2';
const clean = value => typeof value === 'string' && value.trim().length > 0;
const norm = value => value.normalize('NFC').toLocaleLowerCase('lv').replace(/\s+/gu, ' ').trim();

export function inspectListeningRevisions(packs, baseline, titles = [], { requireComplete = true } = {}) {
  const errors = [], warnings = [], rows = [], keys = new Set(), passages = new Map();
  const repeatedSegments = new Map();
  const old = new Map(baseline.map(row => [`${row.category_id}:${row.seed_key}`, row]));
  const names = new Map(titles.map(row => [`${row.category_id}:${row.seed_key}`, row.title]));
  for (const pack of packs) {
    const category = pack.category_id;
    if (!Number.isInteger(category) || category < 1763 || category > 1800 || pack.level !== levelOf(category) || pack.schema_version !== 1) {
      errors.push(`Invalid category/level/schema: ${category}`); continue;
    }
    const variants = Array.isArray(pack.variants) ? pack.variants : [];
    if (variants.length !== 5 || variants.map(v => v.seed_key).sort().join(',') !== 'variant:1,variant:2,variant:3,variant:4,variant:5') errors.push(`${category}: five distinct seed keys required`);
    for (const variant of variants) {
      const key = `${category}:${variant.seed_key}`, source = old.get(key), config = variant.config ?? {};
      const error = text => errors.push(`${key}: ${text}`), warn = text => warnings.push(`${key}: ${text}`);
      if (keys.has(key)) error('duplicate candidate');
      keys.add(key);
      if (!source) { error('no baseline'); continue; }
      if (!['keep', 'questions_only', 'rewrite_dialogue'].includes(variant.action)) error('invalid action');
      if (!clean(variant.title)) error('missing title');
      if (!Array.isArray(variant.findings) || !Array.isArray(variant.changes) || !Array.isArray(variant.target_skills) || !Array.isArray(variant.introduced_vocabulary)) error('missing editorial metadata');
      if (variant.action !== 'keep' && !variant.changes?.length) error('changed variant needs concrete changes');
      const oldText = [names.get(key) ?? '', source.content.transcript ?? '', ...(source.content.questions ?? []).flatMap(q => [q.statement, q.explanation])].join('\n');
      for (const finding of variant.findings ?? []) {
        if (!clean(finding.kind) || !clean(finding.detail) || !clean(finding.old_quote) || !oldText.includes(finding.old_quote)) error('finding needs a verbatim baseline quote');
      }
      if ('audio_url' in config || 'audio_generation' in config) error('candidate must not retain stale audio');
      for (const field of Object.keys(config)) {
        if (['dialogue_segments', 'speaker_profiles', 'transcript', 'questions', 'audio_url', 'audio_generation'].includes(field)) continue;
        if (!(field in source.content) || digest(config[field]) !== digest(source.content[field])) error(`unrelated config field changed: ${field}`);
      }
      const segments = Array.isArray(config.dialogue_segments) ? config.dialogue_segments : [];
      if (segments.length < 2) error('missing dialogue');
      const speakerIds = new Set();
      for (const segment of segments) {
        speakerIds.add(segment.speaker);
        if (!['a', 'b'].includes(segment.speaker) || !clean(segment.text)) error('invalid segment');
        if (/[\p{Script=Cyrillic}\[\]]/u.test(segment.text ?? '')) error('non-Latvian/directorial text in speech');
        if (clean(segment.text) && words(segment.text) >= 7) {
          const normalized = norm(segment.text);
          const occurrences = repeatedSegments.get(normalized) ?? new Set();
          occurrences.add(key);
          repeatedSegments.set(normalized, occurrences);
        }
      }
      if (speakerIds.size !== 2) error('two speakers required');
      for (const speaker of ['a', 'b']) {
        const profile = config.speaker_profiles?.[speaker];
        if (!profile || !clean(profile.name) || !['male', 'female'].includes(profile.gender)) error('missing speaker profile');
      }
      const transcript = segments.map(s => `${String(s.speaker).toUpperCase()}: ${s.text}`).join('\n');
      if (config.transcript !== transcript) error('transcript differs from dialogue segments');
      const changedSpeech = digest(segments) !== digest(source.content.dialogue_segments);
      const changedCast = digest(config.speaker_profiles) !== digest(source.content.speaker_profiles);
      if (variant.action !== 'rewrite_dialogue' && (changedSpeech || changedCast)) error('audio reuse action changes speech or cast');
      if (variant.action === 'rewrite_dialogue' && !changedSpeech && !changedCast) warn('rewrite action has unchanged speech/cast');
      const normalizedSpeech = norm(transcript);
      if (passages.has(normalizedSpeech)) error(`identical dialogue to ${passages.get(normalizedSpeech)}`);
      passages.set(normalizedSpeech, key);
      const questions = Array.isArray(config.questions) ? config.questions : [];
      if (questions.length !== 10 || questions.filter(q => q.correct === true).length !== 5 || questions.filter(q => q.correct === false).length !== 5) error('ten statements with five true and five false required');
      const statements = new Set(), evidence = new Set();
      for (const [qi, question] of questions.entries()) {
        if (!clean(question.statement) || !clean(question.explanation) || typeof question.correct !== 'boolean') { error(`Q${qi + 1}: missing statement/key/explanation`); continue; }
        if (/[\p{Script=Cyrillic}]/u.test(question.statement)) error(`Q${qi + 1}: non-Latvian statement`);
        if (statements.has(norm(question.statement))) error(`Q${qi + 1}: duplicate statement`);
        statements.add(norm(question.statement));
        const proof = question.evidence;
        if (!proof || !clean(proof.quote) || !clean(proof.rationale) || !Array.isArray(proof.segment_indexes) || !proof.segment_indexes.length) {
          error(`Q${qi + 1}: missing evidence`); continue;
        }
        if (proof.segment_indexes.some(i => !Number.isInteger(i) || i < 0 || i >= segments.length)) error(`Q${qi + 1}: invalid evidence index`);
        if (!proof.segment_indexes.some(i => segments[i]?.text.includes(proof.quote))) error(`Q${qi + 1}: quote absent from cited segments`);
        if (evidence.has(norm(proof.quote))) warn(`Q${qi + 1}: repeated evidence quote; inspect fact independence`);
        evidence.add(norm(proof.quote));
        if (!['detail', 'cause', 'purpose', 'contrast', 'stance', 'inference'].includes(question.skill)) error(`Q${qi + 1}: invalid skill`);
      }
      const answerPattern = questions.map(q => q.correct ? 'T' : 'F').join('');
      if (/TTTT|FFFF/.test(answerPattern)) warn('four or more equal answers in a row');
      const deeper = questions.filter(q => q.skill && q.skill !== 'detail').length;
      if (['B1', 'B2'].includes(pack.level) && deeper < 3) warn('fewer than three non-detail questions; inspect level fit');
      const spokenWords = words(segments.map(s => s.text).join(' '));
      const oldWords = words(source.content.dialogue_segments.map(s => s.text).join(' '));
      const questionsChanged = digest(questions.map(({ evidence, skill, ...q }) => q)) !== digest(source.content.questions);
      if (variant.action === 'keep' && (questionsChanged || variant.title !== names.get(key))) error('keep action changes questions or title');
      rows.push({ category_id: category, level: pack.level, seed_key: variant.seed_key, title: variant.title,
        action: variant.action, expected_content_sha256: digest(source.content),
        revised_content_sha256: digest(config), speech_sha256: digest(segments),
        needs_new_audio: changedSpeech || changedCast, old_spoken_words: oldWords, spoken_words: spokenWords,
        approximate_minutes_at_100_wpm: +(spokenWords / 100).toFixed(2), answer_pattern: answerPattern,
        deeper_questions: deeper, findings: variant.findings, changes: variant.changes });
    }
  }
  if (requireComplete) {
    if (keys.size !== 190 || old.size !== 190) errors.push('Full course requires exactly 190 baseline/candidate variants');
    for (const key of old.keys()) if (!keys.has(key)) errors.push(`${key}: missing candidate`);
  }
  const repeatedSpeech = [...repeatedSegments.entries()].filter(([, ids]) => ids.size >= 5)
    .map(([text, ids]) => ({ text, variants: [...ids] }));
  for (const entry of repeatedSpeech) warnings.push(`Repeated speech in ${entry.variants.length} variants: ${entry.text}`);
  return { schema_version: 1, errors, warnings, variants: rows, repeated_speech: repeatedSpeech,
    limitations: ['Checks evidence quotations, not logical entailment or Latvian correctness.',
      'Question skill labels are editorial assertions, not independent CEFR certification.',
      'Time at 100 words/minute is a text estimate excluding pauses, not measured audio.'] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [directory, baselinePath, titlesPath, output] = process.argv.slice(2);
  if (!directory || !baselinePath || !titlesPath || !output) throw new Error('Usage: node tools/course/check-listening-revisions.mjs <candidate-dir> <baseline.json> <titles-source.json> <output-in-.tmp.json>');
  const temp = path.resolve('.tmp'), target = path.resolve(output);
  if (!target.startsWith(temp + path.sep)) throw new Error('Report must stay inside .tmp');
  const packs = readdirSync(directory, { withFileTypes: true }).filter(d => d.isDirectory()).flatMap(d =>
    readdirSync(path.join(directory, d.name)).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(path.join(directory, d.name, f), 'utf8'))));
  const report = inspectListeningRevisions(packs, JSON.parse(readFileSync(baselinePath, 'utf8')), JSON.parse(readFileSync(titlesPath, 'utf8')).variants);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ variants: report.variants.length, errors: report.errors.length, warnings: report.warnings.length }));
  for (const error of report.errors) console.error(error);
  if (report.errors.length) process.exitCode = 1;
}
