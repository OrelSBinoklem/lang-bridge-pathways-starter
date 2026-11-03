import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { inspectListeningRevisions, digest } from './check-listening-revisions.mjs';

const [directory, baselinePath, titlesPath, beforePath, afterPath, output, reviewDirectory] = process.argv.slice(2);
if (!output) throw new Error('Usage: node tools/course/build-listening-review.mjs <candidates> <baseline> <titles> <lexical-before> <lexical-after> <output-in-.tmp.json> [independent-review-directory]');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const target = path.resolve(output);
if (!target.startsWith(path.resolve('.tmp') + path.sep)) throw new Error('Review data must stay in .tmp');
const files = readdirSync(directory, { withFileTypes: true }).filter(d => d.isDirectory()).flatMap(d => readdirSync(path.join(directory, d.name)).filter(f => f.endsWith('.json')).map(f => path.join(directory, d.name, f)));
const packs = files.map(read), baseline = read(baselinePath), titles = read(titlesPath).variants;
const before = read(beforePath), after = read(afterPath);
const checks = inspectListeningRevisions(packs, baseline, titles);
if (checks.errors.length) throw new Error(`Fix ${checks.errors.length} structural errors before exporting a review.`);
if (before.index_revision !== after.index_revision || before.baseline_sha256 !== after.baseline_sha256) throw new Error('Lexical snapshots are not comparable');
const key = row => `${row.category_id}:${row.seed_key}`;
const lookup = rows => new Map(rows.map(row => [key(row), row]));
const old = lookup(baseline), oldTitles = lookup(titles), oldLexical = lookup(before.variants), newLexical = lookup(after.variants);
const candidates = lookup(packs.flatMap(p=>p.variants.map(v=>({...v,category_id:p.category_id}))));
if (new Set(after.variants.map(key)).size !== 190) throw new Error('Revised lexical audit incomplete');
const variants = checks.variants.map(v => {
  const source = old.get(key(v)), candidate = candidates.get(key(v)), b = oldLexical.get(key(v)), a = newLexical.get(key(v));
  if (!b || !a) throw new Error(`Missing lexical comparison ${key(v)}`);
  if (b.config_sha256 !== digest(source.content) || a.config_sha256 !== digest(candidate.config)) throw new Error(`Lexical audit is stale: ${key(v)}`);
  return { ...v, old_title: oldTitles.get(key(v)).title, topic: b.topic, elaipa_topic: b.elaipa_topic,
    speech_old: source.content.transcript, speech_new: candidate.config.transcript,
    questions_old: source.content.questions, questions_new: candidate.config.questions,
    before: { speech: b.speech, statements: b.statements }, after: { speech: a.speech, statements: a.statements } };
});
const levels = ['A1', 'A2', 'B1', 'B2'].map(level => {
  const rows = variants.filter(v=>v.level===level);
  return { level, variants: rows.length, rewrite: rows.filter(v=>v.needs_new_audio).length,
    reuse: rows.filter(v=>!v.needs_new_audio).length,
    old_words: rows.reduce((n,v)=>n+v.old_spoken_words,0), new_words: rows.reduce((n,v)=>n+v.spoken_words,0) };
});
const independentReview = [];
if (reviewDirectory) {
  for (const level of ['A1', 'A2', 'B1', 'B2']) {
    const review = read(path.join(reviewDirectory, `${level.toLowerCase()}-independent-review.json`));
    const reviewed = new Map((review.reviewed_versions ?? []).map(v=>[key(v),v.reviewed_config_sha256]));
    for (const [k,v] of Object.entries(review.reviewed_sha256 ?? {})) reviewed.set(k,v);
    const rows = variants.filter(v=>v.level===level);
    for (const row of rows) if (reviewed.get(key(row)) !== row.revised_content_sha256) throw new Error(`Independent review missing/stale: ${key(row)}`);
    if (review.findings.length) throw new Error(`Unresolved independent review findings: ${level}`);
    independentReview.push({level,variants:rows.length,open_findings:0,
      resolved_findings:review.resolved_during_review ?? review.resolved_findings ?? [],
      limitations:review.limitations});
  }
}
const report = { schema_version: 1, date: new Date().toISOString().slice(0,10), status: 'editorial_candidates_not_published',
  index_revision: before.index_revision, sources: before.sources,
  provenance: { published_text_snapshot_sha256: before.baseline_sha256, title_source: 'local_database_snapshot',
    packages: files.map((file,i)=>({file:file.replaceAll('\\','/'),canonical_sha256:digest(packs[i])})) },
  errors: checks.errors.length, warnings: checks.warnings.length, structural_warnings: checks.warnings,
  limitations: [...checks.limitations, ...before.limitations], independent_review: independentReview, levels, variants };
writeFileSync(target, JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ variants: variants.length, levels, report: output }));
