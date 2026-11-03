import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from './check-listening-revisions.mjs';

const levels = ['A1', 'A2', 'B1', 'B2'];
const fields = ['instruction', 'topic', 'tutor_prompt'];
const kinds = { writing: ['ru_to_lv', 'image_description', 'question_formation'], speaking: ['roleplay', 'question_formation'] };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const key = row => [row.category_id, row.skill, row.before.config.task_kind, row.seed_key].join(':');

function validateSnapshot(snapshot) {
  if (snapshot?.schema_version !== 1 || !Array.isArray(snapshot.variants) || !snapshot.variants.length) throw new Error('Invalid snapshot');
  const ids = new Set(), keys = new Set();
  for (const row of snapshot.variants) {
    if (!levels.includes(row.level) || !kinds[row.skill]?.includes(row.before?.config?.task_kind)
      || row.block_type !== row.skill || row.page_slug !== `course-${row.category_id}-${row.skill}`
      || typeof row.active !== 'boolean' || !object(row.before?.config)
      || typeof row.before.title !== 'string' || typeof row.seed_key !== 'string' || !row.seed_key
      || ['category_id', 'page_id', 'block_id', 'variant_id'].some(field => !Number.isSafeInteger(row[field]) || row[field] < 1)
      || digest(row.before) !== row.before_sha256) throw new Error(`Invalid snapshot row: ${row.variant_id}`);
    if (ids.has(row.variant_id) || keys.has(key(row))) throw new Error('Duplicate snapshot identity');
    ids.add(row.variant_id); keys.add(key(row));
  }
}

export function buildProductiveRevision(snapshot, reviews) {
  validateSnapshot(snapshot);
  const rows = new Map(snapshot.variants.map(row => [row.variant_id, row]));
  const reviewed = new Set(), changes = new Map(), reviewLevels = new Set();
  for (const pack of reviews) {
    if (!levels.includes(pack.level) || reviewLevels.has(pack.level)
      || !Array.isArray(pack.reviewed_variant_ids) || !Array.isArray(pack.changes)) throw new Error('Invalid review pack');
    reviewLevels.add(pack.level);
    for (const id of pack.reviewed_variant_ids) {
      const row = rows.get(id);
      if (!row?.active || row.level !== pack.level || reviewed.has(id)) throw new Error(`Invalid reviewed variant: ${id}`);
      reviewed.add(id);
    }
    for (const change of pack.changes) {
      const row = rows.get(change.variant_id);
      if (!row?.active || row.level !== pack.level || !pack.reviewed_variant_ids.includes(row.variant_id)
        || changes.has(row.variant_id) || change.before_sha256 !== row.before_sha256
        || typeof change.reason !== 'string' || !change.reason.trim() || !object(change.set)
        || !Object.keys(change.set).length) throw new Error(`Invalid editorial change: ${change.variant_id}`);
      for (const [field, value] of Object.entries(change.set)) {
        if (!fields.includes(field) || typeof value !== 'string' || !value.trim() || value.length > 20000
          || value === row.before.config[field]) throw new Error(`Invalid or redundant field patch: ${change.variant_id}/${field}`);
      }
      changes.set(row.variant_id, change);
    }
  }
  if (reviewed.size !== snapshot.variants.filter(row => row.active).length) throw new Error('Incomplete active editorial review');
  const summary = {};
  const entries = snapshot.variants.map(row => {
    const change = changes.get(row.variant_id);
    const set = change?.set ?? {};
    const after = structuredClone(row.before);
    Object.assign(after.config, set);
    const stats = summary[row.level] ??= { reviewed: 0, changed: 0, archived: 0, writing: 0, speaking: 0 };
    if (row.active) stats.reviewed++; else stats.archived++;
    if (change) { stats.changed++; stats[row.skill]++; }
    return {
      level: row.level, skill: row.skill, category_id: row.category_id, page_id: row.page_id,
      page_slug: row.page_slug, block_id: row.block_id, variant_id: row.variant_id,
      seed_key: row.seed_key, active: row.active, before_sha256: row.before_sha256,
      before: row.before, set, after_sha256: digest(after),
    };
  });
  return { manifest: { schema_version: 1, entries }, summary };
}

export function rebaseProductiveReviews(source, reviews, target) {
  buildProductiveRevision(source, reviews);
  validateSnapshot(target);
  if (source.variants.length !== target.variants.length) throw new Error('Target scope differs');
  const targetRows = new Map(target.variants.map(row => [key(row), row]));
  const mapping = new Map(source.variants.map(row => {
    const placed = targetRows.get(key(row));
    if (!placed || row.level !== placed.level || row.active !== placed.active
      || row.before_sha256 !== placed.before_sha256) throw new Error(`Target content differs: ${key(row)}`);
    return [row.variant_id, placed];
  }));
  return reviews.map(pack => ({ ...pack,
    reviewed_variant_ids: pack.reviewed_variant_ids.map(id => mapping.get(id).variant_id),
    changes: pack.changes.map(change => ({ ...change, variant_id: mapping.get(change.variant_id).variant_id,
      before_sha256: mapping.get(change.variant_id).before_sha256 })),
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [source, directory, output, target] = process.argv.slice(2);
  if (!source || !directory || !output) throw new Error('Usage: <source-snapshot> <review-directory> <new-output-in-.tmp> [target-snapshot]');
  const outputPath = path.resolve(output);
  if (!outputPath.startsWith(path.resolve('.tmp') + path.sep)) throw new Error('Generated manifests belong in .tmp');
  const snapshot = JSON.parse(readFileSync(source, 'utf8'));
  const reviews = levels.map(level => JSON.parse(readFileSync(path.join(directory, `review-${level}.json`), 'utf8')));
  const destination = target ? JSON.parse(readFileSync(target, 'utf8')) : snapshot;
  const result = buildProductiveRevision(destination, target ? rebaseProductiveReviews(snapshot, reviews, destination) : reviews);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(result.manifest, null, 2), { flag: 'wx' });
  writeFileSync(`${outputPath}.report.json`, JSON.stringify(result.summary, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(result.summary));
}
