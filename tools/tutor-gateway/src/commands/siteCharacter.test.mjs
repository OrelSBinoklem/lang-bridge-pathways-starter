import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchStructuredCommand } from './dispatcher.mjs';
import { siteCharacter } from './siteCharacter.mjs';
import { tutorDeveloperMessages, tutorPromptManifest } from '../agent/TutorPromptEnvelope.mjs';
import { siteCharacterVoice } from '../agent/siteCharacterVoice.mjs';
import { resolveClientPresetConfig } from '../presets.mjs';

test('cat MCP publishes fixed targets, validates emotion/target and clamps duration', () => {
  const guide = dispatchStructuredCommand('site.character.describe', {});
  assert.equal(guide.ok, true);
  assert.equal(guide.action.emitUiCommand, false);
  assert(guide.action.targets.some(target => target.id === 'course'));
  assert(!JSON.stringify(guide.action).includes('selector'));
  assert.equal(dispatchStructuredCommand('site.character.point', { target: 'body' }).ok, false);
  assert.equal(dispatchStructuredCommand('site.character.emotion', { emotion: '<script>' }).ok, false);
  const command = dispatchStructuredCommand('site.character.point', { target: 'course', duration_ms: 100000 });
  assert.equal(command.ok, true);
  assert.equal(command.action.durationMs, 15000);
  assert.equal(command.action.type, 'site_character');
  assert.equal(command.action.emitUiCommand, true);
  for (const emotion of siteCharacter.emotions) assert.equal(dispatchStructuredCommand('site.character.emotion', { emotion }).ok, true);
});

test('site keeper instructions are visible in the exact developer prefix used by context inspection', () => {
  for (const contextMode of ['basic', 'full']) {
    const config = { contextMode };
    const policy = { allCommands: true, maxSteps: 6 };
    const actual = tutorDeveloperMessages(config);
    const inspected = tutorPromptManifest(config, policy);
    assert.equal(actual[1].content, inspected.sections[1].text);
    assert(actual[1].content.includes('Рикс'));
    for (const { id } of siteCharacter.targets) assert(actual[1].content.includes(`${id}:`));
  }
});

test('Gemini voice follows the selected character while keeping the model and preset', () => {
  const config = { ttsModel: 'gemini-3.8-flash-lite-tts', ttsVoice: 'Puck', preset: 'economy' };
  assert.deepEqual(siteCharacterVoice(config, null), { ...config, ttsVoice: 'Fenrir' });
  for (const [humanAvatar, voice] of Object.entries({ a: 'Leda', kiyori: 'Kore', mikami: 'Autonoe', male: 'Orus', glasses: 'Rasalgethi' })) {
    assert.deepEqual(siteCharacterVoice({ ...config, humanAvatar }, { format: 'speaking' }), { ...config, humanAvatar, ttsVoice: voice });
    assert.equal(siteCharacterVoice(resolveClientPresetConfig({ preset: 'economy', humanAvatar }, false), { format: 'speaking' }).ttsVoice, voice);
  }
  assert.equal(siteCharacterVoice({ ...config, humanAvatar: 'invalid' }, { format: 'speaking' }).ttsVoice, 'Leda');
  assert.strictEqual(siteCharacterVoice({ ...config, ttsMode: 'browser' }, null).ttsVoice, 'Puck');
  assert.equal(siteCharacterVoice({ ttsModel: 'gpt-4o-mini-tts', ttsVoice: 'onyx' }, null).ttsVoice, 'onyx');
});

test('site keeper can navigate to separate English sections without falling back to Latvian', () => {
  for (const [route, path] of Object.entries({ grammar_english: '/grammar/english', course_english: '/course/english',
    grammar_practice_english: '/grammar/practice?learn_lang=en', exams_english: '/exams?learn_lang=en', plans: '/plans' })) {
    const command = dispatchStructuredCommand('navigate', { route });
    assert.equal(command.ok, true);
    assert.equal(command.action.to, path);
  }
});
