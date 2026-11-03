import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('./tutorActivity.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { idleTutorActivity: idle, tutorActivityReducer: reduce, tutorActivityLabel: label } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const reference = (id = 'ref-1') => ({ type: 'ui.command', commandId: id, action: { type: 'client_api', endpoint: '/tutor/references' } });

test('text shows thinking immediately and audio shows transcription before thinking', () => {
  assert.equal(label(reduce(idle, { type: 'request.text' })), 'Бот думает…');
  const audio = reduce(idle, { type: 'request.audio' });
  assert.equal(label(audio), 'Распознаёт речь…');
  assert.equal(reduce(audio, { type: 'transcription.result', ok: true, text: 'Sveiki!' }).phase, 'thinking');
  for (const event of [{ type: 'transcription.result', ok: false }, { type: 'transcription.result', ok: true, text: '  ' }]) {
    assert.equal(reduce(audio, event).phase, 'idle');
  }
});

test('reference lookup has its own label and resumes thinking after the matching result', () => {
  const state = reduce(idle, reference());
  assert.equal(label(state), 'Проверяет по словарю…');
  assert.equal(reduce(state, { type: 'reference.settled', commandId: 'ref-1' }).phase, 'thinking');
  assert.deepEqual(reduce(state, { type: 'reference.settled', commandId: 'old-reference' }), state);
  assert.deepEqual(reduce(state, { type: 'debug.snapshot' }), state);
});

test('late reference completion cannot revive an idle or newer request indicator', () => {
  const settled = { type: 'reference.settled', commandId: 'ref-1' };
  assert.equal(reduce(idle, settled).phase, 'idle');
  const newer = reduce(reduce(idle, reference()), { type: 'request.audio' });
  assert.deepEqual(reduce(newer, settled), newer);
  assert.equal(reduce(reduce(idle, reference('ref-2')), settled).commandId, 'ref-2');
});

test('answer, first audio, errors, reconnect, close and conversation reset clear activity', () => {
  for (const event of [{ type: 'assistant.message' }, { type: 'tts.audio', ok: true }, { type: 'tts.audio', ok: false }, { type: 'tts.playback.started' },
    { type: 'error' }, { type: 'session.ready' }, { type: 'activity.reset' }, { type: 'tutor.thinking', status: 'finished' }]) {
    const state = reduce(reduce(idle, reference()), event);
    assert.equal(state.phase, 'idle');
    assert.equal(label(state), '');
  }
  assert.equal(reduce(idle, { type: 'tutor.thinking', status: 'started' }).phase, 'thinking');
});

test('stream setup and transport chunks do not clear thinking before actual playback', () => {
  const thinking = reduce(idle, { type: 'request.text' });
  for (const type of ['tts.stream.start', 'tts.stream.chunk', 'tts.stream.end']) {
    assert.deepEqual(reduce(thinking, { type }), thinking);
  }
  assert.equal(reduce(thinking, { type: 'tts.playback.started' }).phase, 'idle');
});

test('unrelated UI commands do not falsely advertise a dictionary lookup', () => {
  const thinking = reduce(idle, { type: 'request.text' });
  for (const action of [{ type: 'navigate' }, { type: 'client_api', endpoint: '/tutor/memory/notes' }]) {
    assert.deepEqual(reduce(thinking, { type: 'ui.command', commandId: 'other', action }), thinking);
  }
});

test('connection status stays independent of the separate live activity badge', async () => {
  const ui = await readFile(new URL('./FloatingTutorAssistant.tsx', import.meta.url), 'utf8');
  assert.ok(ui.includes('<span className={`${styles.status} ${styles[status]}`}>{status}</span>'));
  assert.ok(ui.includes('className={`${styles.status} ${styles.activityStatus}`}'));
  assert.ok(ui.includes('{tutorActivityLabel(activity)}'));
  assert.ok(!ui.includes('tutorActivityLabel(activity) || status'));
});
