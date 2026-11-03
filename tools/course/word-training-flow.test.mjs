import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrainingQueue, formatCooldownMs, formatDenseWaitMs, getNextAvailableQueueIndex } from '../../frontend/src/features/training/helpers.ts';

const word = id => ({ id, word: `word${id}`, translation_1: `answer${id}`, category_ids: [1] });
const progress = (id, extra = {}) => ({ dict_word_id: id, attempts: 1, attempts_revert: 1,
  correct_attempts: 0, correct_attempts_revert: 0, ...extra });
const item = (id, mode = false) => ({ word: word(id), mode, phase: mode ? 'revert' : 'direct' });

test('ordinary cooldowns match legacy hours:minutes without seconds', () => {
  for (const [ms, expected] of [[-1, '0:00'], [0, '0:00'], [59000, '0:00'],
    [60000, '0:01'], [1799000, '0:29'], [1800000, '0:30'], [10800000, '3:00'],
    [71999000, '19:59'], [72000000, '20:00']]) {
    assert.equal(formatCooldownMs(ms), expected);
  }
  assert.equal(formatDenseWaitMs(61000), '1:01');
  assert.equal(formatDenseWaitMs(3601000), '1:00:01');
});

test('next word skips directions that became learned or unavailable during a round', () => {
  const queue = [item(1), item(2), item(2, true), item(3)];
  const data = { 2: progress(2, { correct_attempts: 1, last_shown: new Date().toISOString() }) };
  assert.equal(getNextAvailableQueueIndex(queue, 0, data), 2);
  assert.equal(getNextAvailableQueueIndex(queue, 2, data), 3);
  assert.equal(getNextAvailableQueueIndex(queue, 3, data), -1);
});

test('completion is reached when all directions are learned or cooling down', () => {
  const data = {
    1: progress(1, { correct_attempts: 2, correct_attempts_revert: 2 }),
    2: progress(2, { correct_attempts: 1, correct_attempts_revert: 1,
      last_shown: new Date().toISOString(), last_shown_revert: new Date().toISOString() }),
  };
  assert.deepEqual(buildTrainingQueue([word(1), word(2)], data), []);
  assert.equal(getNextAvailableQueueIndex([item(1), item(2), item(2, true)], 0, data), -1);
});

test('remaining educational directions produce another round for the notice', () => {
  const data = { 1: progress(1, { mode_education: true, mode_education_revert: true }) };
  assert.deepEqual(buildTrainingQueue([word(1)], data), [item(1), item(1, true)]);
  assert.deepEqual(buildTrainingQueue([word(2)], {}), [item(2), item(2, true)]);
});
