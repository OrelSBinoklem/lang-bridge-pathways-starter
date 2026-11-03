import test from 'node:test';
import assert from 'node:assert/strict';
import { digest } from './check-listening-revisions.mjs';
import { buildProductiveRevision, rebaseProductiveReviews } from './build-productive-revision.mjs';

function fixture() {
  const before = { title: 'Variant', config: { task_kind: 'roleplay', topic: 'Hello', instruction: 'Say hello.', tutor_prompt: 'Wait.', extra: { unchanged: true } } };
  const row = { level: 'A1', skill: 'speaking', block_type: 'speaking', category_id: 1763,
    page_id: 1, page_slug: 'course-1763-speaking', block_id: 2, variant_id: 3, seed_key: 'variant:1',
    active: true, before, before_sha256: digest(before) };
  const snapshot = { schema_version: 1, variants: [row, { ...structuredClone(row), variant_id: 4, seed_key: 'variant:2', active: false }] };
  const reviews = [{ level: 'A1', reviewed_variant_ids: [3], changes: [{ variant_id: 3, before_sha256: row.before_sha256,
    reason: 'Hidden extra demand.', set: { tutor_prompt: 'Accept a greeting.' } }] }];
  return { snapshot, reviews };
}

test('only requested fields change; archive, titles and metadata preserved', () => {
  const { snapshot, reviews } = fixture();
  const original = structuredClone(snapshot);
  const { manifest, summary } = buildProductiveRevision(snapshot, reviews);
  assert.deepEqual(snapshot, original);
  assert.deepEqual(manifest.entries[0].set, { tutor_prompt: 'Accept a greeting.' });
  assert.equal(manifest.entries[0].after_sha256, digest({ ...original.variants[0].before,
    config: { ...original.variants[0].before.config, tutor_prompt: 'Accept a greeting.' } }));
  assert.deepEqual(manifest.entries[1].set, {});
  assert.equal(manifest.entries[1].after_sha256, original.variants[1].before_sha256);
  assert.deepEqual(summary.A1, { reviewed: 1, changed: 1, archived: 1, writing: 0, speaking: 1 });
});

test('requires complete, unique, same-level active review', () => {
  for (const ids of [[], [3, 3], [4], [99]]) {
    const { snapshot, reviews } = fixture(); reviews[0].reviewed_variant_ids = ids;
    assert.throws(() => buildProductiveRevision(snapshot, reviews));
  }
  const { snapshot, reviews } = fixture(); reviews[0].level = 'A2';
  assert.throws(() => buildProductiveRevision(snapshot, reviews));
});

test('rejects hashes, protected fields, empty and redundant edits', () => {
  for (const set of [{ image_url: 'x' }, { task_kind: 'x' }, { instruction: '' }, { tutor_prompt: 'Wait.' }, {}, []]) {
    const { snapshot, reviews } = fixture(); reviews[0].changes[0].set = set;
    assert.throws(() => buildProductiveRevision(snapshot, reviews));
  }
  const { snapshot, reviews } = fixture(); reviews[0].changes[0].before_sha256 = 'bad';
  assert.throws(() => buildProductiveRevision(snapshot, reviews));
});

test('rejects malformed source and duplicate identities', () => {
  for (const mutate of [s => s.variants.push(s.variants[0]), s => s.variants[0].page_slug = 'exam',
    s => s.variants[0].before.config.instruction = 'changed', s => s.variants[0].block_type = 'reading']) {
    const { snapshot, reviews } = fixture(); mutate(snapshot);
    assert.throws(() => buildProductiveRevision(snapshot, reviews));
  }
});

test('production mapping preserves target IDs and rejects any differing content or archive state', () => {
  const { snapshot, reviews } = fixture();
  const target = structuredClone(snapshot);
  for (const row of target.variants) { row.variant_id += 100; row.page_id += 100; row.block_id += 100; }
  const rebased = rebaseProductiveReviews(snapshot, reviews, target);
  assert.deepEqual(rebased[0].reviewed_variant_ids, [103]);
  assert.equal(buildProductiveRevision(target, rebased).manifest.entries[0].variant_id, 103);
  target.variants[1].active = true;
  assert.throws(() => rebaseProductiveReviews(snapshot, reviews, target));
  target.variants[1].active = false;
  target.variants[1].before.config.topic = 'Edited on production';
  target.variants[1].before_sha256 = digest(target.variants[1].before);
  assert.throws(() => rebaseProductiveReviews(snapshot, reviews, target));
});

test('same seed key in different task kinds is not a duplicate', () => {
  const { snapshot, reviews } = fixture();
  const row = structuredClone(snapshot.variants[0]); row.variant_id = 5; row.block_id = 6;
  row.before.config.task_kind = 'question_formation'; row.before_sha256 = digest(row.before);
  snapshot.variants.push(row); reviews[0].reviewed_variant_ids.push(5);
  assert.equal(buildProductiveRevision(snapshot, reviews).summary.A1.reviewed, 2);
});
