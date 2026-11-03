import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSCRIPTION_CONTEXT_RULES } from '../../../../resources/tutor-flow/transcription-contract.mjs';
import { buildTutorRules } from './TutorRulesBuilder.mjs';

test('shared transcription context rules preserve the two existing instructions', () => {
  assert.deepEqual(TRANSCRIPTION_CONTEXT_RULES, [
    'transcript_candidates - это альтернативные варианты STT для одного и того же аудио, а не отдельные сообщения пользователя.',
    'transcription_strategy показывает, какая STT-модель и какая языковая подсказка использовались для каждого варианта.',
  ]);
});

for (const basic of [false, true]) {
  test(`tutor rules contain both shared transcription instructions once and in order (basic=${basic})`, () => {
    const lines = buildTutorRules({ basic }).split('\n');
    for (const rule of TRANSCRIPTION_CONTEXT_RULES) {
      assert.equal(lines.filter(line => line === rule).length, 1);
    }
    const start = lines.indexOf(TRANSCRIPTION_CONTEXT_RULES[0]);
    assert.deepEqual(lines.slice(start, start + TRANSCRIPTION_CONTEXT_RULES.length), TRANSCRIPTION_CONTEXT_RULES);
    assert.ok(lines[start + TRANSCRIPTION_CONTEXT_RULES.length].startsWith('current_page -'));
  });
}
