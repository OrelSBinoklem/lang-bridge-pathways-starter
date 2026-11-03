import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
async function module(name) {
  const code=ts.transpileModule(await readFile(new URL(`./${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
const {canvasPixelRatio,watchPixelRatio}=await module('canvasPixelRatio');
const {gemsRenderSize}=await module('gemsResolution');

test('native gem render stays 3840x2160 across browser CSS scale factors, in both card/fullscreen hosts',()=>{
  for(const ratio of [1,1.25,1.5,2,2.5,3]) for(const body of [false,true]) {
    const dpr=canvasPixelRatio(ratio,body,Infinity);
    assert.equal(dpr,ratio);
    assert.deepEqual(gemsRenderSize(3840/ratio,2160/ratio,dpr),{width:3840,height:2160});
  }
});

test('no new 4K cap is introduced; small cards also retain their physical pixel density',()=>{
  assert.deepEqual(gemsRenderSize(2560,1440,3),{width:7680,height:4320});
  assert.deepEqual(gemsRenderSize(350,190,2),{width:700,height:380});
  assert.deepEqual(gemsRenderSize(700,420,1.5),{width:1050,height:630});
});

test('manual quality reduction stays explicit while all other scenes keep historical DPR limits',()=>{
  assert.deepEqual(gemsRenderSize(1920,1080,2,.5),{width:1920,height:1080});
  assert.equal(canvasPixelRatio(2,true),1);assert.equal(canvasPixelRatio(2,false),1.75);
  assert.equal(canvasPixelRatio(3,true,2),2);assert.equal(canvasPixelRatio(0,false),1);
});

test('DPR-only monitor/zoom changes rearm the media query, notify once, and release all listeners',()=>{
  const queries=[],resize=new Set();let changes=0;
  const target={devicePixelRatio:1.5,
    matchMedia(query){const listeners=new Set(),record={query,listeners,addEventListener(_,f){listeners.add(f);},removeEventListener(_,f){listeners.delete(f);}};queries.push(record);return record;},
    addEventListener(type,f){assert.equal(type,'resize');resize.add(f);},
    removeEventListener(type,f){assert.equal(type,'resize');resize.delete(f);},
  };
  const dispose=watchPixelRatio(()=>changes++,target);
  assert.equal(queries[0].query,'(min-resolution: 1.499900dppx) and (max-resolution: 1.500100dppx)');
  const stale=[...queries[0].listeners][0];target.devicePixelRatio=2;stale();
  assert.equal(changes,1);assert.equal(queries[0].listeners.size,0);
  assert.equal(queries[1].query,'(min-resolution: 1.999900dppx) and (max-resolution: 2.000100dppx)');
  for(const f of resize)f();assert.equal(changes,1,'same change must not be notified twice');
  target.devicePixelRatio=2.5;for(const f of resize)f();assert.equal(changes,2);
  dispose();assert.equal(resize.size,0);assert.ok(queries.every(q=>q.listeners.size===0));
  target.devicePixelRatio=3;stale();assert.equal(changes,2,'late events after cleanup must not rebuild the scene');
});

test('native resolution is enabled only by the gems definition and reaches both host and WebGL renderer',async()=>{
  const scene=await readFile(new URL('./gems.ts',import.meta.url),'utf8');
  const host=await readFile(new URL('./SceneEffect.tsx',import.meta.url),'utf8');
  assert.match(scene,/pixelRatioCap: Infinity/);
  assert.match(scene,/gemsRenderSize\(W, H, c\.dpr, c\.params\.gmRes\)/);
  assert.doesNotMatch(scene,/Math\.min\(c\.dpr, 1\.5\)/);
  assert.match(host,/canvasPixelRatio\(window\.devicePixelRatio, body, scene\.pixelRatioCap\)/);
  assert.match(host,/if\(scene\.pixelRatioCap !== Infinity\) return/);
  assert.match(host,/scene\.pixelRatioCap === Infinity && \(window\.devicePixelRatio \|\| 1\) !== dpr/);
  assert.match(host,/if\(!ratioRebuildQueued\)/);
});
