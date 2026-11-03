import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectReadingPack } from './check-reading-revisions.mjs';

function pack() {
  return { revision: 'synthetic', variants: [1, 2, 3, 4, 5].map(position => ({ level: 'A2', position,
    expected_sha256: 'a'.repeat(64), replace_sections: { reading: { skill: 'reading', seconds: 1800,
      tasks: [4, 6, 5].map((count, task) => ({ id: `task-${position}-${task}`, text: 'Latviešu teksts.',
        questions: Array.from({ length: count }, (_, question) => ({ id: `question-${position}-${task}-${question}`, type: 'choice',
          prompt: `Jautājums ${position}-${task}-${question}`, points: 1,
          options: [{ id: 'a', text: 'Atbilde A' }, { id: 'b', text: 'Atbilde B' }],
          correct: 'a', explanation: 'Pamatojums.', explanation_translations: { ru: 'Перевод.', uk: 'Переклад.' } })) })) } } })) };
}
test('five valid independent forms with translations pass', () => {
  const report = inspectReadingPack(pack());
  assert.deepEqual(report.errors, []);
  assert.equal(report.shared_questions_across_all_five, 0);
  assert.equal(report.variants[0].body_words, 6);
});
test('missing forms, invalid key, changed points and missing translation are detected', () => {
  const invalid = pack();
  invalid.variants.pop();
  const q = invalid.variants[0].replace_sections.reading.tasks[0].questions[0];
  q.correct = 'missing'; q.points = 0; delete q.explanation_translations.uk;
  const errors = inspectReadingPack(invalid).errors.join('\n');
  for (const expected of ['five independent', 'key not among options', '14 points instead of 15', 'missing uk']) assert.ok(errors.includes(expected));
});
test('redistributing questions with the same total cannot change the blueprint unnoticed', () => {
  const invalid = pack();
  const tasks = invalid.variants[0].replace_sections.reading.tasks;
  tasks[1].questions.push(tasks[0].questions.pop());
  assert.ok(inspectReadingPack(invalid).errors.some(error => error.includes('question matrix must be 4+6+5')));
});
test('shared keys are reported even when evidence translations differ', () => {
  const repeated = pack();
  for (const v of repeated.variants) v.replace_sections.reading.tasks[0].questions[0].prompt = 'Same';
  assert.equal(inspectReadingPack(repeated).shared_questions_across_all_five, 1);
});
test('a reading pack cannot silently include another skill replacement', () => {
  const invalid = pack();
  invalid.variants[0].replace_sections.speaking = { skill: 'speaking' };
  assert.ok(inspectReadingPack(invalid).errors.some(error => error.includes('must not patch other skills')));
});
