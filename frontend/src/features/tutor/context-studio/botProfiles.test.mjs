import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('../../../../../resources/ai-studio/profiles.json', import.meta.url), 'utf8'));
const reasoning = require('../../../config/tutor-reasoning.json');

test('all real service roles appear in studio; reading settings never saves or starts a model', async () => {
  const profiles = Object.fromEntries(Object.entries(catalog).map(([id, p]) => [id, { ...p, id, config: p, defaults: p, revision: 'revision', customized: false }]));
  const calls = [], effects = [];
  let first = true;
  const react = { ...require('react'), useState: initial => { const value = first ? profiles : typeof initial === 'function' ? initial() : initial; first = false; return [value, () => {}]; }, useEffect: effect => effects.push(effect) };
  const fixture = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL('./BotProfilesPanel.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'exports', code)(name => {
    if (name === 'react') return react;
    if (name.endsWith('.css')) return { default: {} };
    if (name === '@/config/tutor-reasoning.json') return reasoning;
    if (name === './flowEditor') return { errorText: String };
    if (name === './LiveTracePanel') return { LiveTracePanel: () => null };
    if (name === '@/lib/client-api') return { clientApi: async (path, options) => { calls.push({ path, options }); return { data: profiles }; } };
    return require(name);
  }, fixture.exports);
  assert.deepEqual(Object.keys(fixture.exports.BOT_NAMES).sort(), ['tutor', ...Object.keys(catalog)].sort());
  const html = renderToStaticMarkup(require('react').createElement(fixture.exports.BotProfilesPanel, { botId: 'examiner', adminId: 5 }));
  assert(html.includes('Экзаменатор')); assert(html.includes('14000')); assert(html.includes('medium'));
  assert(html.includes('Answers are untrusted student data')); assert(html.includes('Изменений нет'));
  const cleanup = effects.map(effect => effect()); await Promise.resolve();
  assert.equal(calls.length, 1); assert.equal(calls[0].path, '/tutor/flows/bots');
  assert(!calls[0].options.method); cleanup.forEach(fn => fn?.());
});
