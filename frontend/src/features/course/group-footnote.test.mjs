import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the garden caption overlays its positioned card without changing layout or taking pointer events', () => {
  const css = readFileSync(new URL('./course-path.module.css', import.meta.url), 'utf8');
  const rule = css.match(/^\.groupFootnote \{([^}]+)\}/m)?.[1];
  assert.ok(rule);
  assert.match(rule, /position: absolute;/);
  assert.match(rule, /bottom: 6px;/);
  assert.match(rule, /left: 14px; right: 14px;/);
  assert.match(rule, /margin: 0;/);
  assert.match(rule, /color: #fff;/);
  assert.match(rule, /text-shadow: none;/);
  assert.doesNotMatch(css, /:global\(\.dark\) \.groupFootnote/);
  assert.match(css, /^\.group \{[^}]*position: relative;/m);
  assert.match(css, /\.group\[data-effect-focus=host\] \.groupFootnote \{ pointer-events: none;/);
});
