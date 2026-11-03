import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server'), { load } = require('cheerio');
const fixture = { exports: {} };
new Function('require', 'exports', ts.transpileModule(readFileSync(new URL('./CourseContinueSuggestions.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText)(name => name.endsWith('.css') ? { default: {} } : require(name), fixture.exports);
const item = (skill, title, href) => ({ skill, title, href, group_title: 'First group', level: 'A1', percent: 20 });
const value = { target: 80, status: 'ready', next_available_at: null,
  available: [item('words', 'Words first', '/dictionaries/20/category/1'), item('grammar', 'Task two', '/lessons/grammar#lesson-block-2'), item('reading', 'Task three', '/lessons/practice#lesson-block-3')] };
value.next = value.available[0];
const render = props => load(renderToStaticMarkup(React.createElement(fixture.exports.CourseContinueSuggestions, { value, loading: false, error: false, uk: false, onNavigate() {}, ...props })));

test('popover nests categories and tasks beneath a single course group heading', () => {
  for (const uk of [false, true]) {
    const $ = render({ uk });
    assert.equal($('ol > li').length, 1); assert.deepEqual($('ol a').map((_, a) => $(a).attr('href')).get(), value.available.map(i => i.href));
    assert.equal($('ol > li > div').text(), 'A1 · First group');
    assert.deepEqual($('ol > li > ul > li > strong').map((_, element) => $(element).text()).get(), uk ? ['Словник', 'Граматика', 'Практика'] : ['Словарь', 'Грамматика', 'Практика']);
    assert.equal($('ol > li > ul > li > ul > li > a').length, 3);
    assert($('ol a').eq(0).text().includes('Words first')); assert($('ol a').eq(2).text().includes(uk ? 'Читання' : 'Чтение'));
    assert(!$.text().includes('%'));
  }
});
test('rest, completion, loading and errors never invent actionable tasks', () => {
  for (const status of ['rest', 'complete']) {
    const $ = render({ value: { ...value, status, available: [], next: null } });
    assert.equal($('a').length, 0); assert($.text().includes(status === 'rest' ? 'отдохнуть' : 'достигли'));
  }
  assert.equal(render({ error: true })('a').length, 0);
  assert(render({ value: undefined, loading: true }).text().includes('Проверяем'));
  assert.equal(render({ value: { ...value, available: undefined } })('ol > li').length, 1);
});

test('five grammar subtasks share one heading and retain all exact lesson anchors', () => {
  const available = Array.from({ length: 5 }, (_, index) => ({ ...item('grammar', `${index + 1}. Rule`, `/lessons/grammar#lesson-block-${index + 1}`), group_id: 10 }));
  const $ = render({ value: { ...value, available } });
  assert.equal($('ol > li').length, 1); assert.equal($('ol > li > ul > li').length, 1);
  assert.equal($('ol > li > ul > li > ul > li').length, 5);
  assert.equal($('ol > li > div').text(), 'A1 · First group');
  assert.equal($('ol > li > ul > li > strong').text(), 'Грамматика');
  assert.deepEqual($('ol a').map((_, link) => $(link).attr('href')).get(), available.map(item => item.href));
});

test('practice skills combine while same-named groups with different IDs or levels remain separate', () => {
  const available = ['listening', 'reading', 'writing', 'speaking'].map((skill, index) => ({ ...item(skill, 'Task', `/lessons/practice#lesson-block-${index}`), group_id: 10 }));
  available.push({ ...available[0], group_id: 11 }, { ...available[0], level: 'A2' });
  const $ = render({ value: { ...value, available } });
  assert.equal($('ol > li').length, 3); assert.equal($('ol > li').first().find('a').length, 4);
  assert.deepEqual($('ol > li').first().find('a').map((_, link) => $(link).text()).get(), ['Слушание — Task', 'Чтение — Task', 'Письмо — Task', 'Говорение — Task']);
});
