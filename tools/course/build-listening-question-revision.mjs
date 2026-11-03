import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from './check-listening-revisions.mjs';

export function buildListeningQuestionRevision(snapshot, reviews, { evidenceKind = 'listening' } = {}) {
  if (!['listening', 'reading'].includes(evidenceKind)) throw new Error('Invalid evidence kind');
  if (snapshot.schema_version !== 1 || !Array.isArray(snapshot.variants)) throw new Error('Invalid snapshot');
  const active = snapshot.variants.filter(row => row.active);
  const decisions = new Map();
  for (const pack of reviews) {
    if (!['A1', 'A2', 'B1', 'B2'].includes(pack.level) || !Array.isArray(pack.reviews)) throw new Error('Invalid review');
    for (const review of pack.reviews) {
      if (decisions.has(review.variant_id)) throw new Error(`Duplicate review: ${review.variant_id}`);
      decisions.set(review.variant_id, { ...review, level: pack.level });
    }
  }
  if (decisions.size !== active.length || new Set(active.map(row => row.variant_id)).size !== active.length) throw new Error('Review scope mismatch');
  const summary = {};
  const flags = [];
  const entries = active.map(row => {
    const review = decisions.get(row.variant_id);
    const fail = message => { throw new Error(`${row.variant_id}: ${message}`); };
    if (!review || review.level !== row.level) fail('Missing or wrong-level review');
    if (digest(row.before) !== row.before_sha256) fail('Snapshot fingerprint mismatch');
    if (review.before_sha256 !== row.before_sha256) fail('Review refers to another source version');
    if (typeof review.reason !== 'string' || !review.reason.trim() || !Array.isArray(review.flags)) fail('Missing editorial review');
    const questions = row.before.config.questions;
    if (!Array.isArray(questions)) fail('Missing questions');
    const keep = review.keep;
    if (!Array.isArray(keep) || keep.length < 5 || keep.length > 10 || keep.some((n, i) =>
      !Number.isInteger(n) || n < 1 || n > questions.length || (i > 0 && n <= keep[i - 1]))) fail('Invalid retained indices');
    const removed = questions.map((_, i) => i + 1).filter(i => !keep.includes(i));
    if (!Array.isArray(review.removed) || review.removed.length !== removed.length
      || new Set(review.removed.map(item => item.index)).size !== removed.length
      || review.removed.some(item => !removed.includes(item.index) || typeof item.reason !== 'string' || !item.reason.trim())) fail('Every removal needs a distinct reason');
    const after = structuredClone(row.before);
    after.config.questions = keep.map(i => structuredClone(questions[i - 1]));
    if (after.config.questions.some(q => typeof q.correct !== 'boolean')
      || new Set(after.config.questions.map(q => q.correct)).size !== 2) fail('Both yes/no answers required');
    if ('assisted_questions' in after.config) {
      if (!Array.isArray(after.config.assisted_questions) || after.config.assisted_questions.length !== questions.length) fail('Assisted question alignment mismatch');
      after.config.assisted_questions = keep.map(i => after.config.assisted_questions[i - 1]);
    }
    const evidence = review.explanation_evidence ?? [];
    if (!Array.isArray(evidence) || new Set(evidence.map(item => item.index)).size !== evidence.length) fail('Invalid explanation corrections');
    const speech = (evidenceKind === 'reading' ? [row.before.config.text]
      : [row.before.config.transcript, ...(row.before.config.dialogue_segments ?? []).map(segment => segment.text)]).filter(text => typeof text === 'string');
    for (const item of evidence) {
      if (!keep.includes(item.index) || !Array.isArray(item.quotes) || item.quotes.length < 1 || item.quotes.length > 3
        || item.quotes.some(quote => typeof quote !== 'string' || !quote.trim() || quote.length > 1000 || !speech.some(text => text.includes(quote)))) fail('Explanation must quote the recording for a retained question');
      after.config.questions[keep.indexOf(item.index)].explanation = `${evidenceKind === 'reading' ? 'Tekstā' : 'Sarunā'}: ${item.quotes.join(' / ')}`;
    }
    const stats = summary[row.level] ??= { reviewed: 0, changed: 0, before: 0, after: 0, counts: {} };
    stats.reviewed++;
    stats.changed += digest(after) !== row.before_sha256 ? 1 : 0;
    stats.before += questions.length;
    stats.after += keep.length;
    stats.counts[keep.length] = (stats.counts[keep.length] ?? 0) + 1;
    flags.push(...review.flags.map(flag => ({ variant_id: row.variant_id, flag })));
    return {
      level: row.level, category_id: row.category_id, page_id: row.page_id, page_slug: row.page_slug,
      block_id: row.block_id, variant_id: row.variant_id, seed_key: row.seed_key,
      before_sha256: row.before_sha256, before: row.before, keep, explanation_evidence: evidence, after_sha256: digest(after),
    };
  });
  return { manifest: { schema_version: 1, entries }, summary, flags };
}

export function rebaseListeningQuestionReviews(source, reviews, target, options = {}) {
  buildListeningQuestionRevision(source, reviews, options);
  const key = row => `${row.category_id}:${row.seed_key}`;
  const targetRows = new Map(target.variants.filter(row => row.active).map(row => [key(row), row]));
  const sourceRows = source.variants.filter(row => row.active);
  if (targetRows.size !== sourceRows.length || target.variants.filter(row => row.active).length !== targetRows.size) throw new Error('Target active scope mismatch');
  const comparable = row => {
    const before = structuredClone(row.before);
    if (before.config.authoring) {
      // These IDs and their source receipt differ between installations; retain the target values.
      delete before.config.authoring.target_word_ids;
      delete before.config.authoring.source_sha256;
    }
    return { level: row.level, page_slug: row.page_slug, before };
  };
  const mapping = new Map(sourceRows.map(row => {
    const placed = targetRows.get(key(row));
    if (!placed || digest(comparable(row)) !== digest(comparable(placed))) throw new Error(`Target content differs: ${key(row)}`);
    return [row.variant_id, placed];
  }));
  return reviews.map(pack => ({ ...pack, reviews: pack.reviews.map(review => {
    const placed = mapping.get(review.variant_id);
    if (!placed) throw new Error('Unmapped review');
    return { ...review, variant_id: placed.variant_id, before_sha256: placed.before_sha256 };
  }) }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [source, directory, output, targetSnapshot] = process.argv.slice(2);
  if (!source || !directory || !output) throw new Error('Usage: <snapshot.json> <review-directory> <new-manifest-in-.tmp.json>');
  const target = path.resolve(output);
  if (!target.startsWith(path.resolve('.tmp') + path.sep)) throw new Error('Generated manifests belong in .tmp');
  const snapshot = JSON.parse(readFileSync(source, 'utf8'));
  const reviews = ['A1', 'A2', 'B1', 'B2'].map(level => JSON.parse(readFileSync(path.join(directory, `review-${level}.json`), 'utf8')));
  const destination = targetSnapshot ? JSON.parse(readFileSync(targetSnapshot, 'utf8')) : snapshot;
  const result = buildListeningQuestionRevision(destination, targetSnapshot ? rebaseListeningQuestionReviews(snapshot, reviews, destination) : reviews);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(result.manifest, null, 2), { flag: 'wx' });
  writeFileSync(`${target}.report.json`, JSON.stringify({ summary: result.summary, flags: result.flags }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ summary: result.summary, flags: result.flags }));
}
