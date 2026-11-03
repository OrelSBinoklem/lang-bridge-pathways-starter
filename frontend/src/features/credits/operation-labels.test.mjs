import test from 'node:test';
import assert from 'node:assert/strict';
import { operationLabel } from './operation-labels.ts';

test('specific operation names are separate from the model and legacy data stays honest', () => {
  assert.equal(operationLabel({ kind: 'text', purpose: 'translation_check' }), 'Проверка перевода');
  assert.equal(operationLabel({ kind: 'speech' }), 'Озвучка ответа');
  assert.equal(operationLabel({ kind: 'text' }), 'AI-запрос');
  assert.equal(operationLabel({ kind: 'text', purpose: 'bot_answer' }, true), 'Відповідь бота');
  assert.equal(operationLabel({ kind: 'subscription' }), 'Обычный доступ на 3 месяца');
});
