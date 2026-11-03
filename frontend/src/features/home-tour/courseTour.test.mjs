import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { buildJobs, boundedTourPreflight } from '../../../../tools/tour/generate-tour-voice.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');
const source = JSON.parse(read('../../../../resources/tour/course-tour.json'));
const compile = text => ts.transpileModule(text, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const stepsCode = compile(read('./courseTourSteps.ts'));
const pathCode = compile(read('../course/CoursePath.tsx'));
const moduleExports = relative => {
  const exports = {};
  new Function('exports', compile(read(relative)))(exports);
  return exports;
};

const progress = { completed: false, passed: 0, total: 1, best_score: 20, best_rank: null };
const course = [{ id: 'A1', completed: 0, total: 1, status: 'active', perfect: false,
  groups: [{ id: 10, title: 'Семья', dictionary_id: 20, category_id: 123,
    learning: { active: true, percent: 20, target: 80, previous_debt: 0 },
    skills: { grammar: { slug: 'family-grammar', progress }, listening: { slug: 'family-listening', progress } } }],
  steps: [
    { id: 1, group_id: 10, title: 'Семья', kind: 'category', status: 'active', available: true,
      dictionary_id: 20, category_id: 123, total_words: 10, learned_words: 2, percent: 20 },
    { id: 2, group_id: 10, title: 'Формы', kind: 'grammar', status: 'active', available: true },
  ],
}];

// Render the real course markup with inert hooks: no network, router writes or effects.
function renderPath({ lang = 'lv', data = course, isLoading = false, isError = false } = {}) {
  const invitations = [];
  const fail = () => assert.fail('A tour must not request data, navigate or update course state');
  const exports = {};
  const mocks = {
    react: { ...React, useEffect() {}, useRef: current => ({ current }),
      useState: initial => [typeof initial === 'function' ? initial() : initial, fail] },
    '@tanstack/react-query': { useQuery: () => ({ data: { data }, isLoading, isError, isSuccess: !isLoading && !isError, refetch: fail }) },
    'next/link': { default: ({ children, ...props }) => {
      delete props.prefetch;
      return React.createElement('a', props, children);
    }, __esModule: true },
    'next/dynamic': { default: () => () => null, __esModule: true },
    'next/navigation': { usePathname: () => '/course', useRouter: () => ({ push: fail, replace: fail }), useSearchParams: () => new URLSearchParams() },
    'primereact/dialog': { Dialog: () => null },
    'next-intl': { useLocale: () => 'ru' },
    'next-themes': { useTheme: () => ({ resolvedTheme: 'light' }) },
    '@/lib/client-api': { clientApi: fail },
    '@/lib/learn-lang': {},
    './effects/groupEffects.config': { getGroupEffect: () => null, getGroupEffectVariants: () => null },
    './effects/useGroupEffectVariants': { useGroupEffectVariants: () => [{}, fail] },
    './effects/useEffectViewport': { useEffectViewport: () => false },
    './effects/useEffectsEnabled': { useEffectsEnabled: () => [false, fail] },
    './effects/useEffectComparison': { useEffectComparison: () => [false] },
    './effects/EffectsToggle': { EffectsToggle: () => null },
    './effects/effectPlacement': { getCardPlacement: () => false },
    './groupSkills.config': moduleExports('../course/groupSkills.config.ts'),
    './grammarCustomComponents': { getGrammarCustomComponent: () => null },
    './course-level-progress': moduleExports('../course/course-level-progress.ts'),
    '@/features/lessons/practiceSkills': moduleExports('../lessons/practiceSkills.ts'),
    './practice-awards': moduleExports('../course/practice-awards.ts'),
    '@/features/category-previews/model': { thematicCategoryArt: () => null },
    '@/features/home-tour/CourseTour': { CourseTour: props => {
      invitations.push(props);
      return React.createElement('button', { 'data-course-tour': 'replay' }, 'Тур по курсу');
    } },
  };
  new Function('require', 'exports', pathCode)(name => {
    if (name in mocks) return mocks[name];
    if (name.endsWith('.css')) return new Proxy({}, { get: (_, key) => String(key) });
    if (name.endsWith('.json')) return JSON.parse(read(`../course/${name.slice(2)}`));
    if (name.startsWith('./effects/')) return {};
    return require(name);
  }, exports);
  return { html: renderToStaticMarkup(React.createElement(exports.CoursePath, { learnLanguage: lang })), invitations };
}

// Only the selectors used by the real definition are supported. Unknown syntax
// fails loudly instead of silently accepting targets that a browser would reject.
function matchesPart(element, selector) {
  const exclusions = [...selector.matchAll(/:not\(([^)]+)\)/g)];
  if (exclusions.some(match => matchesPart(element, match[1]))) return false;
  const positive = selector.replace(/:not\(([^)]+)\)/g, '');
  if (positive === ':disabled') return Object.hasOwn(element.attrs, 'disabled');
  const attributes = [...positive.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)];
  assert.equal(positive.replace(/\[([\w-]+)(?:="([^"]*)")?\]/g, ''), '', `Unsupported selector: ${selector}`);
  assert(attributes.length > 0, `Empty selector: ${selector}`);
  return attributes.every(([, name, value]) => Object.hasOwn(element.attrs, name)
    && (value === undefined || element.attrs[name] === value));
}

function matches(element, selector) {
  const parts = selector.trim().split(/\s+/);
  if (!matchesPart(element, parts.pop())) return false;
  let ancestor = element.parent;
  while (parts.length) {
    const part = parts.pop();
    while (ancestor && !matchesPart(ancestor, part)) ancestor = ancestor.parent;
    if (!ancestor) return false;
    ancestor = ancestor.parent;
  }
  return true;
}

function domNode(attrs = {}, children = []) {
  const node = {
    attrs, children, parent: null, documentRoot: false,
    get isConnected() { return node.documentRoot || !!node.parent?.isConnected; },
    getBoundingClientRect: () => ({ width: Object.hasOwn(node.attrs, 'hidden') ? 0 : 240,
      height: 80, left: 20, top: 140, bottom: 220, right: 260 }),
    querySelectorAll: selector => descendants(node).filter(child => matches(child, selector)),
    closest: selector => {
      for (let current = node; current; current = current.parent) if (matches(current, selector)) return current;
      return null;
    },
    contains: child => child === node || descendants(node).includes(child),
    click: () => assert.fail('Target selection must not click controls'),
  };
  for (const child of children) child.parent = node;
  return node;
}
const descendants = node => node.children.flatMap(child => [child, ...descendants(child)]);
const marked = (name, children = [], attrs = {}) => domNode({ 'data-course-tour': name, ...attrs }, children);
const snapshot = node => JSON.stringify({ attrs: node.attrs, children: node.children.map(snapshot) });
function remove(node) {
  node.parent.children.splice(node.parent.children.indexOf(node), 1);
  node.parent = null;
}
function replace(node, replacement) {
  const parent = node.parent;
  parent.children.splice(parent.children.indexOf(node), 1, replacement);
  replacement.parent = parent;
  node.parent = null;
}

function fixture(children = []) {
  const document = domNode({}, children);
  document.documentRoot = true;
  let width = 1440;
  const exports = {};
  vm.runInNewContext(stepsCode, {
    exports, get innerWidth() { return width; }, innerHeight: 900,
    document,
    window: { matchMedia: () => ({ matches: width <= 800 }) },
    require: name => {
      assert(name.endsWith('course-tour.json'), `Unexpected runtime dependency: ${name}`);
      return source;
    },
  });
  return { document, exports, resize: value => { width = value; } };
}

const navigationNodes = () => ['header', 'menu'].map(placement => domNode(
  { 'data-course-continue-placement': placement }, [marked('continue'), marked('target')],
));
const courseNodes = lang => [marked('path', [
  marked('levels', [marked('level', [], { 'aria-pressed': 'true' })]),
  marked('group', [marked('words'), marked('grammar'), ...(lang === 'en' ? [] : [marked('practice')])]),
  marked('replay'),
])];

function markerAttributes(relative) {
  const parsed = ts.createSourceFile(relative, read(relative), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const markers = [];
  const visit = node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attribute = node.attributes.properties.find(item => item.name?.getText(parsed) === 'data-course-tour');
      if (attribute) {
        assert(ts.isStringLiteral(attribute.initializer), 'Tour markers must remain stable strings');
        markers.push([node.tagName.getText(parsed), attribute.initializer.text]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return markers;
}

test('RU/UK copy fits bounded Fenrir generation without generating audio', () => {
  assert.equal(new Set(source.lines.map(line => line.key)).size, source.lines.length);
  for (const line of source.lines) for (const lang of ['ru', 'uk']) {
    assert(line[lang].trim().length > 0 && line[lang].length <= 160, `${line.key}-${lang}: ${line[lang].length}`);
  }
  const jobs = buildJobs(source.lines, 'Fenrir');
  assert.equal(jobs.length, source.lines.length * 2);
  assert(boundedTourPreflight(jobs, 1).estimated_batch_usd < 1);
});

test('LV/EN rendered markers agree with the AST and target stubs; tour leaves progress untouched', () => {
  const before = JSON.stringify(course);
  const declared = new Set(markerAttributes('../course/CoursePath.tsx').map(([, marker]) => marker));
  assert.deepEqual([...declared].sort(), ['path', 'practice', 'levels', 'level', 'group', 'words', 'grammar'].sort());
  for (const lang of ['lv', 'en']) {
    const { html, invitations } = renderPath({ lang });
    assert.equal(invitations.length, 1);
    assert.equal(invitations[0].isAuthenticated, true);
    const renderedMarkers = [...html.matchAll(/\bdata-course-tour="([^"]+)"/g)].map(match => match[1]);
    const f = fixture([...courseNodes(lang), ...navigationNodes()]);
    const stubMarkers = f.document.querySelectorAll('[data-course-tour="path"]')[0]
      .querySelectorAll('[data-course-tour]').map(node => node.attrs['data-course-tour']);
    for (const marker of ['path', ...stubMarkers]) assert(renderedMarkers.includes(marker), `${lang}: rendered ${marker}`);
    assert.equal(renderedMarkers.filter(marker => marker === 'level').length, 4);
    const definition = f.exports.createCourseTourDefinition(lang);
    assert.equal(definition.steps.length, lang === 'lv' ? 12 : 11);
    const beforeDom = snapshot(f.document);
    for (const step of definition.steps) {
      assert(step.targets().length > 0, `${lang}:${step.key} must resolve an existing element`);
      for (const ui of ['ru', 'uk']) assert(definition.text(step.key, ui));
    }
    assert.equal(snapshot(f.document), beforeDom);
    definition.cleanup();
    assert.equal(snapshot(f.document), beforeDom);
    assert.equal(definition.cookie, 'lbp_course_tour');
    assert.equal(f.document.querySelectorAll(definition.replayTarget).length, 1);
    assert.equal(renderedMarkers.filter(marker => marker === 'practice').length, lang === 'en' ? 0 : 1);
    assert.equal(definition.steps.some(step => step.key === 'practice'), lang === 'lv');
  }
  assert.equal(JSON.stringify(course), before);
});

test('loading, errors and an empty selected level never mount the auto invitation', () => {
  for (const options of [{ isLoading: true }, { isError: true }, { data: [] }, { data: [{ ...course[0], groups: [], steps: [] }] }]) {
    assert.equal(renderPath(options).invitations.length, 0);
  }
});

test('the CourseTour wrapper uses the course replay event, cookie definition and Fenrir release', () => {
  const { exports: definitions } = fixture();
  const exports = {};
  const observed = [];
  new Function('require', 'exports', compile(read('./CourseTour.tsx')))(name => {
    if (name === 'react') return { useState: initial => [initial()] };
    if (name === './courseTourSteps') return definitions;
    if (name === './PageTour') return { PageTour: props => { observed.push(props); return null; } };
    return require(name);
  }, exports);
  for (const learnLanguage of ['lv', 'en']) {
    renderToStaticMarkup(React.createElement(exports.CourseTour, { isAuthenticated: true, learnLanguage }));
    const props = observed.at(-1);
    assert.equal(props.entryId, 'course');
    assert.equal(props.eventName, 'lbp.course-tour.start');
    assert.equal(props.release, `${source.release}-fenrir`);
    assert.equal(props.definition.cookie, 'lbp_course_tour');
    assert.equal(props.isAuthenticated, true);
    assert(props.copy.ru.title && props.copy.uk.title);
  }
});

test('goal and Continue follow the responsive placement, including resizing during a tour', () => {
  const f = fixture(navigationNodes());
  const definition = f.exports.createCourseTourDefinition('lv');
  for (const width of [1440, 390, 800, 801, 320, 1440]) {
    f.resize(width);
    for (const key of ['target', 'continue']) {
      const step = definition.steps.find(item => item.key === key);
      assert.equal(step.menu, width <= 800);
      const node = f.document.querySelectorAll(`[data-course-continue-placement="${width <= 800 ? 'menu' : 'header'}"] [data-course-tour="${key}"]`)[0];
      assert.deepEqual([...step.targets()], [node]);
    }
  }
});

test('missing skills are skipped; disabled placeholders do not hide a later available skill', () => {
  const real = marked('grammar');
  const f = fixture([marked('path', [
    marked('group', [marked('grammar', [], { disabled: '' }), marked('practice', [], { 'aria-disabled': 'true' })]),
    marked('group', [real]),
  ])]);
  const definition = f.exports.createCourseTourDefinition('lv');
  const targets = key => [...definition.steps.find(step => step.key === key).targets()];
  assert.deepEqual(targets('grammar'), [real]);
  assert.equal(targets('words').length, 0);
  assert.equal(targets('practice').length, 0);
  remove(real);
  assert.equal(targets('grammar').length, 0);
});

test('cached group is replaced after a level rerender and cleanup only clears the cache', () => {
  const f = fixture([marked('path', [marked('group')])]);
  const definition = f.exports.createCourseTourDefinition('lv');
  const groups = definition.steps.find(step => step.key === 'groups');
  const old = groups.targets()[0];
  const replacement = marked('group');
  replace(old, replacement);
  assert.notEqual(groups.targets()[0], old);
  const beforeDom = snapshot(f.document);
  definition.cleanup();
  assert.deepEqual([...groups.targets()], [replacement]);
  assert.equal(snapshot(f.document), beforeDom);
});

test('the real Continue component exposes both desktop and menu goal markers', () => {
  assert.deepEqual(markerAttributes('../course/CourseContinue.tsx'), [['button', 'continue'], ['button', 'target'], ['select', 'target']]);
});
