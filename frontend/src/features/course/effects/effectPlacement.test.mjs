import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('./effectPlacement.ts', import.meta.url), 'utf8');
const loaded = { exports: {} };
new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(loaded.exports);
const { FULL_HD_EFFECT_WIDTH, FULL_HD_EFFECT_QUERY, getCardPlacement } = loaded.exports;

test('all variants default to the card below Full HD and to the background at 1920px and above', () => {
  assert.equal(FULL_HD_EFFECT_WIDTH, 1920);
  assert.equal(FULL_HD_EFFECT_QUERY, '(min-width: 1920px)');
  for (const width of [320, 390, 1024, 1366, 1536, 1919, 1920, 1921, 2560, 3840]) {
    assert.equal(getCardPlacement(width >= FULL_HD_EFFECT_WIDTH), width < 1920, `${width}px`);
  }
});

test('explicit full-screen focus overrides the small viewport and any manual card choice', () => {
  for (const fullHd of [false, true]) for (const manual of [undefined, false, true]) {
    assert.equal(getCardPlacement(fullHd, manual, true), false);
    assert.equal(getCardPlacement(fullHd, manual, false), manual ?? !fullHd);
  }
});

test('manual format toggle remains available in either default mode', () => {
  for (const fullHd of [false, true]) {
    const initial = getCardPlacement(fullHd);
    const selected = !initial;
    assert.equal(getCardPlacement(fullHd, selected), selected);
    assert.equal(getCardPlacement(fullHd, selected, true), false);
    assert.equal(getCardPlacement(fullHd, selected), selected, 'leaving focus returns to the chosen normal mode');
  }
});

test('course applies the same placement to card rendering, body styling and focus, including video-only variants', () => {
  const page = readFileSync(new URL('../CoursePath.tsx', import.meta.url), 'utf8');
  const overlay = readFileSync(new URL('./ThemedGroupOverlay.tsx', import.meta.url), 'utf8');
  const fullscreen = readFileSync(new URL('./FullscreenEffect.tsx', import.meta.url), 'utf8');
  assert.match(page, /dimContent = .*getCardPlacement\(fullHdEffects,/);
  assert.match(page, /forceCard = getCardPlacement\(fullHdEffects, cardEffects\[group.id\], isThemed && effectFocus, effect\?\.cardOnly\)/);
  assert.match(page, /hasCardEffect = isThemed && \(forceCard \|\| \(effectComparison && !effectFocus\)\)/);
  assert.match(page, /data-effect-body=\{isThemed && !effect\?\.cardOnly && \(!forceCard \|\| effectComparison\)/);
  assert.match(overlay, /forceCard \? <CardEffect/);
  assert.match(overlay, /: <FullscreenEffect/);
  assert.match(fullscreen, /return <BodySurfaceEffect/);
  assert.doesNotMatch(page, /<BodyGridEffect|<FluidEffect|<BodyLiquidGlassEffect|<LiquidDropsEffect|<PotteryEffect/);
});

test('introduction stays in its card at every viewport, even with focus or manual background requested', () => {
  for (const fullHd of [false, true]) for (const manual of [undefined, false, true]) for (const focused of [false, true]) {
    assert.equal(getCardPlacement(fullHd, manual, focused, true), true);
  }
  const config = readFileSync(new URL('./groupEffects.config.ts', import.meta.url), 'utf8');
  assert.match(config, /const INTRO_EFFECT[\s\S]*?kind: 'compass',\s*cardOnly: true/);
  const page = readFileSync(new URL('../CoursePath.tsx', import.meta.url), 'utf8');
  assert.match(page, /!!themedEffect && !themedEffect.cardOnly/);
  assert.match(page, /isThemed && !effect\?\.cardOnly && \(\s*<EffectVariantSwitch/);
  const surface = readFileSync(new URL('./EffectSurface.tsx', import.meta.url), 'utf8');
  assert.match(surface, /data-intro-egg="" style=\{\{ position: 'absolute', right: 12, top: '50%', transform: 'translateY\(-50%\)'/);
});

test('viewport observation listens only for the Full HD breakpoint and cleans up on unmount', () => {
  const hook = readFileSync(new URL('./useEffectViewport.ts', import.meta.url), 'utf8');
  assert.match(hook, /matchMedia\(FULL_HD_EFFECT_QUERY\)/);
  assert.match(hook, /addEventListener\('change', listener\)/);
  assert.match(hook, /removeEventListener\('change', listener\)/);
  assert.match(hook, /getServerSnapshot = \(\) => false/);
});
