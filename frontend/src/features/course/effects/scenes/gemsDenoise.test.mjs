import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const code=ts.transpileModule(await readFile(new URL('./gemsDenoiseGL.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {GEM_DENOISE_KERNEL:kernel,GEM_DENOISE_RANGE:range,GEM_DENOISE_GLSL}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
// Numerical reference of the shader's bounded colour guide and unclipped linear-HDR average.
function filter(image,w,h) {
  return image.map((centre,index)=>{
    const px=index%w,py=Math.floor(index/w),guide=centre.map(c=>c/(1+c));
    const sum=[0,0,0];let total=0;
    for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++) {
      const value=image[Math.max(0,Math.min(h-1,py+y))*w+Math.max(0,Math.min(w-1,px+x))];
      const distance=value.reduce((s,c,k)=>s+(c/(1+c)-guide[k])**2,0);
      const weight=kernel[x+2]*kernel[y+2]*2**(-range*distance);
      for(let k=0;k<3;k++)sum[k]+=value[k]*weight;
      total+=weight;
    }
    return sum.map(c=>c/total);
  });
}

test('denoiser preserves constant HDR, including one-pixel and border cases, without clamping highlights',()=>{
  for(const [w,h] of [[1,1],[2,3],[19,11]]) {
    const colour=[12,2,.5],image=Array.from({length:w*h},()=>colour);
    for(const value of filter(image,w,h))for(let c=0;c<3;c++)assert.ok(Math.abs(value[c]-colour[c])<1e-10);
  }
});

test('small colour grain on a flat patch is reduced without shifting the average brightness',()=>{
  const w=32,h=32;let seed=12345;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  const image=Array.from({length:w*h},()=>[0,0,0].map(()=>.3+(random()-.5)*.16));
  const output=filter(image,w,h),variance=a=>a.reduce((s,v)=>s+v.reduce((t,c)=>t+(c-.3)**2,0),0)/a.length/3;
  assert.ok(variance(output)<variance(image)*.2);
  const mean=output.flat().reduce((s,v)=>s+v,0)/(w*h*3);
  assert.ok(Math.abs(mean-.3)<.005);
});

test('high-contrast facet edges and saturated colour boundaries do not bleed like a box blur',()=>{
  const w=20,h=9;
  for(const [left,right] of [[[.02,.02,.02],[2,2,2]],[[.8,.02,.02],[.02,.02,.8]]]) {
    const image=Array.from({length:w*h},(_,i)=>i%w<w/2?left:right),output=filter(image,w,h);
    for(const x of [w/2-1,w/2]) {
      const target=x<w/2?left:right;
      for(let c=0;c<3;c++)assert.ok(Math.abs(output[4*w+x][c]-target[c])<.003);
    }
  }
  assert.match(GEM_DENOISE_GLSL,/texelFetch/);
  assert.match(GEM_DENOISE_GLSL,/outHot=/);
});
