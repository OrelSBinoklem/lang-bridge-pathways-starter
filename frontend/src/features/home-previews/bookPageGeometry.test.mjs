import test from 'node:test';
import assert from 'node:assert/strict';
import { projectBookPagePoint, buildBookPageFrame } from './bookPageGeometry.ts';

function close(actual, expected) {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-7, `x: ${actual.x} != ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) < 1e-7, `y: ${actual.y} != ${expected.y}`);
}

test('the whole gutter stays pinned during the turn, including intermediate points', () => {
  for (let step = 0; step <= 100; step++) for (const along of [0, .2, .5, .8, 1]) {
    close(projectBookPagePoint(along, 0, step / 100), { x: 141 + 39 * along, y: 308 - 73 * along });
  }
});

test('both resting planes register with the four measured corners of the book', () => {
  close(projectBookPagePoint(0, 1, 0), { x: 242, y: 312 });
  close(projectBookPagePoint(1, 1, 0), { x: 276, y: 239 });
  close(projectBookPagePoint(0, 1, 1), { x: 44, y: 255 });
  close(projectBookPagePoint(1, 1, 1), { x: 90, y: 200 });
});

test('the landing follows the bowed top and front edges of the original left page', () => {
  close(projectBookPagePoint(1, .5, 1), { x: 145.5, y: 194.25 });
  close(projectBookPagePoint(0, .5, 1), { x: 96.625, y: 268.75 });
  const ink = buildBookPageFrame(1).ink;
  assert.ok(ink.startsWith('M134.00 257.00'));
  assert.ok(ink.endsWith('105.00 208.00'));
});

test('surface and ink remain finite and the free edge moves continuously through the upright pose', () => {
  let previous = projectBookPagePoint(.5, 1, 0);
  for (let step = 0; step <= 100; step++) {
    const point = projectBookPagePoint(.5, 1, step / 100);
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    assert.ok(Math.hypot(point.x - previous.x, point.y - previous.y) < 5, 'The page must not jump between poses');
    const frame = buildBookPageFrame(step / 100);
    assert.doesNotMatch(frame.outline + frame.ink + frame.patches.map(p => p.path).join(''), /NaN|Infinity/);
    previous = point;
  }
  assert.ok(projectBookPagePoint(.5, 1, .5).y < 215, 'The lifted edge must rise above the resting pages');
});
