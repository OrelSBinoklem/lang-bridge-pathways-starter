import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
let balance, locale = 'ru';
const loaded = { exports: {} };
const code = ts.transpileModule(readFileSync(new URL('./CreditBalance.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
new Function('require', 'exports', code)(name => {
  if (name === 'react') return { ...React, useState: initial => [initial === null ? balance : initial, () => {}] };
  if (name === 'next-intl') return { useLocale: () => locale };
  if (name === 'primereact/dialog') return { Dialog: ({ children }) => React.createElement('section', null, children) };
  if (name === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) };
  if (name === './operation-labels') return { operationLabel: () => 'Fixture' };
  if (name === './CreditStatistics') return { CreditStatistics: () => null };
  if (name.endsWith('.css')) return { __esModule: true, default: {} };
  if (name.startsWith('@/')) return {};
  return require(name);
}, loaded.exports);

test('balance button rounds to exactly two decimal places in Russian and Ukrainian', () => {
  for (locale of ['ru', 'uk']) for (const [value, expected] of [[49.992118, '49,99'], [1, '1,00'], [0, '0,00'], [1.2, '1,20'], [1.999, '2,00']]) {
    balance = { available: value, reserved: 0, commission_percent: 50, history: [] };
    const html = renderToStaticMarkup(React.createElement(loaded.exports.CreditBalance));
    const button = html.match(/<button[^>]*>[\s\S]*?<\/button>/)[0];
    assert.ok(button.includes(expected), button);
  }
});

test('detailed history retains micro-credit precision', () => {
  balance = { available: 49.992118, reserved: 0, commission_percent: 50, history: [{ id: 'fixture', amount_micros: -1, status: 'settled' }] };
  const html = renderToStaticMarkup(React.createElement(loaded.exports.CreditBalance));
  assert.ok(html.includes('-0,000001'));
  assert.equal(balance.available, 49.992118);
});
