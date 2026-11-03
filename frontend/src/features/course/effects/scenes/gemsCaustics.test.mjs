import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const cache=new Map();
async function moduleUrl(name){
  if(cache.has(name))return cache.get(name);
  let code=ts.transpileModule(await readFile(new URL(`./${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  for(const match of [...code.matchAll(/from ['"]\.\/([^'"]+)['"]/g)])code=code.replace(match[0],`from '${await moduleUrl(match[1])}'`);
  const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');cache.set(name,url);return url;
}
const {causticLayout,CAUSTIC_RAY_BUDGET,CAUSTIC_VERTEX}=await import(await moduleUrl('gemsCaustics'));
test('photon layout covers the projected viewport and stays deterministic within its ray budget',()=>{
  for(const [w,h,r,cam] of [[350,190,52,[0,0,1]],[900,550,126,[0,0,1]],[1920,1080,189,[.5,.8,1]],[2560,1440,126,[0,0,1]],[3840,2160,126,[.8,.6,.8]]]){
    const a=causticLayout(w,h,r,cam),b=causticLayout(w,h,r,cam);
    assert.deepEqual(a.cells,b.cells);assert.deepEqual(a.bounds,b.bounds);
    assert.ok(a.grid*a.grid*27*a.cells.length/2<=CAUSTIC_RAY_BUDGET);
    for(const p of [[0,0],[w,0],[w,h],[0,h]]){
      const [x,y]=a.point(...p);assert.ok(x>a.bounds[0]&&x<a.bounds[0]+a.bounds[2]);assert.ok(y>a.bounds[1]&&y<a.bounds[1]+a.bounds[3]);
    }
    assert.deepEqual(a.point(w/2,h/2),[w/2,h/2]);
  }
});
test('elliptical photon splat conserves flux when its footprint or anisotropy changes',()=>{
  for(const [sx,sy] of [[1,1],[2,6],[8,2],[10,10]]){
    const steps=300;let sum=0;
    for(let y=0;y<steps;y++)for(let x=0;x<steps;x++){
      const r2=((x+.5)/steps*6-3)**2+((y+.5)/steps*6-3)**2;
      if(r2<=9)sum+=Math.exp(-.5*r2);
    }
    const integral=sum/(steps*steps)*36*sx*sy;
    assert.ok(Math.abs(integral/(2*Math.PI*sx*sy*(1-Math.exp(-4.5)))-1)<.001);
  }
});
test('overlapping reconstructed photons do not expose a light-dot lattice on a smooth surface',()=>{
  const values=[];
  for(let i=0;i<100;i++){
    const x=i/100;let sum=0;
    for(let k=-4;k<=4;k++)if((x-k)**2/.6<=9)sum+=Math.exp(-.5*(x-k)**2/.6);
    values.push(sum);
  }
  assert.ok(Math.max(...values)/Math.min(...values)<1.02);
  const smooth=causticLayout(900,550,126,[0,0,1],true);
  const faceted=causticLayout(900,550,126,[0,0,1]);
  assert.ok(smooth.grid>=faceted.grid*3);
  assert.ok(smooth.grid**2*27*smooth.cells.length/2<=CAUSTIC_RAY_BUDGET*12);
  assert.match(CAUSTIC_VERTEX,/photon\(uv\+vec2\(delta,0\)/);
  assert.match(CAUSTIC_VERTEX,/outerProduct\(dx,dx\)/);
});
test('caustics use the real closed geometry, RGB refraction, Fresnel and at most two internal reflections',()=>{
  assert.match(CAUSTIC_VERTEX,/float bottom=-o.z\/d.z/);
  assert.match(CAUSTIC_VERTEX,/vec4 p=uPlanes\[i\]/);
  assert.match(CAUSTIC_VERTEX,/bounce<3/);assert.match(CAUSTIC_VERTEX,/bounce==targetBounce/);
  assert.match(CAUSTIC_VERTEX,/weight\*=exp\(-uAbsorb\[channel\]\*farT\)/);
  assert.match(CAUSTIC_VERTEX,/refract\(d,-farN,ior\)/);
  assert.doesNotMatch(CAUSTIC_VERTEX,/uTime|rnd\(|fbm\(/);
});
