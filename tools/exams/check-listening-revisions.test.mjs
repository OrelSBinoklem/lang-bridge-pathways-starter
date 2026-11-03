import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectListeningPack } from './check-listening-revisions.mjs';

function pack() {
  return { revision: 'fixture', variants: Array.from({ length: 5 }, (_, v) => ({ level: 'A2', position: v + 1, expected_sha256: 'a'.repeat(64),
    replace_sections: { listening: { skill: 'listening', seconds: 1500, tasks: Array.from({ length: 3 }, (_, t) => ({
      id: `v${v}-t${t}`, segments: [{ speaker: 'male', text: `Labdien! ${v} ${t}` }], transcript: `Labdien! ${v} ${t}`,
      questions: Array.from({ length: 5 }, (_, q) => ({ id: `v${v}-t${t}-q${q}`, type: 'choice', prompt: 'Kad?', points: 1,
        options: [{ id: '0', text: 'Šodien' }, { id: '1', text: 'Rīt' }], correct: '0', explanation: 'Šodien.', explanation_translations: { ru: 'Сегодня.', uk: 'Сьогодні.' } })),
    })) } } })) };
}

test('valid independent five-form structural fixture', () => assert.deepEqual(inspectListeningPack(pack()).errors, []));
test('accepts only the explicit slow pace directive', () => {
  const p = pack(), segment = p.variants[0].replace_sections.listening.tasks[0].segments[0];
  segment.pace = 'slow';
  assert.deepEqual(inspectListeningPack(p).errors, []);
  segment.pace = 'fast';
  assert.ok(inspectListeningPack(p).errors.some(e => e.includes('unsupported speech pace')));
});
test('rejects transcript mismatch and embedded audio tags', () => {
  const p = pack(); p.variants[0].replace_sections.listening.tasks[0].segments[0].text = '[calm] Labdien!';
  assert.ok(inspectListeningPack(p).errors.length >= 2);
});
test('rejects repeated passages across variants', () => {
  const p = pack(), task = p.variants[1].replace_sections.listening.tasks[0];
  task.segments = structuredClone(p.variants[0].replace_sections.listening.tasks[0].segments); task.transcript = task.segments[0].text;
  assert.ok(inspectListeningPack(p).errors.some(e => e.includes('identical passage')));
});
test('rejects wrong timer, key and missing comment translation', () => {
  const p = pack(), s = p.variants[0].replace_sections.listening; s.seconds = 60;
  s.tasks[0].questions[0].correct = 'other'; delete s.tasks[0].questions[0].explanation_translations.uk;
  assert.equal(inspectListeningPack(p).errors.length, 3);
});
test('rejects non-listening scope and missing positions', () => {
  const p = pack(); p.variants[0].replace_sections.reading = {}; p.variants[0].position = 2;
  assert.equal(inspectListeningPack(p).errors.length, 2);
});
