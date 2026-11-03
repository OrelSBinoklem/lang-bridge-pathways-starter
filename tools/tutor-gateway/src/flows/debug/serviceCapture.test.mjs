import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { TraceArchive } from './TraceArchive.mjs';
import { handleServiceCapture } from './ServiceCapture.mjs';
const root = fileURLToPath(new URL('../../../../../.tmp/', import.meta.url));

test('PHP service capture is opt-in, authenticated, role isolated, full fidelity and shares quotas', async () => {
  await mkdir(root, { recursive: true }); const directory = await mkdtemp(`${root}/service-capture-`);
  const archive = new TraceArchive({ directory }); await archive.ready;
  const secret = 'fixture-'.repeat(6);
  const server = createServer((req, res) => void handleServiceCapture(req, res, { archive, secret }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const send = async (body, key = secret) => { const response = await fetch(url, { method: 'POST', headers: { 'X-Tutor-Debug': key }, body: JSON.stringify({ userId: 5, botId: 'examiner', ...body }) }); return { status: response.status, data: await response.json() }; };
  try {
    assert.equal((await send({ action: 'status' }, 'bad')).status, 403);
    assert.equal((await send({ action: 'status', botId: 'unknown' })).status, 422);
    const body = { model: 'fixture-model', input: [{ role: 'developer', content: 'I'.repeat(14000) }, { role: 'user', content: 'private-answer' }, { type: 'reasoning', encrypted_content: 'never-retain' }], audio: 'private-audio' };
    assert.equal((await send({ action: 'begin', request: body })).data.id, null);
    await archive.watch(5, true, 'examiner');
    assert.equal(archive.status(5).recording, false);
    const id = (await send({ action: 'begin', request: body, subject: { type: 'exam_attempt', id: 7 } })).data.id;
    assert(id);
    assert.equal((await archive.list(5)).runs.length, 0);
    assert.equal((await archive.list(5, null, 'examiner')).runs.length, 1);
    await assert.rejects(archive.detail(5, id));
    assert.equal((await send({ action: 'finish', id, userId: 6 })).status, 404);
    assert.equal((await send({ action: 'finish', id, botId: 'translation' })).status, 404);
    assert.equal((await send({ action: 'finish', id, status: 200, response: { output_text: 'grade', usage: { input_tokens: 999 } } })).status, 200);
    const run = await archive.detail(5, id, 'examiner');
    assert.equal(run.subject.id, 7); assert.equal(run.status, 'completed');
    const request = JSON.parse(run.events.find(e => e.type === 'model_request').inputPreview);
    assert.equal(request.input[0].content.length, 14000);
    assert.equal(request.input[1].content, 'private-answer');
    assert(!JSON.stringify(run).includes('never-retain')); assert(!JSON.stringify(run).includes('private-audio'));
    assert.equal(archive.status(5).bytes, archive.status(5, 'examiner').bytes);
    assert.equal(run.events.find(e => e.type === 'model_response').usage.input_tokens, 999);
    await archive.watch(5, true, 'exam_stt_primary');
    const speech = (await send({ action: 'begin', botId: 'exam_stt_primary', request: { model: 'gpt-transcribe', prompt: 'Transcribe verbatim.', audio_bytes: 12000 } })).data.id;
    await send({ action: 'finish', id: speech, botId: 'exam_stt_primary', status: 200, response: { text: 'Labdien!' } });
    const speechRun = await archive.detail(5, speech, 'exam_stt_primary');
    assert.equal(JSON.parse(speechRun.events.find(e => e.type === 'prompt').outputPreview), 'Transcribe verbatim.');
    assert.equal((await archive.list(5, null, 'examiner')).runs.length, 1);
  } finally { await new Promise(resolve => server.close(resolve)); await archive.pending; assert(directory.startsWith(root)); await rm(directory, { recursive: true }); }
});
