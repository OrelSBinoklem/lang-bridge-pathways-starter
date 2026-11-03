import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { inspectReadingRevisions } from './check-reading-revisions.mjs';
import { digest } from './check-listening-revisions.mjs';

const [baselinePath, directory, output, localMapPath] = process.argv.slice(2);
if (!baselinePath || !directory || !output) throw new Error('Usage: node tools/course/build-reading-revision-manifest.mjs <baseline.json> <candidate-directory> <new-output-in-.tmp.json> [verified-local-map.json]');
const temp = path.resolve('.tmp'), target = path.resolve(output);
if (!target.startsWith(temp + path.sep)) throw new Error('Manifest must stay inside .tmp');
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const files = readdirSync(directory, { withFileTypes: true }).filter(item => item.isDirectory()).flatMap(item =>
  readdirSync(path.join(directory, item.name)).filter(name => name.endsWith('.json')).map(name => path.join(directory, item.name, name)));
const packs = files.map(file => JSON.parse(readFileSync(file, 'utf8')));
const checked = inspectReadingRevisions(packs, baseline, { requireComplete: true });
if (checked.errors.length) {
  for (const error of checked.errors) console.error(error);
  throw new Error('Reading review failed validation; no manifest written');
}
const old = new Map(baseline.variants.map(row => [row.id, row]));
const localMap = localMapPath ? JSON.parse(readFileSync(localMapPath, 'utf8')).mapping : null;
const ids = new Set();
const entries = packs.flatMap(pack => pack.variants.map(variant => {
  const source = old.get(variant.variant_id);
  const placed = localMap ? localMap[source.id] : source;
  if (!placed || placed.category_id !== source.category_id || placed.level !== source.level || placed.seed_key !== source.seed_key
    || placed.title !== source.title || placed.config_sha256 !== source.config_sha256
    || ![placed.id, placed.block_id, placed.page_id].every(id => Number.isSafeInteger(id) && id > 0)) throw new Error(`Unverified local mapping for ${source.id}`);
  if (ids.has(placed.id)) throw new Error('Duplicate target ID');
  ids.add(placed.id);
  return { variant_id: placed.id, block_id: placed.block_id, page_id: placed.page_id, category_id: source.category_id,
    level: source.level, expected_config_sha256: source.config_sha256, expected_title: source.title,
    after_sha256: digest(variant.config), title: variant.title, config: variant.config, action: variant.action };
})).sort((a, b) => a.variant_id - b.variant_id);
const provenance = { schema_version: 1, scope: 'course_reading_revision_provenance', created_at: new Date().toISOString(),
  id_mapping: localMapPath ? 'verified_local_category_kind_seed_and_content' : 'baseline_ids',
  baseline_sha256: createHash('sha256').update(readFileSync(baselinePath)).digest('hex'),
  source_files: files.map(file => ({ path: file.replaceAll('\\', '/'), sha256: createHash('sha256').update(readFileSync(file)).digest('hex') })),
  warnings: checked.warnings };
const manifest = { schema_version: 1, scope: 'course_reading_revision', entries };
const provenancePath = `${target}.provenance.json`;
if (existsSync(target) || existsSync(provenancePath)) throw new Error('Manifest/provenance already exists; select a new output');
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(provenancePath, JSON.stringify(provenance, null, 2), { flag: 'wx' });
writeFileSync(target, JSON.stringify(manifest, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ variants: entries.length, categories: packs.length,
  actions: entries.reduce((counts, row) => ({ ...counts, [row.action]: (counts[row.action] ?? 0) + 1 }), {}),
  changed: entries.filter(row => row.expected_config_sha256 !== row.after_sha256 || row.expected_title !== row.title).length,
  warnings: checked.warnings.length, database_access: false }));
