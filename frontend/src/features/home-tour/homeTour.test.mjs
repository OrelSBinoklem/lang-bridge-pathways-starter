import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const tour = JSON.parse(await readFile(new URL('../../../../resources/tour/home-tour.json', import.meta.url), 'utf8'));
const steps = await readFile(new URL('./homeTourSteps.ts', import.meta.url), 'utf8');
const runner = await readFile(new URL('./tourRunner.ts', import.meta.url), 'utf8');
const shell = await readFile(new URL('../../components/app-shell.tsx', import.meta.url), 'utf8');

test('every tour line is voiced in Russian and Ukrainian and short enough for one bubble', () => {
  assert.match(tour.release, /^home-tour-\d{8}$/);
  const keys = tour.lines.map(line => line.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const line of tour.lines) {
    for (const lang of ['ru', 'uk']) {
      assert.equal(typeof line[lang], 'string', `${line.key}/${lang}`);
      assert(line[lang].length > 10 && line[lang].length <= 160, `${line.key}/${lang} length ${line[lang].length}`);
    }
  }
});

test('every step and the closing message have text, and every menu mark exists in the app shell', () => {
  const stepKeys = [...steps.matchAll(/\{ key: '([a-z-]+)'/g)].map(m => m[1]);
  assert(stepKeys.length >= 20);
  const lineKeys = new Set(tour.lines.map(line => line.key));
  for (const key of [...stepKeys, 'closed']) assert(lineKeys.has(key), `no text for ${key}`);
  assert.match(runner, /tourText\('closed'/);
  for (const [, mark] of steps.matchAll(/menuPart\('([a-z-]+)'\)/g)) assert(shell.includes(`data-tour="${mark}"`), `menu mark ${mark}`);
  assert(shell.includes('data-tour="menu-tour"') && shell.includes("CustomEvent('lbp.tour.start')"), 'menu can restart the tour');
  assert(shell.includes("closest?.('[data-keep-menu]')"), 'tour controls do not close the menu');
});
