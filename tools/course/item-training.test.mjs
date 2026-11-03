import test from 'node:test';
import assert from 'node:assert/strict';
import { buildItemTrainingQueue } from '../../frontend/src/features/training/item-training.ts';

const item = (key, direct, reverse) => ({ key, directions: { direct: { available: direct }, reverse: { available: reverse } } });
test('ordinary queue shuffles each direction independently and never bypasses a cooldown', () => {
  const queue = buildItemTrainingQueue([item('a', true, true), item('b', false, true), item('c', true, false)], false, () => 0);
  assert.deepEqual(queue, [{ key: 'c', direction: 'direct' }, { key: 'a', direction: 'direct' },
    { key: 'b', direction: 'reverse' }, { key: 'a', direction: 'reverse' }]);
});
test('practice includes completed/cooling down directions without changing source state', () => {
  const items = [item('a', false, false), item('b', true, false)];
  const original = structuredClone(items);
  assert.equal(buildItemTrainingQueue(items, true).length, 4);
  assert.deepEqual(items, original);
  assert.deepEqual(buildItemTrainingQueue([], true), []);
});
