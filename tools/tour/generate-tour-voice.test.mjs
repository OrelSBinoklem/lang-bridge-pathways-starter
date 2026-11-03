import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildJobs, boundedTourPreflight, receiptCostCeiling } from './generate-tour-voice.mjs';

test('words tour has a bounded RU/UK batch within the authorized dollar', async () => {
  const source = JSON.parse(await readFile(new URL('../../resources/tour/words-tour.json', import.meta.url), 'utf8'));
  const jobs = buildJobs(source.lines, 'Fenrir');
  assert.equal(jobs.length, source.lines.length * 2);
  assert.equal(new Set(jobs.map(job => job.key)).size, jobs.length);
  for (const job of jobs) { assert(job.text.length <= 160); assert.equal(job.voice, 'Fenrir'); }
  assert(boundedTourPreflight(jobs, 1).reserve_per_request_usd < 1);
  assert(boundedTourPreflight(jobs, 1).estimated_batch_usd < 1);
  assert.throws(() => boundedTourPreflight(jobs, 0.01), /exceeds/);
  assert.throws(() => receiptCostCeiling({}), /Missing usage/);
  assert.equal(receiptCostCeiling({usage_metadata:{promptTokenCount:100, candidatesTokenCount:200}}), 0.0042);
});
