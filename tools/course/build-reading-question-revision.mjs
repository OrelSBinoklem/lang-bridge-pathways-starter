import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildListeningQuestionRevision, rebaseListeningQuestionReviews } from './build-listening-question-revision.mjs';

function validateReadingScope(snapshot, reviews) {
  if (snapshot?.schema_version !== 1 || !Array.isArray(snapshot.variants)) throw new Error('Invalid reading snapshot');
  for (const row of snapshot.variants.filter(row => row.active)) {
    if (row.block_type !== 'reading' || row.before?.config?.task_kind !== 'reading_binary'
      || row.page_slug !== `course-${row.category_id}-reading`
      || typeof row.before.config.text !== 'string' || !row.before.config.text.trim()) {
      throw new Error(`Not an ordinary reading question block: ${row.variant_id}`);
    }
  }
}

export function buildReadingQuestionRevision(snapshot, reviews) {
  validateReadingScope(snapshot, reviews);
  // Reuse the verified ordered question/assistance selection and full-state fingerprinting.
  return buildListeningQuestionRevision(snapshot, reviews, { evidenceKind: 'reading' });
}

export function rebaseReadingQuestionReviews(source, reviews, target) {
  validateReadingScope(source, reviews);
  validateReadingScope(target, reviews);
  return rebaseListeningQuestionReviews(source, reviews, target, { evidenceKind: 'reading' });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [source, directory, output, targetSnapshot] = process.argv.slice(2);
  if (!source || !directory || !output) throw new Error('Usage: <snapshot.json> <review-directory> <new-manifest-in-.tmp.json> [target-snapshot.json]');
  const outputPath = path.resolve(output);
  if (!outputPath.startsWith(path.resolve('.tmp') + path.sep)) throw new Error('Generated manifests belong in .tmp');
  const snapshot = JSON.parse(readFileSync(source, 'utf8'));
  const reviews = ['A1', 'A2', 'B1', 'B2'].map(level => JSON.parse(readFileSync(path.join(directory, `review-${level}.json`), 'utf8')));
  const destination = targetSnapshot ? JSON.parse(readFileSync(targetSnapshot, 'utf8')) : snapshot;
  const result = buildReadingQuestionRevision(destination, targetSnapshot ? rebaseReadingQuestionReviews(snapshot, reviews, destination) : reviews);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(result.manifest, null, 2), { flag: 'wx' });
  writeFileSync(`${outputPath}.report.json`, JSON.stringify({ summary: result.summary, flags: result.flags }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ summary: result.summary, flags: result.flags }));
}
