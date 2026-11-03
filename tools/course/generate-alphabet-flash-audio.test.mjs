import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildJobs, cachedReceipt, model, voice } from './generate-alphabet-flash-audio.mjs';

const source = JSON.parse(await readFile(new URL('../../resources/course/alphabet-letter-names.json', import.meta.url), 'utf8'));

test('exactly 33 canonical Latvian names, directions outside spoken text', () => {
  const jobs = buildJobs(source);
  assert.equal(jobs.length, 33);
  assert.equal(new Set(jobs.map(job => job.request_sha256)).size, 33);
  for (const [index, job] of jobs.entries()) {
    assert.equal(job.name, source.items[index].name);
    assert.equal(job.request.contents[0].parts[0].text, `${job.name}.`);
    assert.match(job.request.contents[0].parts[0].speechMetadata.style, /Native Latvian/);
    assert.equal(job.model, model);
    assert.equal(job.voice, voice);
  }
  assert.deepEqual(buildJobs(source), jobs);
  const aoede = buildJobs(source, 'Aoede');
  assert.equal(aoede[0].voice, 'Aoede');
  assert.equal(aoede[0].request.generationConfig.speechConfig.voiceConfig.voice, 'Aoede');
  assert.notEqual(aoede[0].request_sha256, jobs[0].request_sha256);
  assert.throws(() => buildJobs(source, '../another-voice'));
  assert.throws(() => buildJobs({ ...source, items: source.items.slice(1) }));
  assert.throws(() => buildJobs({ ...source, items: source.items.map((item, i) => i ? item : { ...item, name: 'explain A' }) }));
});

test('billed requests without a receipt cannot be retried; cache requires matching bytes and input', async () => {
  const directory = new URL(`../../.tmp/alphabet-test-${process.pid}-${Date.now()}/`, import.meta.url);
  const directoryPath = fileURLToPath(directory);
  await mkdir(directory, { recursive: true });
  const job = buildJobs(source)[0];
  const file = suffix => new URL(`${job.key}${suffix}`, directory);
  try {
    assert.equal(await cachedReceipt(directoryPath, job), null);
    await writeFile(file('.request.json'), '{}', { flag: 'wx' });
    await assert.rejects(cachedReceipt(directoryPath, job), /no automatic retry/);
    const bytes = Buffer.from('fake-test-only-wave');
    await writeFile(file('.wav'), bytes, { flag: 'wx' });
    const receipt = { name: job.name, model, voice, request_sha256: job.request_sha256,
      file_sha256: createHash('sha256').update(bytes).digest('hex') };
    await writeFile(file('.receipt.json'), JSON.stringify(receipt), { flag: 'wx' });
    assert.deepEqual(await cachedReceipt(directoryPath, job), receipt);
    await assert.rejects(cachedReceipt(directoryPath, buildJobs(source, 'Aoede')[0]), /Invalid cached/);
    await writeFile(file('.wav'), 'tampered');
    await assert.rejects(cachedReceipt(directoryPath, job), /Invalid cached/);
  } finally {
    // This directory is created exclusively by this test under the repository's .tmp.
    const parent = fileURLToPath(new URL('../../.tmp/', import.meta.url));
    assert.equal(path.dirname(path.resolve(directoryPath)), path.resolve(parent));
    await rm(directory, { recursive: true });
  }
});
