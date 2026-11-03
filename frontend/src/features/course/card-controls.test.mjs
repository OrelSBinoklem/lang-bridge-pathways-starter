import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('./CoursePath.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('CoursePath.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'PracticeTile');
assert.ok(component);
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const awards = { exports: {} };
new Function('exports', compile(readFileSync(new URL('./practice-awards.ts', import.meta.url), 'utf8')))(awards.exports);
const metadata = { exports: {} };
new Function('exports', compile(readFileSync(new URL('../lessons/practiceSkills.ts', import.meta.url), 'utf8')))(metadata.exports);
const loaded = { exports: {} };
const Link = ({ href, title, 'aria-label': label, className, children }) => React.createElement('a', { href, title, 'aria-label': label, className }, children);
const styles = new Proxy({}, { get: (_, key) => String(key) });
new Function('require', 'exports', 'Link', 'styles', 'PRACTICE_SKILLS', 'getPracticeAwards', 'courseRankLabel', compile('export ' + component.getText(parsed)))(require, loaded.exports, Link, styles, metadata.exports.PRACTICE_SKILLS, awards.exports.getPracticeAwards, rank => rank);
const { PracticeTile } = loaded.exports;
const visibleSkills = new Set(['listening', 'reading', 'writing', 'speaking']);
const render = (group, locked = false) => renderToStaticMarkup(React.createElement(PracticeTile, { group, visibleSkills, uk: false, locked }));

test('one compact practice link names all four skills and keeps the existing next-lesson choice', () => {
  const html = render({ skills: {
    listening: { slug: 'listen', progress: { completed: true, passed: 1, total: 1 } },
    reading: { slug: 'read', progress: { completed: false, passed: 0, total: 2 } },
  } });
  assert.equal((html.match(/<a /g) ?? []).length, 1);
  assert.match(html, /href="\/lessons\/read"/);
  assert.match(html, /pi-arrow-right/);
  assert.equal((html.match(/data-practice-round=/g) ?? []).length, 3);
  assert.match(html, /aria-label="Практика: Слушание, Чтение, Письмо, Говорение/);
});

test('practice preserves all three award rounds and actual completion progress', () => {
  const html = render({ skills: { listening: { slug: 'listen', progress: { completed: true, passed: 1, total: 1 } } } });
  assert.equal((html.match(/data-practice-round=/g) ?? []).length, 3);
  assert.equal((html.match(/data-state="completed"/g) ?? []).length, 1);
  assert.match(html, /100% \(1\/1\)/);
  assert.equal((html.match(/practiceStarBacking/g) ?? []).length, 2);
});

test('star backing follows only the PrimeIcons silhouette, not a rectangular award box', () => {
  const css = readFileSync(new URL('./course-path.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.practiceAward \{[^}]*background: transparent;/);
  assert.match(css, /\.practiceAward i \{[^}]*grid-area: 1 \/ 1;/);
  assert.match(css, /\.practiceAward \.practiceStarBacking \{ color: var\(--practice-surface\); \}/);
  const html = render({ skills: { listening: { slug: 'listen', progress: { completed: false, passed: 0, total: 1 } } } });
  assert.equal((html.match(/practiceStarBacking/g) ?? []).length, 3);
  assert.equal((html.match(/pi-star"/g) ?? []).length, 3);
});

test('unavailable practice is not a clickable target and creates no fake lesson', () => {
  const html = render({ skills: {} });
  assert.doesNotMatch(html, /<a |href=/);
  assert.match(html, /aria-disabled="true"/);
  assert.match(html, /practiceLocked/);
  assert.equal((html.match(/data-state="empty"/g) ?? []).length, 3);
});

test('practice recommended for later is muted but remains a real, keyboard-accessible link', () => {
  const group = { skills: { listening: { slug: 'listen', progress: { completed: false, passed: 0, total: 1 } } } };
  const html = render(group, true);
  assert.match(html, /class="practiceTile practiceLocked"/);
  assert.match(html, /href="\/lessons\/listen"/);
  assert.doesNotMatch(html, /aria-disabled|tabindex="-1"/);
  assert.match(html, /можно попробовать сейчас/);
  assert.doesNotMatch(render(group), /practiceLocked/);
  const css = readFileSync(new URL('./course-path.module.css', import.meta.url), 'utf8');
  const locked = css.match(/\.practiceTile\.practiceLocked \{([^}]+)\}/)?.[1];
  assert.match(locked, /color: #7d878d;/);
  assert.doesNotMatch(locked, /opacity:|pointer-events:|cursor: not-allowed/);
});

test('only the active effect card passes pointer hit-testing; other cards and real controls remain targets', () => {
  const css = readFileSync(new URL('./course-path.module.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.group \{[^}]*pointer-events: none;/);
  assert.match(css, /\.group\[data-effect-focus=host\] \{ pointer-events: none;/);
  assert.match(css, /\.group\[data-effect-focus=host\] \.groupHeader, \.group\[data-effect-focus=host\] \.groupFootnote \{ pointer-events: none;/);
  assert.doesNotMatch(css, /^\.groupHeader, \.groupHeader \*/m);
  assert.match(css, /button\.skillIcon:not\(:disabled\), \.groupHeader a\.practiceTile \{ pointer-events: auto;/);
  assert.match(css, /\.groupHeader button\.skillIcon \*, \.groupHeader a\.practiceTile \* \{ pointer-events: none;/);
  assert.match(css, /\[data-effect-toolbar\]\) button \{ pointer-events: auto;/);
  assert.match(css, /\.group \.learningState \{ display: none;/);
  assert.match(css, /\.practiceTile \{[^}]*height: 48px;[^}]*border-radius: 6px;/);
});

test('any click on an inactive card selects it; a click through an active card cannot reset the scene', () => {
  let click;
  const visit = node => {
    if (ts.isJsxOpeningElement(node) && node.attributes.properties.some(p => p.name?.getText(parsed) === 'data-course-group')) {
      click = node.attributes.properties.find(p => p.name?.getText(parsed) === 'onClick')?.initializer?.expression;
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  assert.ok(click, 'The card itself must be selectable, not only its study buttons');
  for (const isThemed of [false, true]) {
    const active = [], themed = [], handlers = {};
    new Function('exports', 'isThemed', 'group', 'effect', 'setActiveGroupId', 'setThemedGroupId', compile('export const handle = ' + click.getText(parsed)))(handlers, isThemed, { id: 17 }, {}, id => active.push(id), id => themed.push(id));
    handlers.handle();
    assert.deepEqual(active, isThemed ? [] : [17]);
    assert.deepEqual(themed, isThemed ? [] : [17]);
  }
  for (const step of ['wordsStep', 'grammarStep']) assert.ok(source.includes(`if (effect) setThemedGroupId(group.id);\n                    setSelectedId(${step}.id);`));
  const overlay = readFileSync(new URL('./effects/CardEffect.tsx', import.meta.url), 'utf8');
  assert.match(overlay, /data-course-effect-surface=""[^\n]*pointerEvents: 'auto'/);
  assert.match(overlay, /pointerEvents: 'none'[^\n]*boxShadow/);
});
