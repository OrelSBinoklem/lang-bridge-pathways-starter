import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const code = ts.transpileModule(await readFile(new URL('./gemsRefinement.ts', import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createGemRefinement,gemTraceTiles,GEM_TRACE_SAMPLES,GEM_IDLE_MS}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

test('enabled tracing waits for a stable lamp after the immediate fast image',()=>{
  const r=createGemRefinement();
  assert.equal(r.next('lamp1',0,true,4).mode,'fast');
  assert.equal(r.next('lamp1',GEM_IDLE_MS-1,true,4).mode,'cached');
  assert.equal(r.next('lamp1',GEM_IDLE_MS,true,4).mode,'trace');
  assert.equal(r.next('lamp2',GEM_IDLE_MS+1,true,4).mode,'fast');
  assert.equal(r.samples,0); assert.equal(r.tile,0);
});
test('exactly 64 complete samples, then no further GPU work in a settled view',()=>{
  const r=createGemRefinement();r.next('a',0,true,3);
  for(let sample=0;sample<GEM_TRACE_SAMPLES;sample++) for(let tile=0;tile<3;tile++) {
    const p=r.next('a',500+sample*3+tile,true,3);
    assert.equal(p.mode,'trace');assert.equal(p.sample,sample);assert.equal(p.tile,tile);
    assert.equal(r.completeTile(3),tile===2);
  }
  assert.equal(r.samples,64);
  for(let i=0;i<10000;i++) assert.equal(r.next('a',1000+i,true,3).mode,'cached');
});
test('moving halfway through a sample discards partial tiles and old samples, without trails',()=>{
  const r=createGemRefinement();r.next('a',0,true,4);
  for(let i=0;i<7;i++) {r.next('a',500+i,true,4);r.completeTile(4);}
  assert.equal(r.samples,1);assert.equal(r.tile,3);
  assert.equal(r.next('new camera / gem / light / backing',508,true,4).mode,'fast');
  assert.equal(r.samples,0);assert.equal(r.tile,0);
});
test('off mode stays off indefinitely and switching modes invalidates the history',()=>{
  const r=createGemRefinement();r.next('a',0,true,1);
  r.next('a',500,true,1);r.completeTile(1);
  assert.equal(r.samples,1);
  assert.equal(r.next('a',600,false,1).mode,'fast');
  assert.equal(r.samples,0);
  for(let i=0;i<10000;i++)assert.equal(r.next('a',1000+i,false,1).mode,'cached');
  assert.equal(r.next('a',20000,true,1).mode,'fast');
  assert.equal(r.next('a',20000+GEM_IDLE_MS,true,1).mode,'trace');
});
test('trace tiles cover the full image once, without gaps or overlapping scanlines',()=>{
  for(const [w,h] of [[350,190],[700,420],[1920,1080],[3840,2160]]) {
    const tiles=gemTraceTiles(w,h);let y=0,area=0;
    for(const t of tiles) {assert.equal(t.y,y);assert.equal(t.x,0);assert.equal(t.width,w);assert.ok(t.height>0);y+=t.height;area+=t.width*t.height;assert.ok(t.width*t.height<=160000+w);}
    assert.equal(y,h);assert.equal(area,w*h);
  }
});
