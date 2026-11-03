import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('./gemsSampling.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {gemPcg,gemPermute64,GEM_SAMPLING_GLSL}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const unit=value=>(value>>>8)/16777216;

test('PCG output is bounded, deterministic, and not rounded to one in float32',()=>{
  let mean=0,square=0;const bins=new Uint32Array(16),n=65536;
  for(let i=0;i<n;i++) {
    const a=gemPcg(i);assert.equal(a,gemPcg(i));const x=Math.fround(unit(a));
    assert.ok(x>=0&&x<1);mean+=x;square+=x*x;bins[Math.floor(x*16)]++;
  }
  mean/=n;square/=n;
  assert.ok(Math.abs(mean-.5)<.004);assert.ok(Math.abs(square-1/3)<.004);
  assert.ok(bins.every(count=>Math.abs(count-n/16)<300));
  assert.equal(Math.fround(unit(0xffffffff)),1-1/16777216);
  assert.match(GEM_SAMPLING_GLSL,/>>8u/);
});

test('each pixel/dimension gets all 64 distinct strata, covering every 8x8 cell once',()=>{
  for(let pixel=0;pixel<100;pixel++)for(let dimension=0;dimension<18;dimension++) {
    const seed=gemPcg(gemPcg(pixel)^gemPcg((dimension+0x9e3779b9)>>>0));
    const cells=Array.from({length:64},(_,i)=>gemPermute64(i,seed));
    assert.equal(new Set(cells).size,64);
    for(let axis=0;axis<2;axis++) {
      const bins=new Uint8Array(8);for(const c of cells)bins[axis?c>>>3:c&7]++;
      assert.ok(bins.every(n=>n===8));
    }
  }
});

test('scrambles differ by dimension and pixel, without coupling the same sample cells',()=>{
  const sequences=new Set();
  for(let pixel=0;pixel<32;pixel++)for(let dimension=0;dimension<8;dimension++) {
    const seed=gemPcg(gemPcg(pixel)^gemPcg((dimension+0x9e3779b9)>>>0));
    sequences.add(Array.from({length:64},(_,i)=>gemPermute64(i,seed)).join(','));
  }
  assert.equal(sequences.size,256);
});

test('stratification reduces error on a smooth emitter integral without biasing its mean',()=>{
  let randomError=0,stratifiedError=0,stratifiedMean=0;
  // Integral x^2+y^2 on [0,1]^2 is exactly 2/3. Same jitter count for both estimators.
  for(let pixel=0;pixel<512;pixel++) {
    const seed=gemPcg(pixel);let a=0,b=0;
    for(let i=0;i<64;i++) {
      const x=unit(gemPcg(seed^gemPcg(i*2))),y=unit(gemPcg(seed^gemPcg(i*2+1)));
      const cell=gemPermute64(i,seed),sx=((cell&7)+x)/8,sy=((cell>>>3)+y)/8;
      a+=x*x+y*y;b+=sx*sx+sy*sy;
    }
    a/=64;b/=64;randomError+=(a-2/3)**2;stratifiedError+=(b-2/3)**2;stratifiedMean+=b/512;
  }
  assert.ok(stratifiedError<randomError*.1);
  assert.ok(Math.abs(stratifiedMean-2/3)<.002);
});

test('public UI exposes only the native stone picker; admin tracing retains numeric saved preferences',async()=>{
  const scene=await readFile(new URL('./gems.ts',import.meta.url),'utf8');
  const picker=await readFile(new URL('./GemChoice.tsx',import.meta.url),'utf8');
  const panel=await readFile(new URL('../tuning/EffectTuningPanel.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(scene,/chips\.find|Без трассировки|Авто · 64/);
  assert.match(picker,/<select aria-label="Выбрать камень"/);
  assert.match(picker,/<option[^>]*>\{gem\.name\} — \{gem\.note\}<\/option>/);
  assert.doesNotMatch(picker,/<button|gmTrace|gmBacking/);
  assert.match(panel,/'Без трассировки': 0, 'Трассировка: 64 семпла': 1/);
});
