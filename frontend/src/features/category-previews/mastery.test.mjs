import test from 'node:test';
import assert from 'node:assert/strict';
import { getMasteryTier } from './mastery.ts';

test('rank changes occur at the intended learning milestones', () => {
  const milestones = [[60, 'none', 'bronze'], [80, 'bronze', 'silver'], [90, 'silver', 'gold']];
  for (const [threshold, before, after] of milestones) {
    assert.equal(getMasteryTier(threshold - .01), before);
    assert.equal(getMasteryTier(threshold), after);
  }
  assert.equal(getMasteryTier(0), 'none');
});

test('an almost complete category never earns a diamond', () => {
  for (const percent of [95, 99, 99.999]) assert.equal(getMasteryTier(percent), 'gold');
  assert.equal(getMasteryTier(100), 'diamond');
});

test('unavailable or malformed progress cannot award a rank', () => {
  for (const percent of [null, NaN, Infinity, -1, 101]) assert.equal(getMasteryTier(percent), 'unknown');
});
