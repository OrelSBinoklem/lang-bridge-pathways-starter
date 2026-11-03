import test from 'node:test';
import assert from 'node:assert/strict';
import { digest, inspectListeningRevisions } from './check-listening-revisions.mjs';

function fixture() {
  const baseline = [], titles = [];
  const variants = Array.from({ length: 5 }, (_, i) => {
    const dialogue_segments = [{ speaker: 'a', text: `Labdien! Mūsu mājas numurs ir ${i + 1}.` }, { speaker: 'b', text: 'Paldies! Es dzīvoju Rīgā.' }];
    const speaker_profiles = { a: { name: 'Anna', gender: 'female' }, b: { name: 'Jānis', gender: 'male' } };
    const transcript = dialogue_segments.map(s => `${s.speaker.toUpperCase()}: ${s.text}`).join('\n');
    const questions = Array.from({ length: 10 }, (_, q) => ({ statement: `Apgalvojums ${q + 1}.`, correct: q % 2 === 0, explanation: 'Pārbaudes piemērs.' }));
    const seed_key = `variant:${i + 1}`, title = `Dialogs ${i + 1}`;
    baseline.push({ category_id: 1763, seed_key, content: { dialogue_segments, speaker_profiles, transcript, questions } });
    titles.push({ category_id: 1763, seed_key, title });
    return { seed_key, title, action: 'questions_only', findings: [{ kind: 'answer_logic', detail: 'Test', old_quote: 'Labdien!' }], changes: ['Test'], target_skills: ['detail'], introduced_vocabulary: [],
      config: { dialogue_segments, speaker_profiles, transcript, questions: questions.map(q => ({ ...q, skill: 'detail', evidence: { segment_indexes: [1], quote: 'Es dzīvoju Rīgā.', rationale: 'Test' } })) } };
  });
  return { packs: [{ schema_version: 1, category_id: 1763, level: 'A1', variants }], baseline, titles };
}
const check = f => inspectListeningRevisions(f.packs, f.baseline, f.titles, { requireComplete: false });

test('valid shape passes, repeated evidence is visible as a warning', () => {
  const result = check(fixture());
  assert.deepEqual(result.errors, []);
  assert.equal(result.variants.length, 5);
  assert.ok(result.warnings.some(w => w.includes('fact independence')));
  assert.ok(result.variants.every(v => v.needs_new_audio === false));
});
test('canonical hashes ignore object order but preserve array order', () => {
  assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 }));
  assert.notEqual(digest([1, 2]), digest([2, 1]));
});
test('rejects missing full-course coverage', () => {
  const f = fixture();
  assert.ok(inspectListeningRevisions(f.packs, f.baseline, f.titles).errors.some(e => e.includes('190')));
});
test('rejects stale audio and speech changes disguised as reusable audio', () => {
  const f = fixture(), v = f.packs[0].variants[0];
  v.config = structuredClone(v.config);
  v.config.audio_url = '/old.mp3';
  v.config.dialogue_segments[0].text = 'Sveiki!';
  const errors = check(f).errors;
  assert.ok(errors.some(e => e.includes('stale audio')));
  assert.ok(errors.some(e => e.includes('audio reuse')));
  assert.ok(errors.some(e => e.includes('transcript differs')));
});
test('rejects invented evidence, invalid evidence indexes and fabricated findings', () => {
  const f = fixture(), v = f.packs[0].variants[0];
  v.config.questions[0].evidence = { segment_indexes: [99], quote: 'Not said', rationale: 'Test' };
  v.findings[0].old_quote = 'Not in baseline';
  const errors = check(f).errors;
  assert.ok(errors.some(e => e.includes('invalid evidence index')));
  assert.ok(errors.some(e => e.includes('quote absent')));
  assert.ok(errors.some(e => e.includes('verbatim baseline')));
});
test('rejects unbalanced keys, duplicate statements and duplicate candidates', () => {
  const f = fixture(), variants = f.packs[0].variants;
  variants[0].config.questions[1].correct = true;
  variants[0].config.questions[1].statement = variants[0].config.questions[0].statement;
  variants[1].seed_key = variants[0].seed_key;
  const errors = check(f).errors;
  assert.ok(errors.some(e => e.includes('five true')));
  assert.ok(errors.some(e => e.includes('duplicate statement')));
  assert.ok(errors.some(e => e.includes('duplicate candidate')));
});
test('a new dialogue is marked for new audio, regardless of editorial label', () => {
  const f = fixture(), v = f.packs[0].variants[0];
  v.config = structuredClone(v.config);
  v.config.dialogue_segments[0].text += ' Nāciet iekšā!';
  v.config.transcript = v.config.dialogue_segments.map(s => `${s.speaker.toUpperCase()}: ${s.text}`).join('\n');
  v.action = 'rewrite_dialogue';
  const result = check(f);
  assert.deepEqual(result.errors, []);
  assert.equal(result.variants[0].needs_new_audio, true);
});
test('rejects unrelated config metadata changes', () => {
  const f = fixture();
  f.packs[0].variants[0].config.authoring = { dictionary_id: 999 };
  assert.ok(check(f).errors.some(e => e.includes('unrelated config field')));
});
