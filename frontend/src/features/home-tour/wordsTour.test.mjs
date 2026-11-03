import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../../../../', import.meta.url);
const source = JSON.parse(await readFile(new URL('resources/tour/words-tour.json', root), 'utf8'));
const manifest = JSON.parse(await readFile(new URL(`frontend/public/audio/tour/${source.release}-fenrir/manifest.json`, root), 'utf8'));
const steps = await readFile(new URL('./wordsTourSteps.ts', import.meta.url), 'utf8');

test('all category tour steps and both languages have the exact recorded text', async () => {
  const keys = [...steps.matchAll(/\{ key: '([a-z-]+)'/g)].map(m => m[1]);
  const lines = new Map(source.lines.map(line => [line.key, line]));
  assert.equal(manifest.release, `${source.release}-fenrir`);
  assert.equal(Object.keys(manifest.clips).length, source.lines.length * 2);
  for (const key of [...keys, 'closed']) {
    assert(lines.has(key), `no text: ${key}`);
    for (const lang of ['ru', 'uk']) {
      const clip = manifest.clips[`${key}-${lang}`];
      assert.equal(clip.text, lines.get(key)[lang]);
      assert.equal(clip.voice, 'Fenrir');
      assert(clip.seconds > 1 && clip.seconds < 30);
      const mp3 = await readFile(new URL(`frontend/public${clip.url}`, root));
      assert.equal(createHash('sha256').update(mp3).digest('hex'), clip.file_sha256);
    }
  }
});
