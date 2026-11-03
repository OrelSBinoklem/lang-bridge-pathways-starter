import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { buildJobs, boundedTourPreflight } from '../../../../tools/tour/generate-tour-voice.mjs';

const root = new URL('../../../../', import.meta.url);
const tour = JSON.parse(await readFile(new URL('resources/tour/exams-tour.json', root), 'utf8'));
const require = createRequire(new URL('../../../package.json', import.meta.url));
const ts = require('typescript');
const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const [stepsCode, componentCode, pageCode, pageTourCode] = await Promise.all([
  compile('./examsTourSteps.ts'), compile('./ExamsTour.tsx'), compile('../exams/ExamPage.tsx'), compile('./PageTour.tsx'),
]);
const keys = ['intro', 'levels', 'skills', 'timer', 'autosave', 'listening', 'speaking', 'writing', 'finish', 'results', 'history', 'credits'];

function load(code, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(code, { exports, ...globals, require: name => {
    assert(Object.hasOwn(imports, name), `unexpected dependency: ${name}`);
    return imports[name];
  } });
  return exports;
}

// Keep JSX as a tree: never execute the real runner, avatar, attempt or audio components.
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'Fragment' };
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !tree.props) return [];
  return [tree, ...nodes(tree.props.children)];
}
const marker = (tree, value) => nodes(tree).find(node => node.props['data-exam-tour'] === value);
const tourNode = tree => nodes(tree).find(node => node.type === 'PageTour');

function definitionFixture() {
  const selectors = [];
  const visible = { getBoundingClientRect: () => ({ width: 240, height: 60 }), click: () => assert.fail('tour clicked a control') };
  const hidden = { getBoundingClientRect: () => ({ width: 0, height: 0 }) };
  const stepsModule = load(stepsCode, { '../../../../resources/tour/exams-tour.json': tour }, {
    document: { querySelectorAll: selector => { selectors.push(selector); return [hidden, visible, visible]; } },
  });
  return { stepsModule, definition: stepsModule.createExamsTourDefinition(), selectors, visible };
}

function componentFixture(lang = 'ru') {
  const { stepsModule } = definitionFixture();
  const state = [];
  let cursor = 0;
  const component = load(componentCode, {
    react: { useState: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], value => { state[index] = value; }];
    } },
    'react/jsx-runtime': jsxRuntime,
    'next-intl': { useLocale: () => lang },
    './PageTour': { PageTour: 'PageTour' },
    './examsTourSteps': stepsModule,
  });
  return { render: () => { cursor = 0; return component.ExamsTour({ isAuthenticated: true }); } };
}

test('12 steps and closed copy are short in RU/UK and ready for the parent Fenrir batch', () => {
  const { definition, stepsModule } = definitionFixture();
  assert.deepEqual(Array.from(definition.steps, step => step.key), keys);
  assert.deepEqual(tour.lines.map(line => line.key), [...keys, 'closed']);
  assert.equal(new Set(tour.lines.map(line => line.key)).size, 13);
  assert.equal(stepsModule.EXAMS_TOUR_RELEASE, `${tour.release}-fenrir`);
  assert.equal(definition.cookie, 'lbp_exams_tour');
  assert.equal(definition.replayTarget, '[data-exam-tour="replay"]');
  const jobs = buildJobs(tour.lines, 'Fenrir');
  assert.equal(jobs.length, 26);
  assert(boundedTourPreflight(jobs, 1).estimated_batch_usd < 1);
  for (const line of tour.lines) for (const lang of ['ru', 'uk']) {
    assert(line[lang].length > 0 && line[lang].length <= 160, `${line.key}-${lang}`);
    assert.equal(definition.text(line.key, lang), line[lang]);
  }
});

test('all targets read only visible catalog/demo markers, with no attempt or question dependencies', () => {
  const { definition, selectors, visible } = definitionFixture();
  assert.equal(definition.beforeStep, undefined);
  assert.equal(definition.cleanup, undefined);
  for (const step of definition.steps) {
    if (step.targets) assert.deepEqual(Array.from(step.targets()), [visible]);
    assert(!step.menu);
  }
  assert.equal(selectors.length, 11);
  for (const selector of selectors) assert.match(selector, /^\[data-exam-tour="(?:levels|history|demo-[a-z]+)"\]$/);
});

