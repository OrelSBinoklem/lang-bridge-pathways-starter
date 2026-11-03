import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
register(new URL('../../../../../scripts/scene-catalog-loader.mjs', import.meta.url));
const { storyLayout, storyPhotoWidth, storyPhotoSource, STORY_COPY } = await import('./lifelongState.ts');
const { LIFELONG_SCENES } = await import('./lifelongStories.ts');
const { getGroupEffectVariants, getGroupEffect } = await import('../groupEffects.config.ts');
const { createActivatedLifeParams, ensureLifeStory, selectLifeStory, subscribeLifeStory } = await import('./lifelongSelection.ts');

test('lifelong learning offers one combined scene; former variants fall back to the unified effect', () => {
  const variants = getGroupEffectVariants(1786);
  assert.deepEqual(variants.map(v => v.id), ['late-stories']);
  assert.equal(LIFELONG_SCENES.length, 5, 'Four standalone gallery prototypes plus one combined renderer');
  for (const id of ['time-reborn', 'second-chance', 'legacy-1786', 'late-postcards', 'late-choir', 'late-workshop', 'late-neighbours']) {
    assert.ok(!variants.some(v => v.id === id));
    assert.equal(getGroupEffect({ categoryId: 1786, title: null, variantId: id }).sceneId, 'late-stories');
  }
  assert.equal(getGroupEffect({ categoryId: 1786, title: null }).sceneId, 'late-stories');
  for (const variant of variants.slice(0, 4)) {
    assert.equal(variant.effect.sceneId, variant.effect.bodyEffect.scene);
    assert.equal(variant.effect.bodyOnly, undefined);
  }
});

test('activation can choose all four pictures and resize/focus does not reroll the shared choice', () => {
  for (const [sample, expected] of [[0, 0], [.25, 1], [.5, 2], [.99, 3], [1, 3], [-1, 0], [NaN, 0]]) {
    let calls = 0;
    const params = createActivatedLifeParams({}, () => { calls++; return sample; });
    assert.equal(params.lifeStory, expected); assert.equal(calls, 1);
    for (let i = 0; i < 50; i++) assert.equal(ensureLifeStory(params, () => { throw Error('Must not reroll'); }), expected);
  }
  assert.notEqual(createActivatedLifeParams({}, () => 0), createActivatedLifeParams({}, () => 0));
});

test('public selection validates input, notifies its own instance and unsubscribes cleanly', () => {
  const a = createActivatedLifeParams({}, () => 0), b = createActivatedLifeParams({}, () => .99);
  let calls = 0; const unsubscribe = subscribeLifeStory(a, () => calls++);
  for (const value of [-1, 4, 2.5, NaN, Infinity]) assert.equal(selectLifeStory(a, value), false);
  assert.equal(calls, 0); assert.equal(a.lifeStory, 0);
  selectLifeStory(a, 2); selectLifeStory(a, 2);
  assert.equal(a.lifeStory, 2); assert.equal(b.lifeStory, 3); assert.equal(calls, 1);
  unsubscribe(); selectLifeStory(a, 1); assert.equal(calls, 1);
});

test('unified renderer keeps only one live story and disposes it before selecting another', () => {
  const log = [], definitions = LIFELONG_SCENES.slice(0, 4), originals = definitions.map(s => s.create);
  try {
    definitions.forEach((scene, i) => { scene.create = () => {
      log.push(`create:${i}`);
      return { update() {}, draw() {}, dispose() { log.push(`dispose:${i}`); } };
    }; });
    const params = createActivatedLifeParams({}, () => .25);
    const scene = LIFELONG_SCENES.find(s => s.id === 'late-stories').create({ params });
    assert.deepEqual(log, ['create:1']);
    scene.update(.016, 0, {}); scene.draw({}); assert.deepEqual(log, ['create:1']);
    selectLifeStory(params, 3); scene.update(.016, .016, {});
    assert.deepEqual(log, ['create:1', 'dispose:1', 'create:3']);
    scene.dispose(); assert.equal(log.at(-1), 'dispose:3');
  } finally { definitions.forEach((scene, i) => { scene.create = originals[i]; }); }
});

