import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64');
const { BLACKHEADS_PHOTO: original, BLACKHEADS_PHOTO_4K: large, BLACKHEADS_PHOTO_VARIANTS: variants, foggedPhotoSource: choose, foggedPhotoFallback: fallback } = await import(compile(await readFile(new URL('./foggedPhotoSource.ts', import.meta.url), 'utf8')));
const url = width => `/course/effects/blackheads-night-riga-v4-${width}.jpg`;

test('progressive JPEGs retain 4:3 and full color: Q90 for 2K/4K, Q95 for smaller files', async () => {
  const { default: sharp } = await import('sharp');
  const base = new URL('../../../../../public/course/effects/', import.meta.url);
  const report = JSON.parse(await readFile(new URL('blackheads-night-riga-v4.provenance.json', base), 'utf8'));
  assert.equal(report.quality, 95);
  assert.deepEqual(report.qualityOverrides, {2560:90,3840:90});
  assert.deepEqual(variants.map(v => v.width), [640,960,1440,1920,2560,3840]);
  for (const variant of variants) {
    const name = variant.url.split('/').at(-1), bytes = await readFile(new URL(name, base));
    const m = await sharp(bytes).metadata(), record = report.variants.find(v => v.name === name);
    assert.ok(record);
    assert.equal(record.quality, variant.width>=2560?90:95);
    assert.equal(m.format, 'jpeg');
    assert.deepEqual([m.width,m.height], [variant.width,variant.width * 3 / 4]);
    assert.equal(m.chromaSubsampling, '4:4:4');
    assert.equal(m.isProgressive, true);
    assert.equal(bytes.length, record.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
    assert.ok(record.psnrDb > (record.quality===90?35:38));
    assert.ok(record.ssim8x8 > .98);
  }
  assert.equal(large,url(3840));
  const archived = await sharp(await readFile(new URL('blackheads-night-clean.webp',base))).metadata();
  assert.deepEqual([archived.width,archived.height],[1448,1086]);
});

test('desktop views pick the smallest adequate JPEG rather than a single 4K file', () => {
  for (const [w,h,expected] of [[1280,720,1440],[1365,768,1440],[1536,864,1920],[1920,1080,1920],[2048,1440,2560],[2560,1440,2560],[3440,1440,3840],[3840,2160,3840]]) {
    assert.equal(choose(original,w,h),url(expected));
  }
  assert.equal(choose(original, 1920, 1080, 1.5), large);
});
test('small cards and phones use reduced JPEGs, never 4K even at high DPI', () => {
  for (const [w, h, dpr] of [[1100,190,2],[2560,190,1],[390,844,3],[1024,768,2],[600,190,4]]) {
    const result = choose(original, w, h, dpr);
    assert.ok(variants.find(v => v.url === result).width <= 1920);
  }
  assert.equal(choose(original,600,190,4),url(960));
  assert.equal(choose(original,390,844,1),url(1440));
  assert.equal(choose(original,390,844,3),url(1920));
  assert.equal(choose(original,640,480,1),url(640));
});
test('procedural glass and unrelated photographs are untouched; invalid DPR is safe', () => {
  assert.equal(choose(undefined,3840,2160,2),undefined);
  assert.equal(choose('/another.webp',3840,2160,2),'/another.webp');
  assert.equal(choose(original,1920,1080,NaN),url(1920));
  assert.equal(choose(original,2560,1440,NaN),url(2560));
  assert.equal(choose(original,NaN,NaN,NaN),url(640));
  assert.equal(choose(original,0,-1,1),url(640));
  assert.equal(choose(original,1920,1080,-2),url(1920));
});
test('fallbacks strictly decrease and skip JPEGs above the GPU texture limit', () => {
  assert.equal(fallback(large),url(2560));
  assert.equal(fallback(large,2048),url(1920));
  assert.equal(fallback(large,1024),url(960));
  assert.equal(fallback(url(960)),url(640));
  assert.equal(fallback(url(640)),undefined);
  assert.equal(fallback(large,512),undefined);
  assert.equal(fallback('/another.webp'),undefined);
  let current=large,count=0;
  while (current) { current=fallback(current); count++; assert.ok(count<=variants.length); }
  assert.equal(count,variants.length);
});
test('the GPU loader applies progressive JPEG fallback on load failure and hardware limits', async () => {
  const src = await readFile(new URL('./foggedGlassGL.ts',import.meta.url),'utf8');
  assert.match(src,/foggedPhotoFallback\(currentPhotoUrl, maxTextureSize\)/);
  assert.match(src,/retrySmallerPhoto\('Photograph exceeds the GPU texture limit', ctx.getParameter\(ctx.MAX_TEXTURE_SIZE\)\)/);
  assert.match(src,/retrySmallerPhoto\('Photograph failed to load'\)/);
  assert.doesNotMatch(src,/photo\.src = BLACKHEADS_PHOTO;/);
});