test('preview exists only while PageTour is active and resets on replay, close or fresh mount', () => {
  for (const lang of ['ru', 'uk']) {
    const fixture = componentFixture(lang);
    const initial = fixture.render();
    assert(!marker(initial, 'demo'));
    const guide = tourNode(initial);
    assert.equal(guide.props.autoInvite, false);
    assert.equal(guide.props.entryId, 'exams');
    assert.equal(guide.props.eventName, 'lbp.exams-tour.start');
    assert.equal(guide.props.isAuthenticated, true);
    for (let replay = 0; replay < 2; replay++) {
      guide.props.onActiveChange(true);
      assert(marker(fixture.render(), 'demo'));
      guide.props.onActiveChange(false);
      assert(!marker(fixture.render(), 'demo'));
    }
    assert(!marker(componentFixture(lang).render(), 'demo'));
  }
});

test('shared PageTour emits the matching replay marker and active callback for invitation, run and teardown', () => {
  for (const phase of ['off', 'invite', 'running', 'closing']) {
    const props = tourNode(componentFixture().render()).props;
    const effects = [], active = [];
    let cursor = 0;
    props.onActiveChange = value => active.push(value);
    const { PageTour } = load(pageTourCode, {
      'react/jsx-runtime': jsxRuntime,
      react: { useState: initial => {
        const index = cursor++;
        const value = typeof initial === 'function' ? initial() : initial;
        return [index === 0 ? { ...value, phase } : value, () => {}];
      }, useRef: value => ({ current: value }), useEffect: (effect, dependencies) => effects.push({ effect, dependencies }) },
      'react-dom': { createPortal: node => node },
      'next-intl': { useLocale: () => 'ru' },
      '@/features/tutor-characters/characterRuntime': { getCharacterTour: () => false, setCharacterTour: () => {} },
      './tourRunner': { HomeTourRunner: class {}, TOUR_LAYER: 100000, tourInviteDue: () => false },
      './home-tour.module.css': { __esModule: true, default: {} },
    }, { document: { body: {} } });
    const tree = PageTour(props);
    assert(marker(tree, 'replay'), `missing shared replay marker in ${phase}`);
    const lifecycle = effects.find(item => item.dependencies.includes(props.onActiveChange));
    assert(lifecycle, 'PageTour must notify preview lifecycle');
    const cleanup = lifecycle.effect();
    assert.deepEqual(active, [phase !== 'off']);
    cleanup();
    assert.equal(active.at(-1), false);
  }
});

test('demo controls are disabled, time and results are static, and no audio, mic or answer input is mounted', () => {
  for (const lang of ['ru', 'uk']) {
    const fixture = componentFixture(lang);
    tourNode(fixture.render()).props.onActiveChange(true);
    const tree = fixture.render();
    const preview = marker(tree, 'demo');
    const elements = nodes(preview);
    assert.match(preview.props['aria-label'], /Демо/);
    assert.equal(elements.find(node => node.type === 'time').props.children, '12:00');
    assert(!elements.some(node => ['audio', 'video', 'input', 'textarea', 'select', 'form', 'HumanTutorAvatar', 'ExamRunner'].includes(node.type)));
    const buttons = elements.filter(node => node.type === 'button');
    assert.equal(buttons.length, 3);
    for (const button of buttons) assert.equal(button.props.disabled, true);
    for (const node of elements) {
      for (const [name, value] of Object.entries(node.props)) {
        assert(!/^on[A-Z]/.test(name), `interactive demo handler: ${name}`);
        assert.notEqual(typeof value, 'function');
      }
      assert.notEqual(node.props.role, 'timer');
      assert.equal(node.props['aria-live'], undefined);
      assert.equal(node.props.src, undefined);
    }
    for (const step of definitionFixture().definition.steps) {
      const match = step.targets && !['levels', 'history'].includes(step.key);
      if (match) assert(marker(tree, `demo-${step.key}`), `missing preview target ${step.key}`);
    }
    const demoText = JSON.stringify(preview);
    assert.match(demoText, /70%/);
    assert.match(demoText, /60%/);
    assert.match(demoText, lang === 'uk' ? /вигадані дані/ : /вымышленные данные/);
    assert.match(demoText, lang === 'uk' ? /Два приклади написів/ : /Два примера надписей/);
    assert.equal(JSON.stringify(marker(fixture.render(), 'demo')), demoText);
  }
});

