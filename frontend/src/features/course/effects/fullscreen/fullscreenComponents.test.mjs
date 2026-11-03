import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('./FullscreenSurface.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('FullscreenSurface.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const modules = [];
const loaded = { exports: {} };
const layout = { exports: {} };
new Function('exports', ts.transpileModule(readFileSync(new URL('./layout.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(layout.exports);
const dynamic = loader => {
  const name = loader.toString().match(/m\.(\w+Fullscreen)/)?.[1];
  assert.ok(name, loader.toString());
  const component = props => React.createElement('span', { 'data-profile': name, 'data-width': props.width, 'data-height': props.height });
  component.profileName = name;
  return component;
};
new Function('require', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)(name => name === 'next/dynamic' ? { __esModule: true, default: dynamic }
  : name === './layout' ? layout.exports : name === './useFullscreenPointer' ? { useFullscreenPointer: () => ({ current: {} }) } : require(name), loaded.exports);
const { FULLSCREEN_COMPONENTS, FullscreenSurface } = loaded.exports;
const config = ts.createSourceFile('config.ts', readFileSync(new URL('../groupEffects.config.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
const union = config.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === 'GroupEffectKind');
const kinds = union.type.types.map(node => node.literal.text);
const visit = node => {
  if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) modules.push(node.arguments[0].text);
  ts.forEachChild(node, visit);
};
visit(parsed);

test('each effect kind has its own lazy fullscreen component', () => {
  assert.deepEqual(Object.keys(FULLSCREEN_COMPONENTS).sort(), [...kinds].sort());
  assert.equal(new Set(Object.values(FULLSCREEN_COMPONENTS)).size, kinds.length);
  assert.equal(modules.length, kinds.length);
  for (const path of modules) {
    const component = readFileSync(new URL(path + '.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(component, /EffectSurface|EffectCanvas|<iframe|effects-preview\?/);
    assert.match(component, /export function \w+Fullscreen/);
  }
});

test('desktop and portrait select the correct independent fullscreen profile', () => {
  for (const [width, height] of [[1365,900], [390,844]]) for (const kind of kinds) {
    const html = renderToStaticMarkup(React.createElement(FullscreenSurface, { effect: { kind }, width, height, pointerRef: { current: {} }, tuning: null }));
    assert.ok(html.includes(`data-fullscreen-component="${kind}"`));
    assert.ok(html.includes(`data-profile="${FULLSCREEN_COMPONENTS[kind].profileName}"`));
    assert.ok(html.includes(`data-width="${width}"`));
    assert.ok(html.includes(`data-height="${height}"`));
  }
});

test('fullscreen and card rendering do not import each other', () => {
  const body = readFileSync(new URL('../BodySurfaceEffect.tsx', import.meta.url), 'utf8');
  assert.match(body, /<FullscreenSurface/);
  assert.doesNotMatch(body, /EffectSurface|EffectCanvas/);
  const card = readFileSync(new URL('../CardEffect.tsx', import.meta.url), 'utf8');
  assert.match(card, /<EffectSurface/);
  assert.doesNotMatch(card, /fullscreen\//);
  const fullscreen = readFileSync(new URL('../FullscreenEffect.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(fullscreen, /!body && effect.kind === 'scene'/);
});

test('visible course content leaves the centre clear and mounts two side profiles', () => {
  for (const kind of kinds) {
    if (kind === 'lantern-water' || kind === 'song-fire' || kind === 'video' || kind === 'image-reveal' || kind === 'mine' || kind === 'storm' || kind === 'sun-water') continue;
    const html = renderToStaticMarkup(React.createElement(FullscreenSurface, { effect: { kind }, width: 1920, height: 1080, pointerRef: { current: {} }, tuning: null, contentVisible: true }));
    assert.ok(html.includes('data-fullscreen-region="left"'));
    assert.ok(html.includes('data-fullscreen-region="right"'));
    assert.equal((html.match(/data-profile=/g) ?? []).length, 2);
    assert.equal((html.match(/data-width="316"/g) ?? []).length, 2);
  }
});

test('bonfire, reveal image, mine and both weather variants use one continuous composition behind visible content', () => {
  for (const kind of ['song-fire', 'image-reveal', 'mine', 'storm', 'sun-water']) for (const width of [1920, 2560, 3840]) {
    const html = renderToStaticMarkup(React.createElement(FullscreenSurface, { effect: { kind }, width, height: 1080, pointerRef: { current: {} }, tuning: null, contentVisible: true }));
    assert.ok(html.includes('data-fullscreen-region="full"'));
    assert.doesNotMatch(html, /data-fullscreen-region="(?:left|right)"/);
    assert.equal((html.match(/data-profile=/g) ?? []).length, 1);
    assert.ok(html.includes(`data-width="${width}"`));
  }
});

test('continuous worlds use one viewport behind course content rather than independent copies', () => {
  for (const sceneId of ['highway', 'highway-panorama', 'week-gardens', 'week-book', 'folding-home', 'fireflies']) for (const contentVisible of [true, false]) {
    const html = renderToStaticMarkup(React.createElement(FullscreenSurface, {
      effect: { kind: 'scene', sceneId }, width: 1920, height: 1080, pointerRef: { current: {} }, tuning: null, contentVisible,
    }));
    assert.ok(html.includes('data-fullscreen-region="full"'));
    assert.doesNotMatch(html, /data-fullscreen-region="(?:left|right)"/);
    assert.equal((html.match(/data-profile=/g) ?? []).length, 1);
    assert.ok(html.includes('data-width="1920"'));
  }
});

test('bonfire remains a single uninterrupted scene in focus and on narrow screens', () => {
  for (const [width, contentVisible] of [[1920, false], [2560, false], [390, true], [1365, true]]) {
    const html = renderToStaticMarkup(React.createElement(FullscreenSurface, { effect: { kind: 'song-fire' }, width, height: 900, pointerRef: { current: {} }, tuning: null, contentVisible }));
    assert.ok(html.includes('data-fullscreen-region="full"'));
    assert.doesNotMatch(html, /data-fullscreen-region="(?:left|right)"/);
    assert.equal((html.match(/data-profile=/g) ?? []).length, 1);
    assert.ok(html.includes(`data-width="${width}"`));
  }
});

test('lantern pond remains one continuous scene with or without visible course content', () => {
  for (const [width, height] of [[1920, 1080], [2560, 1440], [390, 844]]) {
    for (const contentVisible of [true, false]) {
      const html = renderToStaticMarkup(React.createElement(FullscreenSurface, { effect: { kind: 'lantern-water' }, width, height, pointerRef: { current: {} }, tuning: null, contentVisible }));
      assert.ok(html.includes('data-fullscreen-region="full"'));
      assert.doesNotMatch(html, /data-fullscreen-region="(?:left|right)"/);
      assert.equal((html.match(/data-profile=/g) ?? []).length, 1);
      assert.ok(html.includes(`data-width="${width}"`));
    }
  }
});

test('both food videos use one continuous fullscreen region instead of duplicated side players', () => {
  for (const videoSrc of ['/course/effects/bon-appetit-loop.mp4', '/course/effects/bon-appetit-vegetarian-loop.mp4']) {
    for (const [width, height] of [[1920, 1080], [2560, 1440], [390, 844]]) for (const contentVisible of [true, false]) {
      const html = renderToStaticMarkup(React.createElement(FullscreenSurface, { effect: { kind: 'video', videoSrc }, width, height, pointerRef: { current: {} }, tuning: null, contentVisible }));
      assert.ok(html.includes('data-fullscreen-region="full"'));
      assert.doesNotMatch(html, /data-fullscreen-region="(?:left|right)"/);
      assert.equal((html.match(/data-profile=/g) ?? []).length, 1);
      assert.ok(html.includes(`data-width="${width}"`));
    }
  }
});

test('fullscreen video applies and cleans up the existing translucent content treatment', () => {
  const code = readFileSync(new URL('./VideoFullscreen.tsx', import.meta.url), 'utf8');
  const loaded = { exports: {} }, classes = new Set(), effects = [];
  new Function('require', 'exports', ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(name => {
    if (name === 'react') return { useEffect: callback => effects.push(callback) };
    if (name === '../VideoLoopEffect') return { VideoLoopEffect: props => React.createElement('video', props) };
    return require(name);
  }, loaded.exports);
  const previous = globalThis.document;
  try {
    globalThis.document = { body: { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } } };
    const html = renderToStaticMarkup(React.createElement(loaded.exports.VideoFullscreen, { effect: { kind: 'video', videoSrc: '/fixture.mp4' } }));
    assert.equal((html.match(/<video/g) ?? []).length, 1);
    const cleanup = effects.pop()();
    assert.ok(classes.has('scene-body-active'));
    cleanup();
    assert.equal(classes.size, 0);
    renderToStaticMarkup(React.createElement(loaded.exports.VideoFullscreen, { effect: { kind: 'video' } }));
    assert.equal(effects.pop()(), undefined);
    assert.equal(classes.size, 0);
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
  const css = readFileSync(new URL('../../course-path.module.css', import.meta.url), 'utf8');
  assert.match(css, /body\.scene-body-active\) \.root \{ background: rgb\(246 248 250 \/ 78%\)/);
  assert.match(css, /html\.dark\) :global\(body\.scene-body-active\) \.root \{ background: rgb\(24 28 31 \/ 80%\)/);
});

test('perspective effects own their fullscreen camera and canvas options', () => {
  for (const name of ['Mine', 'LatviaCube', 'LanternWater']) {
    const component = readFileSync(new URL(`./${name}Fullscreen.tsx`, import.meta.url), 'utf8');
    assert.match(component, /<FullscreenCanvas perspective/);
    assert.match(component, /camera=\{/);
  }
  const canvas = readFileSync(new URL('./FullscreenCanvas.tsx', import.meta.url), 'utf8');
  assert.match(canvas, /orthographic=\{!perspective\}/);
  assert.match(canvas, /camera=\{camera \?\?/);
});

test('native fullscreen components forward viewport, pointer and tuning without mutating shared settings', () => {
  for (const kind of kinds) {
    const profile = FULLSCREEN_COMPONENTS[kind].profileName;
    const calls = [];
    const fakeEngine = name => function EngineStub(props) { calls.push({ name, props }); return React.createElement(React.Fragment, null, props.children); };
    const stubs = new Proxy({}, { get: (_, name) => {
      if (name === 'useTheme') return () => ({ resolvedTheme: 'dark' });
      if (name === 'getScene') return () => ({ id: 'fixture', defaultParams: {} });
      if (name === 'mineCameraDistance') return height => height / 2;
      if (name === 'MINE_CAMERA_FOV') return 45;
      if (String(name).startsWith('create')) return () => ({ positionX: .5, cubeScale: 1 });
      return fakeEngine(name);
    } });
    const compiledModule = { exports: {} };
    const component = readFileSync(new URL(`./${profile}.tsx`, import.meta.url), 'utf8');
    const js = ts.transpileModule(component, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    new Function('require', 'exports', js)(name => name === 'react' || name === 'react/jsx-runtime' ? require(name) : stubs, compiledModule.exports);
    for (const [width, height, region] of [[1920,1080,'full'], [1365,900,'full'], [390,844,'full'], [316,900,'left'], [316,900,'right']]) {
      calls.length = 0;
      const params = { positionX: .5, cubeScale: 1, size: 1.4, token: 'shared' };
      const before = structuredClone(params), pointerRef = { current: {} };
      renderToStaticMarkup(React.createElement(compiledModule.exports[profile], { effect: { kind, videoSrc: '/fixture.mp4', imageSrc: '/fixture.webp', sceneId: 'fixture', accent: '#00ff00' }, width, height, region, pointerRef, tuning: { kind, params } }));
      assert(calls.length > 0, kind);
      for (const call of calls) {
        if ('width' in call.props) assert.equal(call.props.width, width, kind);
        if ('height' in call.props) assert.equal(call.props.height, height, kind);
        if ('pointerRef' in call.props) assert.equal(call.props.pointerRef, pointerRef, kind);
        if (kind === 'scene' && call.name === 'SceneEffect') assert.equal(call.props.region, region);
        if (kind === 'storm' && call.name === 'StormEffect') assert.equal(call.props.umbrellaScale, width >= 1024 ? 1.25 : 1);
        if ('params' in call.props && !['latvia-cube', 'lantern-water'].includes(kind)) assert.equal(call.props.params, params, kind);
        if (kind === 'lantern-water' && call.name === 'LanternWaterEffect') {
          assert.equal(call.props.params.size, params.size * Math.min(1, width / height));
          assert.deepEqual(call.props.view, { fov: 45, distance: 26, heightRatio: .36, targetRatio: .25 });
        }
      }
      assert.deepEqual(params, before, kind);
      const camera = calls.find(call => call.name === 'FullscreenCanvas')?.props.camera;
      if (camera) assert(camera.position.every(Number.isFinite), kind);
    }
  }
});
