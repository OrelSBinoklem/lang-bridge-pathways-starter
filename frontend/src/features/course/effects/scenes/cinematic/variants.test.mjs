import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const dataUrl = js => 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
const catalogUrl = dataUrl(compile(await readFile(new URL('./catalog.ts', import.meta.url), 'utf8')));
const source = compile(await readFile(new URL('../../groupEffects.config.ts', import.meta.url), 'utf8'))
  .replace(/(['"])\.\/scenes\/cinematic\/catalog\1/, JSON.stringify(catalogUrl));
const { getGroupEffect, getGroupEffectVariants, getHiddenGroupEffectVariants } = await import(dataUrl(source));
const { isCinematicScene, CINEMATIC_ARCHIVES } = await import(catalogUrl);

test('holidays add the tree and PROM board while preserving cube/fireworks and the default', () => {
  const variants = getGroupEffectVariants(1783);
  assert.deepEqual(variants.map(v => v.id), ['voxel-led-cube', 'fireworks', 'prom-board']);
  assert.equal(getGroupEffect({ categoryId: 1783, title: null }), variants[0].effect);
  const tree = getGroupEffect({ categoryId: 1783, title: null, variantId: 'prom-board' });
  assert.equal(tree, variants[2].effect);
  assert.equal(tree.sceneId, 'prom-board');
  assert.deepEqual(tree.bodyEffect, { scene: 'prom-board' });
  assert.equal(tree.sceneParams.preset, 1, 'tree is enabled in the small course composition too');
});

test('technology keeps only the former third LCD effect, including stale saved choices', () => {
  const variants = getGroupEffectVariants(1792);
  assert.deepEqual(variants.map(v => v.id), ['lcd-screen']);
  assert.equal(variants[0].effect.sceneId, 'lcd-screen');
  for (const variantId of [null, 'lcd-screen', 'led-matrix', 'digital-rain', 'nixie-clock', 'nixie-clock-full']) {
    assert.equal(getGroupEffect({ categoryId: 1792, title: null, variantId }), variants[0].effect);
  }
  assert.ok(!getHiddenGroupEffectVariants().some(v => v.categoryId === 1792));
});

test('culture keeps embroidery and bonfire while the commented amber cannot return via a saved ID', () => {
  const variants = getGroupEffectVariants(1800);
  assert.deepEqual(variants.map(v => v.id), ['embroidery', 'song-fire']);
  assert.equal(getGroupEffect({ categoryId: 1800, title: null, variantId: 'amber' }), variants[0].effect);
  assert.equal(variants[1].effect.kind, 'song-fire');
});

test('happiness keeps kaleidoscope while the commented-out second effect cannot be restored by a saved ID', () => {
  const variants = getGroupEffectVariants(1794);
  assert.deepEqual(variants.map(v => v.id), ['kaleidoscope']);
  assert.equal(variants[0].effect.sceneId, 'kaleidoscope');
  assert.equal(getGroupEffect({ categoryId: 1794, title: null, variantId: 'glitter-full' }), variants[0].effect);
});

test('greetings keeps only the third look, including stale first and second selections', () => {
  const variants = getGroupEffectVariants(1763);
  assert.deepEqual(variants.map(v => v.id), ['legacy-1763']);
  assert.equal(variants[0].effect.sceneId, 'greetings');
  for (const variantId of [null, 'hello-orbit', 'certificate-bureau', 'legacy-1763']) {
    assert.equal(getGroupEffect({ categoryId: 1763, title: null, variantId }), variants[0].effect);
  }
});

test('shopping removes its first two looks and defaults to the remaining neon signs', () => {
  const variants = getGroupEffectVariants(1769);
  assert.deepEqual(variants.map(v => v.id), ['legacy-1769']);
  assert.equal(variants[0].effect.sceneId, 'neon-signs');
  for (const variantId of [null, 'midnight-arcade', 'neon-market', 'legacy-1769']) {
    assert.equal(getGroupEffect({ categoryId: 1769, title: null, variantId }), variants[0].effect);
  }
  assert.ok(!getHiddenGroupEffectVariants().some(v => v.categoryId === 1769));
});

test('transport offers the open sleeping car and its detailed look (2026-10-30); old saved IDs cannot reactivate retired effects', () => {
  const all = getGroupEffectVariants(1767);
  assert.deepEqual(all.map(v => v.id), ['platskart-journey', 'platskart-detailed']);
  // The detailed look is the same scene with platDetail on.
  assert.deepEqual(all[1].effect.bodyEffect, { scene: 'platskart-journey' });
  assert.equal(all[1].effect.sceneParams.platDetail, 1);
  const variants = all.slice(0, 1);
  for (const variantId of [null, 'legacy-1767', 'transit-globe', 'transit-machine', 'pizza-express', 'restless-suitcase', 'ticket-journey']) {
    assert.equal(getGroupEffect({ categoryId: 1767, title: null, variantId }), variants[0].effect);
  }
  for (const variant of variants) {
    assert.equal(isCinematicScene(variant.id), true);
    assert.equal(getGroupEffect({ categoryId: 1767, title: null, variantId: variant.id }), variant.effect);
    assert.deepEqual(variant.effect.bodyEffect, { scene: variant.id });
  }
});

test('crafts offers just the pottery wheel, including a stale saved forge choice', () => {
  assert.deepEqual(getGroupEffectVariants(1793).map(v => v.id), ['pottery-wheel']);
  for (const variantId of [null, 'legacy-1793', 'pottery-wheel']) {
    const effect = getGroupEffect({ categoryId: 1793, title: null, variantId });
    assert.equal(effect.bodyOnly, true);
    assert.equal(effect.bodyEffect, 'pottery');
  }
});

test('travel offers one pond and falls back from the retired card choice', () => {
  const variants = getGroupEffectVariants(1782);
  assert.deepEqual(variants.map(v => v.id), ['lantern-water-body']);
  for (const savedId of [null, 'lantern-water', 'lantern-water-body']) {
    const activeId = variants.find(v => v.id === savedId)?.id ?? variants[0].id;
    const effect = getGroupEffect({ categoryId: 1782, title: null, variantId: activeId });
    assert.equal(effect.bodyEffect, 'lantern-water');
    assert.equal(effect, variants[0].effect);
  }
});

test('A1 travel offers just one continuous highway plus the unchanged rainy street', () => {
  const variants = getGroupEffectVariants(1772);
  assert.deepEqual(variants.map(v => v.id), ['highway-panorama', 'street-relight']);
  const road = variants[0].effect;
  assert.equal(road.sceneId, 'highway-panorama');
  assert.deepEqual(road.bodyEffect, { scene: 'highway-panorama' });
  for (const variantId of [null, 'highway', 'highway-panorama', 'legacy-1772']) assert.equal(getGroupEffect({ categoryId: 1772, title: null, variantId }), road);
  assert.equal(variants[1].effect.bodyEffect, 'street-relight');
  assert.equal(variants[1].effect.accent, '#ffcf8a');
  assert.equal(getGroupEffect({ categoryId: 1772, title: null, variantId: 'street-relight' }), variants[1].effect);
});

test('Какие мы keeps only the former last constellation, including stale saved selections', () => {
  const variants = getGroupEffectVariants(1776);
  assert.deepEqual(variants.map(v => v.id), ['legacy-1776']);
  assert.equal(variants[0].label.ru, 'Созвездия характеров');
  assert.equal(variants[0].effect.sceneId, 'constellation');
  for (const variantId of [null, 'legacy-1776', 'prism-personas', 'prism-personas-faceted', 'face-atelier', 'polite-mask']) {
    assert.equal(getGroupEffect({ categoryId: 1776, title: null, variantId }), variants[0].effect);
  }
});

test('retired facets keep their cinematic registration', () => {
  assert.equal(isCinematicScene('prism-personas-faceted'), true);
});

test('family keeps the photo garland as its default (2026-10-30: the campfire offered beside it), retired choices resolve to it', () => {
  const variants = getGroupEffectVariants(1775);
  assert.deepEqual(variants.map(v => v.id), ['legacy-1775', 'family-campfire']);
  assert.equal(variants[0].icon, '📷');
  assert.equal(variants[0].effect.sceneId, 'polaroids');
  for (const variantId of [null, 'legacy-1775', 'memory-mobile', 'family-supper']) {
    assert.equal(getGroupEffect({ categoryId: 1775, title: null, variantId }), variants[0].effect);
  }
});

test('career keeps only the former first and fifth effects (the library is in the test gallery only), stale selections resolve to the first', () => {
  const variants = getGroupEffectVariants(1784);
  assert.deepEqual(variants.map(v => v.id), ['knowledge-launch', 'zero-gravity-drop']);
  assert.deepEqual(variants.map(v => v.label.ru), ['Космодром знаний', 'Капля в невесомости']);
  assert.equal(getGroupEffect({ categoryId: 1784, title: null, variantId: 'spiral-library' }), variants[0].effect);
  assert.equal(getGroupEffect({ categoryId: 1784, title: null }), variants[0].effect);
  for (const variant of variants) assert.equal(getGroupEffect({ categoryId: 1784, title: null, variantId: variant.id }), variant.effect);
  for (const variantId of ['skill-tree', 'career-ladder', 'jetpack-aviator', 'domino-archipelago']) {
    assert.equal(getGroupEffect({ categoryId: 1784, title: null, variantId }), variants[0].effect);
  }
});

test('the agreed plan is reachable without changing protected effects', () => {
  const planned = [
    [1767, 'platskart-journey'],
    [1772, 'highway-panorama'], [1775, 'legacy-1775'],
    [1779, 'week-book'],
    [1784, 'zero-gravity-drop'], [1786, 'late-stories'],
    [1787, 'fireflies'], [1788, 'folding-home'], [1789, 'fogged-blackheads'],
  ];
  for (const [categoryId, id] of planned) {
    const variant = getGroupEffectVariants(categoryId).find(v => v.id === id);
    assert.ok(variant, `${categoryId}:${id}`);
    assert.equal(getGroupEffect({ categoryId, title: null, variantId: id }), variant.effect);
    assert.ok(variant.effect.sceneId || typeof variant.effect.bodyEffect === 'object', id);
  }
  assert.equal(getGroupEffect({ categoryId: 1772, title: null, variantId: 'street-relight' }).bodyEffect, 'street-relight');
  assert.equal(getGroupEffect({ categoryId: 1800, title: null, variantId: 'song-fire' }).kind, 'song-fire');
  assert.equal(getGroupEffect({ categoryId: 1793, title: null }).bodyEffect, 'pottery');
});

test('retired planner and neighbourhood choices cannot restore the removed effects', () => {
  for (const [categoryId,active,retired] of [
    [1779,'week-book',['planner','focus-clock','kinetic-planner','time-switchyard','legacy-1779','week-gardens','day-astrolabe']],
    [1788,'folding-home',['iso-town','home-windows','rain-metropolis','legacy-1788']],
  ]) {
    assert.deepEqual(getGroupEffectVariants(categoryId).map(v=>v.id),categoryId===1779?[active]:[active,'snow-globe-town']);
    for(const variantId of retired)assert.equal(getGroupEffect({categoryId,title:null,variantId}).sceneId,active);
  }
});

test('the planner offers only the week book (owner, 2026-10-30), and it is the default', () => {
  const variants=getGroupEffectVariants(1779);
  assert.deepEqual(variants.map(v=>v.id),['week-book']);
  assert.equal(getGroupEffect({categoryId:1779,title:null}),variants[0].effect);
  assert.deepEqual(variants[0].effect.bodyEffect,{scene:'week-book'});
});

test('leisure keeps the cube and park, archives balloons for the gallery and removes speakers', async () => {
  const variants = getGroupEffectVariants(1771);
  // 2026-10-30: the cube with the carnival «Fiesta» pinball added as a third choice.
  assert.deepEqual(variants.map(v => v.id), ['voxel-led-cube', 'cloud-carnival', 'pinball-fiesta']);
  assert.equal(variants[2].effect.sceneParams.leisurePinball, 3);
  const effect = getGroupEffect({ categoryId: 1771, title: null });
  assert.equal(effect.sceneId, 'voxel-led-cube');
  assert.deepEqual(effect.bodyEffect, { scene: 'voxel-led-cube', palette: 0 });
  assert.equal(effect.sceneParams.lcMode, 0, 'show the cube, not the holiday figures');
  assert.equal(effect, variants[0].effect);
  for (const variant of variants) {
    assert.equal(getGroupEffect({ categoryId: 1771, title: null, variantId: variant.id }), variant.effect);
  }
  const archived = getHiddenGroupEffectVariants().filter(v => v.categoryId === 1771);
  assert.deepEqual(archived.map(v => v.variant.id), ['balloons']);
  assert.equal(getGroupEffect({ categoryId: 1771, title: null, variantId: 'balloons' }), archived[0].variant.effect);
  assert.equal(archived[0].variant.effect.sceneId, 'balloons');
  assert.equal(getGroupEffect({ categoryId: 1771, title: null, variantId: 'speakers' }), effect);
  for (const savedId of ['balloons', 'speakers']) {
    const activeId = variants.find(v => v.id === savedId)?.id ?? variants[0].id;
    assert.equal(getGroupEffect({ categoryId: 1771, title: null, variantId: activeId }), effect);
  }
  const gallery = await readFile(new URL('../../../../../app/course/effects-preview/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(gallery, /categoryId: 1771, variantId: 'speakers'/);
  assert.match(gallery, /getHiddenGroupEffectVariants\(\)\.map/);
  assert.equal(getGroupEffect({ categoryId: 1783, title: null }).sceneId, 'voxel-led-cube');
  assert.deepEqual(CINEMATIC_ARCHIVES.map(s => s.id), ['cloud-carnival-original', 'cloud-carnival-party-v1']);
  for (const archive of CINEMATIC_ARCHIVES) {
    assert.equal(isCinematicScene(archive.id), true);
    assert.ok(!variants.some(v => v.id === archive.id));
  }
});