test('direct tour link survives Strict Mode setup/cleanup before its scheduled start', () => {
  const effects = [], timers = new Map();
  let timerId = 0, invited = 0;
  const location = { href: 'http://localhost/exams?learn_lang=en&tour=1' };
  const { PageTour } = load(pageTourCode, {
    'react/jsx-runtime': jsxRuntime,
    react: { useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: value => ({ current: value }), useEffect: (effect, dependencies) => effects.push({ effect, dependencies }) },
    'react-dom': { createPortal: node => node }, 'next-intl': { useLocale: () => 'ru' },
    '@/features/tutor-characters/characterRuntime': { getCharacterTour: () => false, setCharacterTour: () => {} },
    './tourRunner': { HomeTourRunner: class { dispose() {} invite() { invited++; return Promise.resolve(); } }, TOUR_LAYER: 100000, tourInviteDue: () => false },
    './home-tour.module.css': { __esModule: true, default: {} },
  }, { document: { body: {} }, URL, location,
    history: { state: null, replaceState: (_state, _title, url) => { location.href = url.toString(); } },
    window: { addEventListener() {}, removeEventListener() {}, setTimeout: callback => { timers.set(++timerId, callback); return timerId; } },
    clearTimeout: id => timers.delete(id),
  });
  PageTour(tourNode(componentFixture().render()).props);
  const mount = effects.find(item => item.dependencies.includes('lbp.exams-tour.start')).effect;
  mount()();
  assert(location.href.includes('tour=1'));
  assert.equal(timers.size, 0);
  const cleanup = mount();
  assert.equal(timers.size, 1);
  timers.values().next().value();
  assert.equal(invited, 1);
  assert(!location.href.includes('tour=1'));
  assert(location.href.includes('learn_lang=en'));
  cleanup();
});

function catalogPage(search = '', { starting = false, confirm = null, loaded = true } = {}) {
  const queries = [];
  const state = ['', starting, 1, confirm];
  let cursor = 0;
  const forbidden = () => assert.fail('tour/catalog triggered a real attempt, mutation, avatar or audio');
  const imports = {
    'react/jsx-runtime': jsxRuntime,
    react: { useState: () => [state[cursor++], forbidden], useEffect: () => {}, useRef: value => ({ current: value }) },
    '@tanstack/react-query': { useQuery: options => {
      queries.push(options);
      return { data: options.queryKey[0] === 'exams' && loaded ? { data: [] } : undefined };
    }, useQueryClient: forbidden },
    'next-intl': { useLocale: () => 'ru' },
    'next/link': { __esModule: true, default: 'Link' },
    'next/navigation': { useRouter: () => ({ push: forbidden }), useSearchParams: () => new URLSearchParams(search) },
    '@/lib/client-api': { clientApi: forbidden },
    '@/features/admin/useUserPreview': { useAdminAppearance: () => false },
    '@/lib/credit-refresh': { notifyCreditsChanged: forbidden },
    '@/features/tutor-avatar/HumanTutorAvatar': { HumanTutorAvatar: forbidden },
    '@/features/tutor-avatar/AvatarAudioProbe': { AvatarAudioProbe: forbidden },
    '@/features/home-tour/ExamsTour': { ExamsTour: 'ExamsTour' },
    './ExamVisuals': { __esModule: true, default: forbidden, ExamPhoto: forbidden },
    './ExamCertificate': { ExamCertificate: forbidden },
    './ExamChoiceOptions': { ExamChoiceOptions: forbidden },
    './ExamTaskQuestions': { ExamTaskQuestions: forbidden },
    './readingPassages': { readingPassages: forbidden },
    './types': { skillNames: {} },
    './exams.module.css': { __esModule: true, default: {} },
  };
  const { ExamPage } = load(pageCode, imports);
  return { tree: ExamPage(), queries };
}

test('attempts and certificate previews return before ExamsTour can mount, even with tour=1', () => {
  for (const search of ['attempt=42', 'attempt=42&tour=1', 'learn_lang=en&attempt=42&tour=1', 'preview=all&tour=1', 'preview=7&tour=1']) {
    const { tree, queries } = catalogPage(search);
    assert(['ExamAttemptView', 'CertificateGallery', 'CertificatePreview'].includes(tree.type.name), search);
    assert(!nodes(tree).some(node => node.type === 'ExamsTour'), search);
    assert(!marker(tree, 'demo'));
    assert(queries.every(query => ['exams', 'exam-history'].includes(query.queryKey[0])));
    assert.equal(queries.find(query => query.queryKey[0] === 'exam-history').enabled, !search.includes('attempt='));
  }
});

test('catalog mounts replay only after loading, outside start confirmation and submission, in both languages', () => {
  for (const search of ['', 'learn_lang=en', 'level=B2&tour=1']) {
    const { tree } = catalogPage(search);
    const mounted = nodes(tree).filter(node => node.type === 'ExamsTour');
    assert.equal(mounted.length, 1);
    assert.equal(mounted[0].props.isAuthenticated, true);
    assert.equal(mounted[0].key, search.includes('learn_lang=en') ? 'en' : 'lv');
    for (const name of ['catalog', 'levels', 'history']) assert(marker(tree, name));
    for (const state of [{ starting: true }, { confirm: 5 }, { loaded: false }]) {
      assert(!nodes(catalogPage(search, state).tree).some(node => node.type === 'ExamsTour'));
    }
  }
});
