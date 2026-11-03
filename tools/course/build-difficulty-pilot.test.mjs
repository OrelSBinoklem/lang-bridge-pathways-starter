import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDifficultyPilot } from './build-difficulty-pilot.mjs';
import { digest } from './check-listening-revisions.mjs';

function fixture() {
  const local = { source: 'current_course_select_only', reading_baseline: [] }, production = { variants: [] }, previous = [], pilots = [];
  for (const category of [1763, 1764]) {
    const previousPack = { variants: [] }, pilot = { schema_version: 1, category_id: category, level: 'A1', variants: [] };
    for (const kind of ['reading_binary', 'lv_to_ru']) for (let index = 0; index < 5; index++) {
      const id = production.variants.length + 1, block = category + (kind === 'lv_to_ru' ? 1 : 0);
      const config = kind === 'reading_binary' ? { task_kind: kind, text: `Anna lasa tekstu ${category} ${index}.`,
        questions: Array.from({ length: 10 }, (_, q) => ({ statement: `Apgalvojums ${q}.`, correct: q % 2 === 0, explanation: 'Evidence' })) }
        : { task_kind: kind, source_text: `Anna lasa tekstu ${category} ${index}.`, reference_translation: 'Анна читает.' };
      const common = { category_id: category, level: 'A1', seed_key: `variant:${index + 1}`, title: `Before ${id}`, config, config_sha256: digest(config) };
      production.variants.push({ id, block_id: block, ...common });
      local.reading_baseline.push({ id: id + 1000, block_id: block + 1000, page_id: category + 2000, ...common });
      previousPack.variants.push({ variant_id: id, title: common.title, config });
      const after = kind === 'reading_binary' ? { task_kind: kind, text: `Mani sauc Anna ${category} ${index}. Prieks iepazīties!`,
        questions: Array.from({ length: 5 }, (_, q) => ({ statement: `Apgalvojums ${q}.`, correct: q % 2 === 0, explanation: 'Evidence' })),
        assisted_questions: Array.from({ length: 5 }, (_, q) => `Утверждение ${q}.`) }
        : { task_kind: kind, source_text: `Labdien, Anna ${category} ${index}!`, reference_translation: 'Добрый день, Анна!' };
      pilot.variants.push({ variant_id: id, block_id: block, title: `After ${id}`, action: 'rewrite', config: after,
        changes: ['Shorter'], prerequisites: ['Ready greeting'], target_patterns: ['Mani sauc'], lexical_notes: ['Corpus reference'],
        question_review: kind === 'reading_binary' ? Array.from({ length: 5 }, (_, q) => ({ index: q, quote: 'Mani sauc Anna', rationale: 'Evidence' })) : [] });
    }
    previous.push(previousPack); pilots.push(pilot);
  }
  return { local, production, previous, pilots };
}

test('pilot maps logical identities without replacing local IDs or altering other entries', () => {
  const f = fixture();
  f.local.reading_baseline.push({ id: 9000, block_id: 9000, page_id: 9000, category_id: 9999, level: 'B2', seed_key: 'variant:1', title: 'Other', config: { task_kind: 'lv_to_ru', source_text: 'Cits teksts.', reference_translation: 'Другой текст.' }, config_sha256: digest({ task_kind: 'lv_to_ru', source_text: 'Cits teksts.', reference_translation: 'Другой текст.' }) });
  const result = buildDifficultyPilot(f.local, f.production, f.previous, f.pilots);
  assert.equal(result.entries.length, 21);
  assert.equal(result.entries[0].variant_id, 1001);
  assert.equal(result.entries.filter(entry => entry.action === 'rewrite').length, 20);
  assert.equal(result.entries.at(-1).action, 'keep');
});

test('stale content, changed ownership, unreviewed evidence and assist mismatches abort preparation', () => {
  for (const mutate of [
    f => { f.local.reading_baseline[0].title = 'Editor change'; },
    f => { f.pilots[0].variants[0].block_id++; },
    f => { f.pilots[0].variants[0].question_review[0].quote = 'Invented evidence'; },
    f => { f.pilots[0].variants[0].config.assisted_questions.pop(); },
    f => { f.pilots[0].variants[0].config.questions[0].correct = 'false'; },
    f => { f.pilots[0].variants[0].config.audio_url = '/wrong.mp3'; },
  ]) {
    const f = fixture(); mutate(f);
    assert.throws(() => buildDifficultyPilot(f.local, f.production, f.previous, f.pilots));
  }
});
