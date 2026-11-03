import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const compile=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const {GEMS,cutPlanes}=await import(compile(await readFile(new URL('./gemsData.ts',import.meta.url),'utf8')));
// Numerical reference for the exact same half-space interval used by the GPU's gemInterval.
function clip(planes,o,d) {
  let near=-1e8,far=1e8;
  for(let i=0;i<planes.length;i+=4) {
    const nd=planes[i]*d[0]+planes[i+1]*d[1]+planes[i+2]*d[2];
    const distance=planes[i+3]-planes[i]*o[0]-planes[i+1]*o[1]-planes[i+2]*o[2];
    if(Math.abs(nd)<1e-8) {if(distance<0)return null;}
    else {const t=distance/nd;if(nd<0)near=Math.max(near,t);else far=Math.min(far,t);if(near>far)return null;}
  }
  return far>.0004?[near,far]:null;
}
test('every actual faceted gem has finite entry/exit points inside all of its own planes',()=>{
  for(const gem of GEMS.filter(g=>g.cut!=='cabochon')) {
    const planes=cutPlanes(gem),interval=clip(planes,[0,0,3],[0,0,-1]);
    assert.ok(interval,gem.id);assert.ok(interval[0]<interval[1]&&interval[0]>0,gem.id);
    for(const t of interval) for(let i=0;i<planes.length;i+=4) assert.ok(planes[i+2]*(3-t)<=planes[i+3]+1e-6,gem.id);
    assert.equal(clip(planes,[3,3,3],[0,0,-1]),null,gem.id);
  }
});
test('real cut visibility changes sides with the light; it is not an offset painted outline',()=>{
  const gem=GEMS.find(g=>g.id==='diamond'),planes=cutPlanes(gem);
  const blocks=(x,lampX)=>{
    const o=[x,0,-.9],v=[lampX-x,0,4.9],len=Math.hypot(...v),d=v.map(a=>a/len),hit=clip(planes,o,d);
    return !!hit&&hit[0]<len;
  };
  assert.equal(blocks(-.6,3),true);assert.equal(blocks(1.4,3),false);
  assert.equal(blocks(.6,-3),true);assert.equal(blocks(-1.4,-3),false);
});
test('shared RT geometry retains real dome/facets; fast backing restores the original soft/contact shadows',async()=>{
  const geometry=await readFile(new URL('./gemsGeometryGL.ts',import.meta.url),'utf8');
  const renderer=await readFile(new URL('./gemsGL.ts',import.meta.url),'utf8');
  const fast=await readFile(new URL('./gemsFastGL.ts',import.meta.url),'utf8');
  assert.match(geometry,/pl|uPlanes\[i\]/);assert.match(geometry,/float bottom=-o.z\/d.z/);
  assert.match(geometry,/hexCentre\(/);assert.match(geometry,/rayBox\(/);
  const backing=renderer.slice(renderer.indexOf('vec3 backingAt('),renderer.indexOf('// Where light leaving the stone'));
  assert.match(backing,/return fastFloor/);
  assert.match(fast,/1\.0 - smoothstep\(-\.08,\.1,outlineDist\(projected\)\)/);
  assert.match(fast,/localL\.xy\/max\(localL\.z,\.15\)\*height/);
  assert.match(fast,/mix\(1\.,\.45/);
  assert.doesNotMatch(backing,/geometricVisibility/);
});
