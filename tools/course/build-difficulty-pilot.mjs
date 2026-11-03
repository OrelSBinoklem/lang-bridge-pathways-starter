import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from './check-listening-revisions.mjs';

export function buildDifficultyPilot(local, production, previousPacks, pilots) {
  if (local.source !== 'current_course_select_only' || !Array.isArray(local.reading_baseline) || !Array.isArray(production.variants)) throw new Error('Verified snapshots required');
  const source = new Map(production.variants.map(row => [row.id, row]));
  const before = new Map(previousPacks.flatMap(pack => pack.variants.map(row => [row.variant_id, row])));
  const categories = pilots.map(pack => pack.category_id).sort();
  if (JSON.stringify(categories) !== JSON.stringify([1763, 1764])) throw new Error('Pilot scope is exactly the first two A1 categories');
  const localByKey = new Map();
  for (const row of local.reading_baseline) {
    const key = `${row.category_id}:${row.config.task_kind}:${row.seed_key}`;
    if (localByKey.has(key) || digest(row.config) !== row.config_sha256) throw new Error('Corrupt or ambiguous local baseline');
    localByKey.set(key, row);
  }
  const replacements = new Map();
  for (const pack of pilots) {
    if (pack.schema_version !== 1 || pack.level !== 'A1' || pack.variants?.length !== 10) throw new Error('Each pilot has five reading and five translation variants');
    const kinds = { reading_binary: 0, lv_to_ru: 0 };
    const texts = new Set();
    for (const variant of pack.variants) {
      const old = source.get(variant.variant_id), previous = before.get(variant.variant_id);
      if (!old || !previous || old.category_id !== pack.category_id || old.level !== 'A1' || old.block_id !== variant.block_id) throw new Error('Pilot ownership mismatch');
      const kind = variant.config?.task_kind;
      if (!(kind in kinds) || kind !== previous.config.task_kind || variant.action !== 'rewrite') throw new Error('Immutable task kind or invalid action');
      kinds[kind]++;
      const target = localByKey.get(`${pack.category_id}:${kind}:${old.seed_key}`);
      if (!target || target.level !== 'A1' || target.title !== previous.title || digest(target.config) !== digest(previous.config)) throw new Error('Local editor conflict; do not overwrite');
      if (replacements.has(target.id)) throw new Error('Duplicate pilot target');
      for (const key of ['changes', 'prerequisites', 'target_patterns', 'lexical_notes']) {
        if (!Array.isArray(variant[key]) || !variant[key].length || variant[key].some(value => typeof value !== 'string' || !value.trim())) throw new Error(`Missing editorial ${key}`);
      }
      const protectedBefore = { ...target.config }, protectedAfter = { ...variant.config };
      for (const key of kind === 'reading_binary' ? ['text', 'questions', 'assisted_questions'] : ['source_text', 'reference_translation']) { delete protectedBefore[key]; delete protectedAfter[key]; }
      if (digest(protectedBefore) !== digest(protectedAfter)) throw new Error('Unrelated config field changed');
      const text = kind === 'reading_binary' ? variant.config.text : variant.config.source_text;
      const words = value => (value.match(/\p{L}[\p{L}\p{M}]*/gu) ?? []).length;
      if (typeof text !== 'string' || !text.trim() || /\p{Script=Cyrillic}/u.test(text)) throw new Error('Nonempty Latvian input required');
      if (words(text) > (kind === 'lv_to_ru' ? 12 : 40)) throw new Error('Starter input exceeds reviewed limit');
      if (text.split(/[.!?\n]+/u).some(sentence => words(sentence) > 8)) throw new Error('Starter sentence too long');
      const textKey = `${kind}:${text.normalize('NFC').toLocaleLowerCase('lv')}`;
      if (texts.has(textKey)) throw new Error('Duplicate pilot text');
      texts.add(textKey);
      if (kind === 'reading_binary') {
        const questions = variant.config.questions;
        const assisted = variant.config.assisted_questions;
        if (!Array.isArray(assisted) || assisted.length !== 5 || assisted.some(statement => typeof statement !== 'string' || !statement.trim() || !/\p{Script=Cyrillic}/u.test(statement))) throw new Error('Five matching Russian assisted statements required');
        if (!Array.isArray(questions) || questions.length !== 5 || new Set(questions.map(q => q.statement)).size !== 5) throw new Error('Pilot requires five distinct statements');
        if (Math.abs(2 * questions.filter(q => q.correct === true).length - 5) > 1) throw new Error('Unbalanced starter questions');
        questions.forEach(q => {
          if (typeof q.statement !== 'string' || !q.statement.trim() || words(q.statement) > 8 || /\p{Script=Cyrillic}/u.test(q.statement)
            || typeof q.correct !== 'boolean' || typeof q.explanation !== 'string' || !q.explanation.trim()) throw new Error('Malformed or overloaded starter question');
        });
        if (variant.question_review?.length !== 5 || new Set(variant.question_review.map(review => review.index)).size !== 5) throw new Error('Five evidence reviews required');
        for (const review of variant.question_review) {
          if (!Number.isInteger(review.index) || review.index < 0 || review.index >= 5 || !review.quote?.trim() || !text.includes(review.quote) || !review.rationale?.trim()) throw new Error('Invalid literal answer evidence');
        }
      } else if (typeof variant.config.reference_translation !== 'string' || !/\p{Script=Cyrillic}/u.test(variant.config.reference_translation)) throw new Error('Russian reference required');
      replacements.set(target.id, variant);
    }
    if (kinds.reading_binary !== 5 || kinds.lv_to_ru !== 5) throw new Error('Five variants of each kind required');
  }
  if (replacements.size !== 20) throw new Error('Exactly twenty revised variants required');
  const entries = local.reading_baseline.map(row => {
    const revision = replacements.get(row.id);
    return { variant_id: row.id, block_id: row.block_id, page_id: row.page_id, category_id: row.category_id, level: row.level,
      expected_config_sha256: row.config_sha256, expected_title: row.title, after_sha256: digest(revision?.config ?? row.config),
      title: revision?.title ?? row.title, config: revision?.config ?? row.config, action: revision ? 'rewrite' : 'keep' };
  }).sort((a, b) => a.variant_id - b.variant_id);
  return { schema_version: 1, scope: 'course_reading_revision', entries };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [localPath, productionPath, previousDirectory, pilotDirectory, output] = process.argv.slice(2);
  if (!output) throw new Error('Usage: node tools/course/build-difficulty-pilot.mjs <local-audit> <production-baseline> <previous-reading-directory> <pilot-directory> <new-manifest-in-.tmp>');
  const target = path.resolve(output), temp = path.resolve('.tmp');
  if (!target.startsWith(temp + path.sep) || existsSync(target)) throw new Error('Choose a new .tmp manifest');
  const read = file => JSON.parse(readFileSync(file, 'utf8'));
  const manifest = buildDifficultyPilot(read(localPath), read(productionPath), [1763, 1764].map(id => read(path.join(previousDirectory, 'A1', `${id}.json`))),
    [1763, 1764].map(id => read(path.join(pilotDirectory, 'A1', `${id}.json`))));
  writeFileSync(target, JSON.stringify(manifest, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ complete_reading_variants: manifest.entries.length, changed: 20, categories: 2, database_access: false }));
}
