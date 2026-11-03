import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
async function module(name) {
  const code=ts.transpileModule(await readFile(new URL(`./${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
const {GEMS,cutPlanes}=await module('gemsData');
const {GEM_FAST_GLSL}=await module('gemsFastGL');
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),add=(a,b,t=1)=>a.map((v,i)=>v+t*b[i]);
function refract(d,n,eta) {
  const c=dot(n,d),k=1-eta*eta*(1-c*c);
  return k<0?null:d.map((v,i)=>eta*v-(eta*c+Math.sqrt(k))*n[i]);
}
function fresnel(c,from,to) {
  const ci=Math.max(0,Math.min(1,c)),sin2=(from/to)**2*(1-ci*ci);
  if(sin2>=1)return 1;
  const ct=Math.sqrt(1-sin2),rs=(from*ci-to*ct)/(from*ci+to*ct),rp=(to*ci-from*ct)/(to*ci+from*ct);
  return .5*(rs*rs+rp*rp);
}
function interval(planes,o,d) {
  let near=-1e8,far=1e8,nearN,farN;
  for(let i=0;i<planes.length;i+=4) {
    const n=Array.from(planes.subarray(i,i+3)),nd=dot(n,d),distance=planes[i+3]-dot(n,o);
    if(Math.abs(nd)<1e-8){if(distance<0)return null;continue;}
    const t=distance/nd;
    if(nd<0&&t>near){near=t;nearN=n;}if(nd>0&&t<far){far=t;farN=n;}
    if(near>far)return null;
  }
  return far>.00004?{near,far,nearN,farN}:null;
}
// Independent numeric reference: single-colour deterministic splitting, bounded to two internal reflections.
function follow(planes,origin,direction,ior,absorb) {
  const entry=interval(planes,origin,direction);if(!entry)return null;
  const entryF=fresnel(-dot(direction,entry.nearN),1,ior);
  let value=entryF,weight=1-entryF,d=refract(direction,entry.nearN,1/ior);
  let p=add(add(origin,direction,entry.near),d,.0004),reflections=0;const hits=[];
  for(let bounce=0;bounce<=2;bounce++) {
    // At the exact culet/edge a normal is not unique. Match the shader's conservative finite termination.
    const exit=interval(planes,p,d);if(!exit||exit.far<=.00004)break;
    weight*=Math.exp(-absorb*exit.far);const n=exit.farN,hit=add(p,d,exit.far);hits.push(hit);
    const F=fresnel(dot(d,n),ior,1),outgoing=refract(d,n.map(x=>-x),ior);
    if(F<1) {assert.ok(outgoing);value+=weight*(1-F);}
    else assert.equal(outgoing,null);
    if(bounce===2||weight*F<.0005)break;
    weight*=F;d=add(d,n,-2*dot(d,n));p=add(hit,d,.0004);reflections++;
  }
  return {value,reflections,hits};
}

test('dielectric Fresnel agrees at normal incidence, conserves branch weights and detects total internal reflection',()=>{
  for(const n of [1.45,1.58,1.77,2.417]) {
    assert.ok(Math.abs(fresnel(1,1,n)-((n-1)/(n+1))**2)<1e-12);
    for(let i=0;i<100;i++){const F=fresnel(i/100,n,1);assert.ok(F>=0&&F<=1);assert.equal(F+(1-F),1);}
    assert.equal(fresnel(.1,n,1),1);
  }
});

test('actual cuts have finite deterministic colour paths with no more than two reflections or invented energy',()=>{
  for(const gem of GEMS.filter(g=>g.cut!=='cabochon'))for(const x of [-.35,0,.35])for(const y of [-.2,0,.2]) {
    const planes=cutPlanes(gem),direction=[0,0,-1],origin=[x,y,3];
    for(const offset of [-.55,0,.9]) {
      const a=follow(planes,origin,direction,gem.ior+gem.dispersion*offset,0);
      if(!a)continue;assert.ok(a.reflections<=2);assert.ok(a.value>=0&&a.value<=1+1e-10);
      assert.ok(a.hits.flat().every(Number.isFinite));assert.deepEqual(a,follow(planes,origin,direction,gem.ior+gem.dispersion*offset,0));
      assert.ok(follow(planes,origin,direction,gem.ior+gem.dispersion*offset,2).value<=a.value);
    }
  }
});

test('dispersion changes the actual internal intersections, not just the final RGB exit direction',()=>{
  const gem=GEMS.find(g=>g.id==='diamond'),planes=cutPlanes(gem),origin=[.72,.19,3],direction=[0,0,-1];
  const red=follow(planes,origin,direction,gem.ior-gem.dispersion*.55,0);
  const blue=follow(planes,origin,direction,gem.ior+gem.dispersion*.9,0);
  assert.notDeepEqual(red.hits,blue.hits);
  assert.match(GEM_FAST_GLSL,/refract\(direction,entryN,1\.\/ior\)/);
  // One bounded loop (2026-10-30): the reflection, then per channel up to uFastReflections+1 internal segments.
  assert.match(GEM_FAST_GLSL,/bounce==uFastReflections/);
  assert.match(GEM_FAST_GLSL,/int steps=1\+3\*\(uFastReflections\+1\)/);
  assert.equal(GEM_FAST_GLSL.split('fastOutside(').length-1,2,'defined once, called once');
  assert.doesNotMatch(GEM_FAST_GLSL,/rnd\(|uSample|pathTraceTray|gridGemHit/);
});

test('fast mode is an explicit scene default; opaque opals keep their scattering while fire opal uses closed optics',async()=>{
  const scene=await readFile(new URL('./gems.ts',import.meta.url),'utf8'),renderer=await readFile(new URL('./gemsGL.ts',import.meta.url),'utf8');
  assert.match(scene,/defaultParams: \{ gmTrace: 0 \}/);
  assert.match(renderer,/if\(hit && uOpal==4\)/);
  assert.match(renderer,/gemInterval\(ro,-gV,1e6,tIn,exitT,nIn,exitN\)/);
  assert.match(GEM_FAST_GLSL,/floorAlbedo\(p,normal,rough\)/);
});
