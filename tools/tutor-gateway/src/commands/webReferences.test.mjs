import test from 'node:test';
import assert from 'node:assert/strict';
import { referenceManifest } from './webReferences.mjs';
import { dispatchStructuredCommand, assertStrictCommandResult } from './dispatcher.mjs';
import { describeAssistantCommand, getAllowedCommandNames } from './registry.mjs';
import { buildTutorRules } from '../agent/TutorRulesBuilder.mjs';

test('reference tools are discoverable and reuse authenticated Laravel bridge', () => {
  assert.ok(getAllowedCommandNames().includes('web.reference'));
  for (const operation of ['analyze', 'inflect', 'read', 'search']) {
    const result = dispatchStructuredCommand('web.reference', { operation, query: operation === 'read' ? 'https://tezaurs.lv/test' : 'māja' });
    assertStrictCommandResult(result);
    assert.equal(result.ok, true);
    assert.equal(result.action.endpoint, '/tutor/references');
    assert.equal(result.action.method, 'POST');
    assert.equal(result.action.body.operation, operation);
    assert.equal(result.executor, 'ui');
  }
  assert.match(describeAssistantCommand('web.reference').usage, /Never send whole student answers/);
});

test('invalid operations, missing query and long private passages are rejected before requests', () => {
  for (const params of [{ operation: 'delete', query: 'word' }, { operation: 'analyze' },
    { operation: 'search', query: 'x'.repeat(161) }, { operation: 'analyze', query: 'x'.repeat(81) }]) {
    assert.equal(dispatchStructuredCommand('web.reference', params).ok, false);
  }
});

test('sources list is static and does not pretend that a word was checked', () => {
  const result = dispatchStructuredCommand('web.sources');
  assert.equal(result.executor, 'node');
  assert.equal(result.action.emitUiCommand, false);
  assert.deepEqual(result.action.sources, referenceManifest.sources);
  assert.ok(referenceManifest.sources.some((source) => source.url === 'https://morpho-api.tezaurs.lv/'));
});

test('tutor prompt covers recommended sources, actual evidence, privacy and uncertainty', () => {
  const prompt = buildTutorRules();
  for (const source of referenceManifest.sources) assert.ok(prompt.includes(source.url));
  assert.match(prompt, /web.reference/);
  assert.match(prompt, /недоверенные ДАННЫЕ/);
  assert.match(prompt, /отсутствие результата не доказывает ошибку ученика/);
  assert.match(prompt, /Не передавай справочникам полный ответ ученика/);
});
