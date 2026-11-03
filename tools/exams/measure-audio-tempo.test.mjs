import test from 'node:test';
import assert from 'node:assert/strict';
import { lexicalWords, pauseExcludedDuration } from './measure-audio-tempo.mjs';

test('count Latvian words without treating punctuation as words', () => {
  assert.equal(lexicalWords('Šodien iešu uz tirgu. Āboli, maize!'), 6);
  assert.throws(() => lexicalWords('[slowly] Labdien!'));
});
test('subtract quiet spans, including unfinished trailing silence, without double counting', () => {
  const log = 'silence_start: 0\nsilence_end: 1\nsilence_start: 0.5\nsilence_end: 2\nsilence_start: 8';
  assert.deepEqual(pauseExcludedDuration(log, 10), { activeSeconds: 6, quietSeconds: 4 });
  assert.throws(() => pauseExcludedDuration('silence_start: 0', 10));
});
test('handle signed scientific timestamps and clamp to the audio boundaries', () => {
  assert.deepEqual(pauseExcludedDuration('silence_start: -1e-3\nsilence_end: 2e-1', 1), { activeSeconds: 0.8, quietSeconds: 0.2 });
  assert.throws(() => pauseExcludedDuration('silence_start: 1e999\nsilence_end: 2', 10));
});
