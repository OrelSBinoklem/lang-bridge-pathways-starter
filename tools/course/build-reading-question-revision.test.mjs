import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReadingQuestionRevision, rebaseReadingQuestionReviews } from './build-reading-question-revision.mjs';
import { digest } from './check-listening-revisions.mjs';

function fixture() {
  const before = { title: 'Reading', config: {
    task_kind: 'reading_binary', text: 'Original reading text.',
    questions: Array.from({ length: 10 }, (_, i) => ({ statement: `Fact ${i}`, correct: i % 2 === 0, explanation: `Proof ${i}` })),
    assisted_questions: Array.from({ length: 10 }, (_, i) => `Assisted ${i}`),
  } };
  const row = { active: true, level: 'A1', category_id: 1763, page_id: 1, page_slug: 'course-1763-reading',
    block_type: 'reading', block_id: 1, variant_id: 2, seed_key: 'variant:2', before, before_sha256: digest(before) };
  const translation = { ...row, variant_id: 7, active: false, before: { title: 'Translation', config: { task_kind: 'lv_to_ru', source_text: 'Preserve this', reference_translation: 'Preserve reference' } } };
  translation.before_sha256 = digest(translation.before);
  const review = { variant_id: 2, before_sha256: row.before_sha256, keep: [1, 2, 4, 5, 9], reason: 'Distinct facts',
    removed: [3, 6, 7, 8, 10].map(index => ({ index, reason: 'Same fact' })), flags: [] };
  return { snapshot: { schema_version: 1, variants: [row, translation, { ...row, active: false, variant_id: 3 }] }, reviews: [{ level: 'A1', reviews: [review] }] };
}

test('reading trim preserves text, retained answers and paired assistance, excludes translations and archive', () => {
  const { snapshot, reviews } = fixture();
  const original = structuredClone(snapshot);
  const { manifest } = buildReadingQuestionRevision(snapshot, reviews);
  assert.equal(manifest.entries.length, 1);
  const entry = manifest.entries[0];
  const expected = structuredClone(entry.before);
  expected.config.questions = entry.keep.map(i => entry.before.config.questions[i - 1]);
  expected.config.assisted_questions = entry.keep.map(i => entry.before.config.assisted_questions[i - 1]);
  assert.equal(entry.after_sha256, digest(expected));
  assert.equal(expected.config.text, 'Original reading text.');
  assert.deepEqual(snapshot, original);
});

test('only active ordinary reading binary blocks are accepted', () => {
  for (const edit of [r => r.block_type = 'listening', r => r.before.config.task_kind = 'lv_to_ru',
    r => r.page_slug = 'course-1763-listening', r => r.before.config.text = '']) {
    const { snapshot, reviews } = fixture();
    edit(snapshot.variants[0]);
    assert.throws(() => buildReadingQuestionRevision(snapshot, reviews), /Not an ordinary reading/);
  }
  const { snapshot, reviews } = fixture();
  snapshot.variants[1].active = true;
  assert.throws(() => buildReadingQuestionRevision(snapshot, reviews), /Not an ordinary reading/);
});

test('reading explanations may quote only the unchanged reading text', () => {
  const { snapshot, reviews } = fixture();
  reviews[0].reviews[0].explanation_evidence = [{ index: 1, quotes: ['Original reading text.'] }];
  const { manifest } = buildReadingQuestionRevision(snapshot, reviews);
  const entry = manifest.entries[0];
  const expected = structuredClone(entry.before);
  expected.config.questions = entry.keep.map(i => structuredClone(entry.before.config.questions[i - 1]));
  expected.config.assisted_questions = entry.keep.map(i => entry.before.config.assisted_questions[i - 1]);
  expected.config.questions[0].explanation = 'Tekstā: Original reading text.';
  assert.equal(entry.after_sha256, digest(expected));
  const target = structuredClone(snapshot);
  target.variants[0].variant_id = 200;
  assert.equal(rebaseReadingQuestionReviews(snapshot, reviews, target)[0].reviews[0].variant_id, 200);
  reviews[0].reviews[0].explanation_evidence[0].quotes = ['Invented explanation'];
  assert.throws(() => buildReadingQuestionRevision(snapshot, reviews), /quote/);
});

test('production uses its own ids and rejects text changes', () => {
  const { snapshot, reviews } = fixture();
  const target = structuredClone(snapshot);
  target.variants[0].variant_id = 200;
  const mapped = rebaseReadingQuestionReviews(snapshot, reviews, target);
  assert.equal(buildReadingQuestionRevision(target, mapped).manifest.entries[0].variant_id, 200);
  target.variants[0].before.config.text = 'New administrator text';
  target.variants[0].before_sha256 = digest(target.variants[0].before);
  assert.throws(() => rebaseReadingQuestionReviews(snapshot, reviews, target), /Target content differs/);
});

test('unchanged five-question starter stays untouched', () => {
  const { snapshot, reviews } = fixture();
  const row = snapshot.variants[0];
  row.before.config.questions = row.before.config.questions.slice(0, 5);
  row.before.config.assisted_questions = row.before.config.assisted_questions.slice(0, 5);
  row.before_sha256 = digest(row.before);
  Object.assign(reviews[0].reviews[0], { before_sha256: row.before_sha256, keep: [1, 2, 3, 4, 5], removed: [] });
  const { manifest, summary } = buildReadingQuestionRevision(snapshot, reviews);
  assert.equal(manifest.entries[0].before_sha256, manifest.entries[0].after_sha256);
  assert.equal(summary.A1.changed, 0);
});
