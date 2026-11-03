import test from 'node:test';
import assert from 'node:assert/strict';
import { tutorPresets, resolvePresetConfig, resolveClientPresetConfig, basicTutorContext, economyCommandAllowed, longMemoryCommand } from './presets.mjs';
import { buildTutorRules } from './agent/TutorRulesBuilder.mjs';

test('all presets retain summaries; models and recognition channels differ intentionally', () => {
  for (const id of Object.keys(tutorPresets)) assert.equal(resolvePresetConfig({ preset: id }).contextCompressionEnabled, true);
  const economy = resolvePresetConfig({ preset: 'economy', tutorModel: 'forged', dualTranscriptionEnabled: true });
  assert.equal(economy.tutorModel, 'gpt-6-luna'); assert.equal(economy.transcriptionModel, 'gpt-transcribe');
  assert.equal(economy.dualTranscriptionEnabled, false); assert.equal(economy.ttsMode, 'api');
  assert.equal(economy.ttsModel, 'gemini-3.8-flash-lite-tts'); assert.equal(economy.ttsVoice, 'Enceladus');
  assert.equal(resolvePresetConfig({ preset: 'standard' }).dualTranscriptionEnabled, false);
  assert.equal(resolvePresetConfig({ preset: 'standard' }).tutorModel, 'gpt-6-luna');
  assert.equal(resolvePresetConfig({ preset: 'uncompromising' }).tutorModel, 'gpt-6-sol');
  assert.equal(resolvePresetConfig({ preset: 'uncompromising' }).reasoningEnabled, false);
  assert.equal(resolvePresetConfig({ preset: 'uncompromising' }).reasoningEffort, 'none');
  assert.equal(resolvePresetConfig({ preset: 'uncompromising' }).dualTranscriptionEnabled, true);
  const { preset: _quality, ...quality } = resolvePresetConfig({ preset: 'quality' });
  const { preset: _maximum, ...maximum } = resolvePresetConfig({ preset: 'uncompromising' });
  assert.equal(quality.tutorModel, 'gpt-6.1-terra');
  assert.equal(maximum.tutorModel, 'gpt-6-sol');
  assert.deepEqual({...quality, tutorModel: maximum.tutorModel}, maximum);
});
test('users cannot bypass the saved preset with custom model, provider, pipeline or disabled summaries', () => {
  const c = resolveClientPresetConfig({ tutorModel: 'forged', contextCompressionEnabled: false, ttsProvider: 'elevenlabs', tutorPipeline: 'realtime_voice' }, false);
  assert.equal(c.preset, 'standard'); assert.equal(c.tutorPipeline, 'stt_text_tts'); assert.equal(c.contextCompressionEnabled, true);
  assert.equal(c.ttsProvider, undefined); assert.equal(c.tutorModel, 'gpt-6-luna');
  const custom = resolveClientPresetConfig({ tutorModel: 'admin-test', messageEmbeddingModel: 'text-embedding-3-small', summaryEmbeddingModel: 'text-embedding-3-small' }, true);
  assert.equal(custom.tutorModel, 'admin-test');
  assert.equal(custom.messageEmbeddingModel, 'text-embedding-3-small');
  assert.equal(custom.summaryEmbeddingModel, 'text-embedding-3-small');
  const chosen = resolvePresetConfig({ preset: 'standard' }, { standard: { messageEmbeddingModel: 'text-embedding-3-small', summaryEmbeddingModel: 'text-embedding-3-small' } });
  assert.equal(chosen.messageEmbeddingModel, 'text-embedding-3-small');
  assert.equal(chosen.summaryEmbeddingModel, 'text-embedding-3-small');
  assert.throws(() => resolvePresetConfig({ preset: 'unknown' }), /Неизвестный/);
  assert.throws(() => resolvePresetConfig({ preset: '__proto__' }), /Неизвестный/);
  assert.throws(() => resolvePresetConfig({ preset: 'constructor' }), /Неизвестный/);
});
test('server-saved admin settings take precedence over browser values, retaining explicit capture language', () => {
  const saved = { standard: { ...tutorPresets.standard, tutorModel: 'gpt-5.4-mini', longMemoryEnabled: false, ttsVoice: 'Kore' } };
  const c = resolveClientPresetConfig({ preset: 'standard', tutorModel: 'fake', ttsVoice: 'fake', primaryTranscriptionLanguage: 'lv' }, false, saved);
  assert.equal(c.tutorModel, 'gpt-5.4-mini'); assert.equal(c.ttsVoice, 'Kore'); assert.equal(c.primaryTranscriptionLanguage, 'lv');
  assert.equal(c.longMemoryEnabled, false);
});
test('basic context is bounded, retaining summary, important notes, page and current lesson', () => {
  const context = { recentContext: Array.from({length:100}, ()=>'x'.repeat(5000)), contextSummary:'summary', importantNotes:['fact'], currentPage:'/grammar', lessonContext:{topic:'task'}, recentToolInteractions:['old'] };
  const basic = basicTutorContext(context);
  assert(basic.recentContext.join('').length <= 12000); assert.equal(basic.contextSummary, 'summary');
  assert.deepEqual(basic.importantNotes, ['fact']); assert.deepEqual(basic.lessonContext, context.lessonContext);
  assert.deepEqual(basic.recentToolInteractions, []); assert.equal(context.recentContext.length, 100);
  const prompt = buildTutorRules({basic:true}); assert(prompt.includes('важные заметки')); assert(prompt.includes('memory.note.save'));
});
test('economy disables only highlighting; long-memory lookup is a separate switch', () => {
  for (const name of ['navigate','lesson.block.complete','web.reference','memory.note.save','memory.get','memory.notes.search']) assert(economyCommandAllowed(name));
  for (const name of ['grammar.table.highlight','grammar.lesson.present','verb.form.highlight']) assert(!economyCommandAllowed(name));
  assert(longMemoryCommand('memory.search_history')); assert(longMemoryCommand('history.get_around_message'));
  assert(!longMemoryCommand('memory.notes.search')); assert(!longMemoryCommand('memory.note.save'));
});
