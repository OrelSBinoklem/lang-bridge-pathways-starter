import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, passiveVocabulary, checkQuestions } from './build-level-task-packages.mjs';

test('passive curriculum unions DB with current/prior JSON topics, excludes future topics', () => {
  const context = { current_words: [{ id: 1, word: 'māja' }, { id: 2, word: 'māja' }], prior_words: [{ id: 3, word: 'ūdens' }] };
  const topics = { A1: { first: { nouns: [['ūdens', 20], ['upe', 4]] } }, A2: { first: { nouns: [['māja', 8], ['pagalms', 2]] }, next: { nouns: [['nākotne', 1]] } }, B1: { later: { nouns: [['līgums', 3]] } } };
  const union = passiveVocabulary(context, topics, 'A2', 'first');
  assert.deepEqual(union.source_topics, [{ level: 'A1', topic: 'first' }, { level: 'A2', topic: 'first' }]);
  assert.deepEqual(union.words.map(w => w.word).sort(), ['māja', 'pagalms', 'upe', 'ūdens'].sort());
  assert.deepEqual(union.words.find(w => w.word === 'māja'), { word: 'māja', db_ids: [1, 2], elaipa: true });
  assert.deepEqual(union.words.find(w => w.word === 'pagalms').db_ids, []);
  assert.throws(() => passiveVocabulary(context, topics, 'A2', 'unknown'), /Unknown/);
});

test('normalization preserves Latvian diacritics and canonicalizes Unicode', () => {
  assert.equal(normalize('  MA\u0304JA  '), 'māja');
  assert.notEqual(normalize('sals'), normalize('sāls'));
});

test('statements require balanced boolean answers and normalized distinct text', () => {
  const questions = Array.from({ length: 10 }, (_, i) => [`Fakts ${i}`, i % 2 === 0, `Pierādījums ${i}`]);
  checkQuestions(questions, 'fixture');
  const duplicate = structuredClone(questions);
  duplicate[1][0] = ' FAKTS 0 ';
  assert.throws(() => checkQuestions(duplicate, 'fixture'), /unique/);
  const invalid = structuredClone(questions);
  invalid[0][1] = 'true';
  assert.throws(() => checkQuestions(invalid, 'fixture'), /malformed/);
  const unbalanced = structuredClone(questions);
  unbalanced[1][1] = true;
  assert.throws(() => checkQuestions(unbalanced, 'fixture'), /balanced/);
});

test('short course tasks support three and five distinct statements without padding to ten', () => {
  for (const length of [3, 5, 10]) {
    checkQuestions(Array.from({ length }, (_, i) => [`Fakts ${i}`, i % 2 === 0, `Pierādījums ${i}`]), 'short');
  }
  for (const length of [0, 2, 11]) {
    assert.throws(() => checkQuestions(Array.from({ length }, (_, i) => [`Fakts ${i}`, i % 2 === 0, `Pierādījums ${i}`]), 'invalid'), /three to ten/);
  }
});
