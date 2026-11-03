import test from 'node:test';
import assert from 'node:assert/strict';
import { buildListeningQuestionRevision, rebaseListeningQuestionReviews } from './build-listening-question-revision.mjs';
import { digest } from './check-listening-revisions.mjs';

function fixture() {
  const before = { title: 'Dialog', config: {
    questions: Array.from({ length: 10 }, (_, i) => ({ statement: `Question ${i + 1}`, correct: i % 2 === 0 })),
    assisted_questions: Array.from({ length: 10 }, (_, i) => `Translation ${i + 1}`),
    audio_url: '/audio/original.mp3', transcript: 'Original dialogue', audio_generation: { sha256: 'unchanged' },
  } };
  const row = { active: true, level: 'A1', category_id: 1763, page_id: 1, page_slug: 'course-1763-listening', block_id: 1, variant_id: 2, seed_key: 'variant:2', before, before_sha256: digest(before) };
  const review = { variant_id: 2, before_sha256: row.before_sha256, keep: [1, 2, 4, 5, 9], reason: 'Distinct facts', removed: [3, 6, 7, 8, 10].map(index => ({ index, reason: 'Repeated fact' })), flags: [] };
  return { snapshot: { schema_version: 1, variants: [row, { ...row, active: false, variant_id: 3 }] }, reviews: [{ level: 'A1', reviews: [review] }] };
}

test('selection preserves audio, maps assistance and leaves the input untouched', () => {
  const { snapshot, reviews } = fixture();
  const original = structuredClone(snapshot);
  const result = buildListeningQuestionRevision(snapshot, reviews);
  const entry = result.manifest.entries[0];
  const after = structuredClone(entry.before);
  after.config.questions = entry.keep.map(i => after.config.questions[i - 1]);
  after.config.assisted_questions = entry.keep.map(i => after.config.assisted_questions[i - 1]);
  assert.equal(entry.after_sha256, digest(after));
  assert.equal(after.config.audio_url, '/audio/original.mp3');
  assert.deepEqual(after.config.assisted_questions, ['Translation 1', 'Translation 2', 'Translation 4', 'Translation 5', 'Translation 9']);
  assert.deepEqual(snapshot, original);
  assert.deepEqual(result.summary.A1, { reviewed: 1, changed: 1, before: 10, after: 5, counts: { 5: 1 } });
});

test('allows all ten useful questions to remain', () => {
  const { snapshot, reviews } = fixture();
  reviews[0].reviews[0].keep = Array.from({ length: 10 }, (_, i) => i + 1);
  reviews[0].reviews[0].removed = [];
  const { manifest, summary } = buildListeningQuestionRevision(snapshot, reviews);
  assert.equal(manifest.entries[0].before_sha256, manifest.entries[0].after_sha256);
  assert.equal(summary.A1.changed, 0);
});

for (const [name, edit] of [
  ['fewer than five', r => { r.keep = [1, 2, 3, 4]; }],
  ['reordered questions', r => { r.keep = [2, 1, 4, 5, 9]; }],
  ['duplicate questions', r => { r.keep = [1, 2, 4, 4, 9]; }],
  ['out of range', r => { r.keep = [1, 2, 4, 5, 11]; }],
  ['unexplained removal', r => { r.removed.pop(); }],
  ['one answer polarity', r => { r.keep = [1, 3, 5, 7, 9]; r.removed = [2, 4, 6, 8, 10].map(index => ({ index, reason: 'Repeated' })); }],
]) test(`rejects ${name}`, () => {
  const { snapshot, reviews } = fixture();
  edit(reviews[0].reviews[0]);
  assert.throws(() => buildListeningQuestionRevision(snapshot, reviews));
});

test('requires a complete review and trusted source hash', () => {
  const { snapshot, reviews } = fixture();
  assert.throws(() => buildListeningQuestionRevision(snapshot, []), /scope/);
  assert.throws(() => buildListeningQuestionRevision(snapshot, [reviews[0], reviews[0]]), /Duplicate/);
  snapshot.variants[0].before.config.transcript = 'Edited elsewhere';
  assert.throws(() => buildListeningQuestionRevision(snapshot, reviews), /fingerprint/);
});

test('rejects a review based on older questions even with a valid new snapshot', () => {
  const { snapshot, reviews } = fixture();
  snapshot.variants[0].before.config.questions[0].statement = 'New administrator edit';
  snapshot.variants[0].before_sha256 = digest(snapshot.variants[0].before);
  assert.throws(() => buildListeningQuestionRevision(snapshot, reviews), /another source version/);
});

test('maps installations by category and seed, preserving target vocabulary metadata', () => {
  const { snapshot, reviews } = fixture();
  snapshot.variants[0].before.config.authoring = { target_word_ids: [1], source_sha256: 'local' };
  snapshot.variants[0].before_sha256 = digest(snapshot.variants[0].before);
  reviews[0].reviews[0].before_sha256 = snapshot.variants[0].before_sha256;
  const target = structuredClone(snapshot);
  target.variants[0].variant_id = 99;
  target.variants[0].page_id = 42;
  target.variants[0].before.config.authoring = { target_word_ids: [5], source_sha256: 'production' };
  target.variants[0].before_sha256 = digest(target.variants[0].before);
  const mapped = rebaseListeningQuestionReviews(snapshot, reviews, target);
  const result = buildListeningQuestionRevision(target, mapped);
  assert.equal(result.manifest.entries[0].variant_id, 99);
  assert.deepEqual(result.manifest.entries[0].before.config.authoring, { target_word_ids: [5], source_sha256: 'production' });
  target.variants[0].before.config.questions[0].statement = 'Changed on production';
  target.variants[0].before_sha256 = digest(target.variants[0].before);
  assert.throws(() => rebaseListeningQuestionReviews(snapshot, reviews, target), /Target content differs/);
});

test('allows only explanation evidence found in the unchanged recording', () => {
  const { snapshot, reviews } = fixture();
  const review = reviews[0].reviews[0];
  review.explanation_evidence = [{ index: 2, quotes: ['Original dialogue'] }];
  const result = buildListeningQuestionRevision(snapshot, reviews);
  assert.deepEqual(result.manifest.entries[0].explanation_evidence, review.explanation_evidence);
  review.explanation_evidence[0].quotes = ['Invented evidence'];
  assert.throws(() => buildListeningQuestionRevision(snapshot, reviews), /quote the recording/);
  review.explanation_evidence = [{ index: 3, quotes: ['Original dialogue'] }];
  assert.throws(() => buildListeningQuestionRevision(snapshot, reviews), /retained question/);
});
