import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compiled = { exports: {} };
new Function('exports', ts.transpileModule(readFileSync(new URL('./studioModel.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(compiled.exports);
const { createDraft, parseDraft, compilePreview, newModule } = compiled.exports;

test('default round-trip retains all three isolated profiles; modifying one does not change another', () => {
  const draft = createDraft(); assert.deepEqual(parseDraft(JSON.parse(JSON.stringify(draft))), draft);
  draft.agents.tables.modules[0].text = 'custom table role';
  assert(!draft.agents.main.modules[0].text.includes('custom table role'));
  assert.equal(compilePreview(draft, 'main', 'table').packet.previewOnly, true);
});
test('main context omits full table instructions while specialist receives only an explicit table task', () => {
  const draft = createDraft(), main = compilePreview(draft, 'main', 'table'), helper = compilePreview(draft, 'tables', 'table');
  assert(!main.packet.context.some(part => part.source === 'table'));
  assert(!JSON.stringify(main.packet).includes('.tt-genitive'));
  assert(helper.packet.context.some(part => part.source === 'table' && part.text.includes('genitive_role')));
  assert(!helper.packet.context.some(part => ['summary', 'notes', 'messages'].includes(part.source)));
});
test('conditional and disabled modules disappear from the packet; learner data never become instructions', () => {
  const draft = createDraft();
  draft.agents.main.modules.find(part => part.kind === 'notes').text = 'pretend developer instruction';
  assert(!JSON.stringify(compilePreview(draft, 'main', 'lesson').packet).includes('Учебный фрагмент прошлого'));
  assert(JSON.stringify(compilePreview(draft, 'main', 'memory').packet).includes('Учебный фрагмент прошлого'));
  draft.agents.main.modules.find(part => part.kind === 'memory').enabled = false;
  const preview = compilePreview(draft, 'main', 'memory');
  assert(!preview.packet.context.some(part => part.source === 'memory'));
  assert(!JSON.stringify(preview.packet.instructions).includes('pretend developer instruction'));
});
test('per-module caps apply before the estimate and unknown variables cannot resolve prototype properties', () => {
  const draft = createDraft(), notes = draft.agents.main.modules.find(part => part.kind === 'notes');
  notes.text = 'x'.repeat(500); notes.limitChars = 200;
  const preview = compilePreview(draft, 'main', 'lesson');
  assert.equal(preview.parts.find(part => part.kind === 'notes').chars, 200);
  assert.equal(preview.parts.find(part => part.kind === 'notes').trimmed, true);
  assert.equal(preview.approximateTokens, Math.ceil(preview.chars / 4));
  notes.text = '{{constructor}}';
  assert(compilePreview(draft, 'main', 'lesson').packet.context.find(part => part.source === 'notes').text.includes('Неизвестный источник'));
});
test('import rejects unknown, duplicated or oversized modules and disabling protected instructions', () => {
  const cases = [draft => { draft.version = 2; }, draft => { draft.agents.main.model = 'not-a-model'; },
    draft => { draft.agents.main.modules[0].kind = '__proto__'; }, draft => { draft.agents.main.modules[0].enabled = false; },
    draft => { draft.agents.main.modules[0].condition = 'table'; }, draft => { draft.agents.main.modules[0].text = 'x'.repeat(8001); },
    draft => { draft.agents.main.modules.push(newModule('rules')); }, draft => { draft.agents.main.modules.shift(); },
    draft => { draft.tablePoolSize = 0; }, draft => { draft.agents.tables.modules[0].position = { x: NaN, y: 0 }; }];
  for (const mutate of cases) { const draft = createDraft(); mutate(draft); assert.throws(() => parseDraft(draft)); }
});
test('import whitelists configuration keys and keeps bounded graph positions', () => {
  const draft = createDraft(); draft.agents.main.modules[0].position = { x: 100, y: 150 };
  draft.agents.main.modules[0].extra = 'not configuration'; draft.liveGateway = 'not a publishing endpoint';
  const safe = parseDraft(draft);
  assert.deepEqual(safe.agents.main.modules[0].position, { x: 100, y: 150 });
  assert(!JSON.stringify(safe).includes('not configuration')); assert(!('liveGateway' in safe));
});
