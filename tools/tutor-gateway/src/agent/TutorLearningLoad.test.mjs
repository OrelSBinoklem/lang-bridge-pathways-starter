import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTutorRules } from './TutorRulesBuilder.mjs';

test('strong reasoning does not require advanced language or invented mastery', () => {
  const rules = buildTutorRules();
  assert.match(rules, /режим сложного вопроса не требует более сложного латышского/);
  assert.match(rules, /Начало A1 не означает освоение всего уровня/);
  assert.match(rules, /не доказывают самостоятельное владение конструкцией/);
  assert.match(rules, /Экзаменационные условия не упрощай/);
});
