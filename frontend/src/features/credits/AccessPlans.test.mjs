import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
let locale = 'ru', account = null;
const module = { exports: {} };
const code = ts.transpileModule(readFileSync(new URL('./AccessPlans.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
new Function('require', 'module', 'exports', code)(name => {
  if (name === 'next-intl') return { useLocale: () => locale };
  if (name === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) };
  if (name.endsWith('useTutorPresets')) return { useTutorPresets: () => ({ data: null, account, selected: 'standard', select() {}, error: '' }) };
  if (name.endsWith('TutorPresetPicker')) return { TutorPresetPicker: () => React.createElement('div', { 'data-presets': true }) };
  if (name.endsWith('.css')) return { __esModule: true, default: {} };
  return require(name);
}, module, module.exports);

test('Russian and Ukrainian plans show permanent free access and paid AI without purchase or trial controls', () => {
  for (locale of ['ru', 'uk']) {
    const html = renderToStaticMarkup(React.createElement(module.exports.AccessPlans));
    assert(!html.includes('0 €'));
    assert(html.includes(locale === 'ru' ? 'Бесплатно' : 'Безкоштовно'));
    assert(html.includes('1 кредит = $1'));
    assert(!html.includes('$5')); assert(!html.includes('5 кредит')); assert(!html.includes('бесплатный месяц')); assert(!html.includes('безкоштовний місяць'));
    assert(!html.includes('<button')); assert(html.includes('data-presets'));
    assert(!html.includes('href="/register"'));
  }
});

test('signed-in plans omit the removed start button and account wrapper', () => {
  locale = 'ru'; account = 7;
  const html = renderToStaticMarkup(React.createElement(module.exports.AccessPlans));
  assert(!html.includes('href="/course"')); assert(!html.includes('href="/register"'));
});
