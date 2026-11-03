import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const loaded = { exports: {} };
const source = readFileSync(new URL('./EffectVariantSwitch.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
new Function('require', 'exports', compiled)(name => name.endsWith('.module.css') ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) } : require(name), loaded.exports);
const { EffectVariantSwitch } = loaded.exports;
const variants = [{ id: 'first', icon: 'A', label: { ru: 'Первый', uk: 'Перший' } }, { id: 'second', icon: 'B', label: { ru: 'Второй', uk: 'Другий' } }];
const defaults = { variants, activeId: 'first', focused: false, uk: false, onSelect() {}, onFocus() {}, cardMode: true, onCardMode() { throw Error('Removed control must not be invoked'); } };

test('multiple variants retain their buttons but never render the card/background toggle, including legacy props', () => {
  for (const uk of [false, true]) for (const cardMode of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(EffectVariantSwitch, { ...defaults, uk, cardMode }));
    assert.equal((html.match(/<button /g) ?? []).length, 2);
    assert.equal((html.match(/role="radio"/g) ?? []).length, 2);
    assert.doesNotMatch(html, /▣|▤|Вернуть на фон|Показать в карточке|Повернути на тло|Показати в картці/);
  }
});

test('single/absent variants retain only the full-screen focus button and its return state', () => {
  for (const count of [0, 1]) for (const focused of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(EffectVariantSwitch, { ...defaults, variants: variants.slice(0, count), focused }));
    assert.equal((html.match(/<button /g) ?? []).length, 1);
    assert.match(html, focused ? /Вернуть содержимое/ : /Только эффект/);
    assert.doesNotMatch(html, /▣|▤/);
  }
});

test('the sole photo garland has a photo-stack icon and retains its focus action', () => {
  const photo = { id: 'legacy-1775', icon: '📷', label: { ru: 'Гирлянда фотографий', uk: 'Гірлянда фотографій' } };
  let focused = 0;
  for (const state of [false, true]) {
    const props = { ...defaults, variants: [photo], focused: state, onFocus: () => focused++ };
    const html = renderToStaticMarkup(React.createElement(EffectVariantSwitch, props));
    assert.match(html, /<svg /);
    assert.match(html, /<rect x="7" y="2" width="14" height="17"/);
    assert.doesNotMatch(html, /↩️/);
    EffectVariantSwitch(props).props.children.props.onClick({ stopPropagation() {} });
  }
  assert.equal(focused, 2);
});

test('clicking another variant still selects it; clicking the current one still opens full-screen focus', () => {
  let focused = 0;
  const selected = [];
  const tree = EffectVariantSwitch({ ...defaults, onFocus: () => focused++, onSelect: id => selected.push(id) });
  const buttons = tree.props.children;
  const event = { stopPropagation() {} };
  buttons[0].props.onClick(event);
  buttons[1].props.onClick(event);
  assert.equal(focused, 1);
  assert.deepEqual(selected, ['second']);
});

test('only the active button receives the visible return marker while content is hidden', () => {
  for (const count of [0,1,2]) for (const uk of [false,true]) {
    const props={...defaults,variants:variants.slice(0,count),focused:true,seeThrough:true,uk};
    const html=renderToStaticMarkup(React.createElement(EffectVariantSwitch,props));
    assert.equal((html.match(/data-effect-return="true"/g)??[]).length,1);
    assert.equal((html.match(/pi-undo/g)??[]).length,1);
    assert.match(html,uk?/Повернути вміст|повернути вміст/:/Вернуть содержимое|вернуть содержимое/);
    const ordinary=renderToStaticMarkup(React.createElement(EffectVariantSwitch,{...props,focused:false}));
    assert.doesNotMatch(ordinary,/data-effect-return|pi-undo/);
  }
});

test('the highlighted return button still restores content without selecting another variant', () => {
  let returns=0;
  const tree=EffectVariantSwitch({...defaults,focused:true,onFocus:()=>returns++,onSelect:()=>assert.fail('Unexpected variant change')});
  const active=tree.props.children.find(button=>button.props['data-effect-return']==='true');
  active.props.onClick({stopPropagation(){}});
  assert.equal(returns,1);
});

test('normal buttons overlay the card without taking layout space; focused toolbar is centered in both viewport axes', () => {
  const css = readFileSync(new URL('./effect-variant-switch.module.css', import.meta.url), 'utf8');
  const base = css.match(/^\.switch \{([^}]+)\}/m)?.[1];
  assert.ok(base);
  assert.match(base, /position: absolute;/);
  assert.match(base, /top: 10px;/);
  assert.match(base, /right: 10px;/);
  assert.match(base, /margin: 0;/);
  assert.doesNotMatch(base, /transform:/);
  assert.match(base, /padding: 4px;/);
  assert.match(css, /\.option \{[^}]*width: 32px;[^}]*height: 32px;/);
  const focused = css.match(/\.switch\.focused\.seeThrough \{([^}]+)\}/)?.[1];
  assert.ok(focused);
  assert.match(focused, /position: fixed;/);
  assert.match(focused, /top: 50%;/);
  assert.match(focused, /left: 50%;/);
  assert.match(focused, /right: auto;/);
  assert.match(focused, /transform: translate\(-50%, -50%\);/);
  assert.match(css, /\.focused \.option \{[^}]*width: 44px;[^}]*height: 44px;/);
  const courseCss = readFileSync(new URL('../course-path.module.css', import.meta.url), 'utf8');
  assert.match(courseCss, /\.group \{[^}]*overflow: hidden;/);
  assert.doesNotMatch(courseCss, /\.group:has\(> :global\(\[data-effect-toolbar\]\)\)/);
  const overlay = readFileSync(new URL('./CardEffect.tsx', import.meta.url), 'utf8');
  assert.match(overlay, /data-course-effect-surface=""[^\n]*overflow: 'hidden'/);
});
