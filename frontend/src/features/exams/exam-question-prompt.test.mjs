import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const choicesSource = await readFile(new URL('./ExamChoiceOptions.tsx', import.meta.url), 'utf8');
const choicesCode = ts.transpileModule(choicesSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const choicesExports = {};
new Function('require', 'exports', choicesCode)(
  name => name.endsWith('.css') ? { default: { choiceOptions: 'choiceOptions' } } : require(name), choicesExports,
);
const source = await readFile(new URL('./ExamPage.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('ExamPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let renderer;
function find(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'renderQuestion') renderer = node.initializer.getText(ast);
  ts.forEachChild(node, find);
}
find(ast);
assert.ok(renderer, 'Test must exercise the actual active-exam question renderer');
const compiled = ts.transpileModule(`
  const { styles, ExamPhoto, ExamChoiceOptions, disabled, playing, recording, uploading, answers, speechReceived } = scope;
  export const renderQuestion = ${renderer};
`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('require', 'exports', 'scope', compiled)(require, exports, {
  styles: new Proxy({}, { get: (_, key) => String(key) }), ExamPhoto: () => null,
  ExamChoiceOptions: choicesExports.ExamChoiceOptions,
  disabled: false, playing: null, recording: null, uploading: null, answers: {}, speechReceived: [],
});
const question = { id: 'v2-s3q2', type: 'speaking', has_audio: true, prompt: 'Jūs gribat salabot velosipēdu. Uzziniet, kad var atnākt uz darbnīcu!', points: 1 };
const render = (overrides, inline = false) => renderToStaticMarkup(exports.renderQuestion({ ...question, ...overrides }, inline));

test('audio-only spoken question never prints its transcript, even from an old API response', () => {
  const html = render();
  assert.ok(!html.includes(question.prompt));
  assert.ok(!html.includes('<label'));
  assert.ok(html.includes('Слушать вопрос'));
  assert.ok(html.includes('Ответить голосом'));
});

test('unvoiced spoken and written choice questions retain their visible prompts', () => {
  assert.ok(render({ has_audio: false }).includes(question.prompt));
  const choice = render({ type: 'choice', has_audio: false, options: [{ id: 'a', text: 'A' }] });
  assert.ok(choice.includes(question.prompt));
  assert.ok(choice.includes('<select'));
  assert.ok(!choice.includes('Слушать вопрос'));
});

test('paired reading text has three visible radio choices in one labelled group', () => {
  const html = render({ type: 'choice', has_audio: false, options: [{ id: '0', text: 'First' }, { id: '1', text: 'Second' }, { id: '2', text: 'Third' }] }, true);
  assert.equal((html.match(/type="radio"/g) || []).length, 3);
  assert.equal((html.match(/name="v2-s3q2"/g) || []).length, 3);
  assert.ok(html.includes(`<legend>${question.prompt}</legend>`));
  assert.ok(!html.includes('<select'));
});
