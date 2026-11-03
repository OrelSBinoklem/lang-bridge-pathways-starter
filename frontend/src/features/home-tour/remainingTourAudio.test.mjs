import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildJobs, boundedTourPreflight } from '../../../../tools/tour/generate-tour-voice.mjs';

const root = new URL('../../../../', import.meta.url);
for (const kind of ['course', 'chat', 'exams']) test(`${kind}: complete Fenrir audio matches every RU/UK source and file hash`, async () => {
  const source = JSON.parse(await readFile(new URL(`resources/tour/${kind}-tour.json`, root), 'utf8'));
  const jobs = buildJobs(source.lines, 'Fenrir');
  assert(boundedTourPreflight(jobs, 1).estimated_batch_usd <= 1);
  const manifest = JSON.parse(await readFile(new URL(`frontend/public/audio/tour/${source.release}-fenrir/manifest.json`, root), 'utf8'));
  assert.equal(Object.keys(manifest.clips).length, jobs.length);
  for (const job of jobs) {
    const clip = manifest.clips[job.key];
    assert.equal(clip.text, job.text);
    assert.equal(clip.voice, 'Fenrir');
    assert(clip.seconds > 1 && clip.seconds < 30);
    const bytes = await readFile(new URL(`frontend/public${clip.url}`, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), clip.file_sha256);
  }
});
