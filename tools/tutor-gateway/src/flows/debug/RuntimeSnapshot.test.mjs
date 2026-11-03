import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimePipelineSnapshot } from './RuntimeSnapshot.mjs';
import { TRANSCRIPTION_CONTEXT_RULES } from '../../../../../resources/tutor-flow/transcription-contract.mjs';

test('administrative metadata reflects resolved audio settings without credentials or audio bytes', () => {
  const config = { transcriptionModel: 'old', dualTranscriptionEnabled: false, apiKey: 'SECRET' };
  const context = { sourceType: 'user.audio', audio: 'PRIVATE_BYTES', recognitionSettings: { transcriptionModel: 'actual-primary', secondaryTranscriptionModel: 'actual-secondary', primaryTranscriptionLanguage: 'lv', secondaryTranscriptionLanguage: 'ru', dualTranscriptionEnabled: true }, audioMetadata: { mimeType: 'audio/wav', sizeBytes: 44, audio: 'PRIVATE_BYTES' } };
  const before = JSON.stringify({ config, context });
  const snapshot = runtimePipelineSnapshot(config, context, { OPENAI_API_KEY: 'SECRET' });
  assert.deepEqual(snapshot.recognition, context.recognitionSettings);
  assert.deepEqual(snapshot.recordingMetadata, { mimeType: 'audio/wav', sizeBytes: 44 });
  assert.deepEqual(snapshot.transcriptionRules, TRANSCRIPTION_CONTEXT_RULES);
  assert(!JSON.stringify(snapshot).includes('SECRET')); assert(!JSON.stringify(snapshot).includes('PRIVATE_BYTES'));
  assert.equal(JSON.stringify({ config, context }), before);
});
test('single recognition uses the same existing fallback model and remains a single pass', () => {
  const snapshot = runtimePipelineSnapshot({}, {}, { OPENAI_TRANSCRIBE_MODEL: 'default-stt' });
  assert.equal(snapshot.recognition.transcriptionModel, 'default-stt');
  assert.equal(snapshot.recognition.secondaryTranscriptionModel, 'default-stt');
  assert.equal(snapshot.recognition.dualTranscriptionEnabled, false);
  assert.equal(snapshot.sourceType, 'user.message');
});