test('public story settings are available before the admin-only diagnostic gate and have RU/UK choices', async () => {
  const panel = await readFile(new URL('../tuning/EffectTuningPanel.tsx', import.meta.url), 'utf8');
  assert.ok(panel.indexOf("tuning.sceneId === 'late-stories') return <LifelongSettings") < panel.indexOf('return allowed === false ? null'));
  const settings = await readFile(new URL('./LifelongSettings.tsx', import.meta.url), 'utf8');
  assert.match(settings, /<select value=\{selected\}/);
  assert.match(settings, /uk \? story.uk : story.ru/);
  assert.doesNotMatch(settings, /isCameraAdmin|CourseEffectDebug|localStorage|fetch\(/);
  const renderer = await readFile(new URL('./SceneEffect.tsx', import.meta.url), 'utf8');
  assert.match(renderer, /subscribeLifeStory\(props.params, listener\)/);
  assert.match(renderer, /<CanvasRunner key=\{selection\}/);
  assert.equal(LIFELONG_SCENES.find(s => s.id === 'late-stories').warmupFrames, 1);
});

test('all four compositions are stills in both languages, with a concrete Latvian instruction', async () => {
  for (const scene of LIFELONG_SCENES) {
    assert.equal(scene.static, true);
    assert.equal(scene.warmupFrames, 1);
  }
  for (const copy of Object.values(STORY_COPY)) {
    assert.equal(copy.lines.length, 4);
    for (const locale of ['ru', 'uk']) {
      assert.equal(copy[locale].caption.length, 2);
      assert.ok(copy[locale].eyebrow && copy[locale].footer);
    }
  }
  assert.equal(STORY_COPY.workshop.title[0], 'Darba instrukcija');
  assert.equal(STORY_COPY.workshop.ru.caption[0], 'Прочитать инструкцию.');
  assert.equal(STORY_COPY.workshop.uk.caption[0], 'Прочитати інструкцію.');
  const source = await readFile(new URL('./lifelongStories.ts', import.meta.url), 'utf8');
  assert.match(source, /update\(\) \{\}/);
  assert.doesNotMatch(source, /pointer\.clicked|stool|drawStool|steam\(|writeReply|drawNotes|storyAction|advanceStory|button\(/);
  const runner = await readFile(new URL('./SceneEffect.tsx', import.meta.url), 'utf8');
  assert.ok(runner.includes("if (scene.static || window.matchMedia"));
});

test('small composition stays on the right; body reading mode stays outside the 1240px content', () => {
  for (const [w, h] of [[360, 190], [520, 230], [1100, 190], [1100, 330]]) {
    const l = storyLayout(w, h, false);
    assert.ok(l.x - 250 * l.scale > w * .5);
    assert.ok(l.y - 300 * l.scale >= 0);
    assert.ok(l.y + 380 * l.scale < h);
  }
  for (const w of [1920, 2560, 3840]) {
    const l = storyLayout(w, 1080, true, true);
    assert.equal(l.side, true); assert.ok(l.x - 250 * l.scale >= (w + 1240) / 2);
    assert.ok(l.x + 250 * l.scale <= w);
  }
  const phone = storyLayout(390, 844, true, false);
  assert.ok(phone.x - 250 * phone.scale >= 0); assert.ok(phone.x + 250 * phone.scale <= 390);
});

test('Full HD and smaller stay on original pictures regardless of DPR; larger backgrounds use SDXL', () => {
  assert.equal(storyPhotoWidth(1100, false, 3), 768);
  assert.equal(storyPhotoWidth(360, true, 2), 768);
  assert.equal(storyPhotoWidth(1280, true, 1), 1536);
  assert.equal(storyPhotoWidth(1920, true, 1), 1536);
  assert.equal(storyPhotoWidth(2560, true, 1), 2560);
  assert.equal(storyPhotoWidth(2560, true, 1.00000003), 2560);
  assert.equal(storyPhotoWidth(1920, true, 2), 1536);
  assert.equal(storyPhotoWidth(1921, true, 1), 2560);
  assert.equal(storyPhotoWidth(1921, true, 2), 3840);
  assert.equal(storyPhotoWidth(3840, true, 2), 3840);
});

test('every card/original path avoids AI derivatives, while large paths explicitly use variant B', () => {
  for (const plate of ['postcards','choir','new-profession','neighbour-tea']) {
    for (const dpr of [1,1.25,1.5,2,3]) {
      assert.equal(storyPhotoSource(plate,3840,false,dpr), `/course/effects/lifelong/${plate}-768.webp`);
      for (const width of [390,768,1280,1919,1920]) {
        assert.match(storyPhotoSource(plate,width,true,dpr), new RegExp(`/${plate}-(768|1536)\\.webp$`));
      }
    }
    assert.equal(storyPhotoSource(plate,2560,true,1), `/course/effects/lifelong/${plate}-sdxl-2560.jpg`);
    assert.equal(storyPhotoSource(plate,3840,true,1), `/course/effects/lifelong/${plate}-sdxl-3840.jpg`);
  }
});

test('the selected B assets preserve the approved workshop and record all four SDXL backgrounds', async () => {
  const root = new URL('../../../../../public/course/effects/lifelong/', import.meta.url);
  const report = JSON.parse(await readFile(new URL('sdxl-provenance.json',root),'utf8'));
  assert.equal(report.denoise,0.28); assert.equal(report.steps,24); assert.equal(report.cfg,3);
  assert.equal(report.files.length,8);
  for (const file of report.files) {
    const bytes = await readFile(new URL(file.file,root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.width,file.width); assert.equal(meta.height,file.height); assert.equal(meta.format,'jpeg');
    assert.ok(file.file.includes('-sdxl-'));
    assert.equal(meta.height,file.width === 3840 ? 2560 : 1707);
    assert.ok(bytes.length < 7000000);
  }
  const approved = report.files.find(file => file.file === 'new-profession-sdxl-3840.jpg');
  assert.equal(approved.sha256,'12838215d3bc14960c236fe7f3f4ff46a696ddd16403cc9c54493c52ba741f95');
});

test('all four upscales have real 4K and medium JPEG assets with traceable AI processing', async () => {
  const root = new URL('../../../../../public/course/effects/lifelong/', import.meta.url);
  const report = JSON.parse(await readFile(new URL('upscale-provenance.json', root), 'utf8'));
  assert.equal(report.model, 'Topaz Rhea v1 (rhea-1)');
  assert.equal(report.encoding.quality, 90);
  assert.equal(report.files.length, 8);
  assert.match(report.modelSha256, /^[0-9a-f]{64}$/);
  for (const file of report.files) {
    const bytes = await readFile(new URL(file.file, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.width, file.width); assert.equal(meta.height, file.height);
    assert.equal(meta.format, 'jpeg');
    assert.equal(meta.height, file.width === 3840 ? 2560 : 1707);
    assert.ok(bytes.length < 7000000);
    assert.match(file.sourceSha256, /^[0-9a-f]{64}$/);
    assert.match(file.masterSha256, /^[0-9a-f]{64}$/);
  }
});

test('all eight photo plates exist, match their provenance and fit a bounded transfer budget', async () => {
  const root = new URL('../../../../../public/course/effects/lifelong/', import.meta.url);
  const report = JSON.parse(await readFile(new URL('provenance.json', root), 'utf8'));
  assert.equal(report.files.length, 8);
  for (const file of report.files) {
    const bytes = await readFile(new URL(file.file, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.width, file.width); assert.equal(meta.height, file.width * 2 / 3);
    assert.equal(meta.format, 'webp'); assert.ok(bytes.length < (file.width === 768 ? 180000 : 600000));
  }
});

test('renderer uses one photo, cached sheets and the existing lifecycle without WebGL or extra RAF', async () => {
  const source = await readFile(new URL('./lifelongStories.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /requestAnimationFrame|setInterval|fetch\(|WebGL|from ['"]three/);
  assert.equal((source.match(/new Image\(/g) ?? []).length, 1);
  assert.match(source, /image\.onload = image\.onerror = null/);
  assert.match(source, /ready: \(\) => loaded \|\| failed/);
});
