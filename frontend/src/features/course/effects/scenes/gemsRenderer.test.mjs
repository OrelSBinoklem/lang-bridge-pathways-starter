import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const urls=new Map();
async function moduleUrl(name) {
  if(urls.has(name)) return urls.get(name);
  let code=ts.transpileModule(await readFile(new URL(`./${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const imports=[...code.matchAll(/from ['"]\.\/([^'"]+)['"]/g)];
  for(const match of imports) code=code.replace(match[0],`from '${await moduleUrl(match[1])}'`);
  const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');urls.set(name,url);return url;
}
const {createGemRenderer}=await import(await moduleUrl('gemsGL'));
const {GEMS}=await import(await moduleUrl('gemsData'));
function fixture(width=700,height=420) {
  const calls=[],sources=[];let serial=0;
  const gl=new Proxy({}, {get(_,name){
    if(/^[A-Z_0-9]+$/.test(name)) return name;
    if(name==='getExtension') return key=>key==='KHR_parallel_shader_compile'?{COMPLETION_STATUS_KHR:'complete'}:key==='WEBGL_lose_context'?{loseContext(){}}:{};
    if(name==='isContextLost') return ()=>false;
    if(name==='getProgramParameter'||name==='getShaderParameter') return ()=>true;
    if(name==='getUniformLocation') return (_,uniform)=>({uniform});
    if(name==='shaderSource') return (_,source)=>sources.push(source);
    if(name.startsWith('create')) return ()=>{const result={id:++serial};calls.push({name,args:[],result});return result;};
    return (...args)=>{calls.push({name,args});};
  }});
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>gl})}});
  let renderer;
  try {renderer=createGemRenderer(width,height);}
  finally {if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else delete globalThis.document;}
  const look={lamp:[250,150,420],lampI:1.4,warm:.2,studio:1,cellR:100,spin:.15,backing:1,fire:1,glow:.8,stars:.7,exposure:1,time:0,cam:[0,0,1],trace:true};
  return {renderer,calls,sources,look};
}
test('actual renderer renders a fast frame, refines exactly 64 whole samples, and then issues zero draw calls',()=>{
  const f=fixture();f.renderer.render(GEMS[6],f.look,1,0);
  assert.ok(f.calls.some(c=>c.name==='drawArrays'));
  for(let i=0;i<1000 && f.renderer.diagnostics.samples<64;i++) f.renderer.render(GEMS[6],{...f.look,time:i},1,500+i);
  assert.equal(f.renderer.diagnostics.samples,64);
  assert.equal(f.renderer.diagnostics.denoised,true);
  assert.equal(f.renderer.diagnostics.denoiseRuns,1);
  const count=f.calls.length;
  for(let i=0;i<200;i++)f.renderer.render(GEMS[6],{...f.look,time:2000+i},1,2000+i);
  assert.equal(f.calls.length,count,'cached view must not even rebind GPU state or re-run bloom');
  f.renderer.dispose();
});
test('movement discards both completed and partial samples, camera/material changes also restart',()=>{
  const f=fixture();f.renderer.render(GEMS[6],f.look,1,0);
  for(let i=0;i<12;i++)f.renderer.render(GEMS[6],f.look,1,500+i);
  assert.ok(f.renderer.diagnostics.samples>0);
  f.renderer.render(GEMS[6],{...f.look,lamp:[500,200,420]},1,600);
  assert.equal(f.renderer.diagnostics.samples,0);assert.equal(f.renderer.diagnostics.tile,0);assert.equal(f.renderer.diagnostics.mode,'fast');
  for(const [look,gem] of [[{...f.look,cam:[.1,.2,1]},GEMS[6]],[{...f.look,backing:2},GEMS[6]],[f.look,GEMS[0]]]) {
    f.renderer.render(gem,look,1,700);assert.equal(f.renderer.diagnostics.samples,0);assert.equal(f.renderer.diagnostics.mode,'fast');
  }
  f.renderer.dispose();
});
test('trace program does not inline procedural rock/fabric into the bounce loop, and uses shared real intersections',()=>{
  const f=fixture();f.renderer.render(GEMS[6],f.look,1,0);f.renderer.render(GEMS[6],f.look,1,500);
  const trace=f.sources.find(s=>s.includes('pathTraceTray')&&s.includes('const int uTrace = 1;'));
  assert.ok(trace);
  assert.doesNotMatch(trace,/vec3 rock\(|vec3 fabric\(|vec3 opalStone\(|vec3 facetedRT\(/);
  assert.match(trace,/texture\(uMaterialColor/);assert.match(trace,/texture\(uMaterialNormal/);
  assert.match(trace,/gridGemHit\(ro,rd/);assert.match(trace,/geometricVisibility\(p\+n/);
  assert.match(trace,/capsuleHit\(/);assert.match(trace,/sample1D\(1u\)/);
  assert.match(trace,/precision highp int/);
  assert.doesNotMatch(trace,/vec3 backingAt\(|float inShadow|float focus =/,'preview shadow must not leak into RT');
  assert.doesNotMatch(trace,/fastDielectric\(/,'deterministic optics must not alter the separate RT program');
  assert.match(trace,/reflections>=uMaxReflections/);
  assert.equal(f.calls.find(c=>c.name==='uniform1i'&&c.args[0]?.uniform==='uMaxReflections').args[1],2);
  assert.equal(f.calls.find(c=>c.name==='uniform1i'&&c.args[0]?.uniform==='uPathSteps').args[1],8);
  f.renderer.dispose();
});

test('non-RT program has restored projected/contact shadows without enabling progressive tracing',()=>{
  const f=fixture();f.renderer.render(GEMS[6],{...f.look,trace:false},1,0);
  const fast=f.sources.find(s=>s.includes('const int uTrace = 0;'));
  assert.ok(fast);assert.match(fast,/float inShadow = 1\.0 - smoothstep/);
  // A single call site for the stone's optics (2026-10-30); the flat cut enters at the same point as before.
  assert.match(fast,/dro=vec3\(g,0\)\+gV\*\(3\.\/gV\.z\)/);
  assert.equal(fast.split('fastDielectric(dro,-gV,tIn,nIn)').length-1,1);
  assert.equal(f.calls.find(c=>c.name==='uniform1i'&&c.args[0]?.uniform==='uFastReflections').args[1],2);
  assert.match(fast,/return fastFloor\(vec3\(gb,gFloorZ\),gV\)/);
  assert.match(fast,/return result\*mix\(1\.,\.45,contact/);
  for(let i=0;i<100;i++)f.renderer.render(GEMS[6],{...f.look,trace:false},1,1000+i);
  assert.equal(f.renderer.diagnostics.samples,0);assert.equal(f.renderer.diagnostics.denoiseRuns,0);
  f.renderer.dispose();
});

test('disabled tracing never compiles its shader or refines, and switching off discards traced history',()=>{
  const f=fixture();const fast={...f.look,trace:false};
  f.renderer.render(GEMS[6],fast,1,0);
  const draws=f.calls.filter(c=>c.name==='drawArrays').length;
  for(let i=0;i<1000;i++)f.renderer.render(GEMS[6],{...fast,time:i},1,500+i);
  assert.equal(f.renderer.diagnostics.samples,0);
  assert.equal(f.calls.filter(c=>c.name==='drawArrays').length,draws);
  assert.ok(!f.sources.some(s=>s.includes('const int uTrace = 1;')&&s.includes('pathTraceTray')));
  assert.ok(!f.sources.some(s=>s.includes('uniform sampler2D uNoisy;')));
  f.renderer.render(GEMS[6],f.look,1,2000);
  for(let i=0;i<10;i++) f.renderer.render(GEMS[6],f.look,1,2500+i);
  assert.ok(f.renderer.diagnostics.samples>0);
  f.renderer.render(GEMS[6],fast,1,3000);
  assert.equal(f.renderer.diagnostics.samples,0);assert.equal(f.renderer.diagnostics.mode,'fast');
  const count=f.calls.length;
  f.renderer.render(GEMS[6],fast,1,10000);
  assert.equal(f.calls.length,count);
  f.renderer.dispose();
});
test('all allocated textures, framebuffers and linked programs are disposed, including the final denoiser',()=>{
  for(const converge of [false,true]) {
    const f=fixture();f.renderer.render(GEMS[6],f.look,1,0);f.renderer.render(GEMS[6],f.look,1,500);
    if(converge)for(let i=0;i<1000&&f.renderer.diagnostics.samples<64;i++)f.renderer.render(GEMS[6],f.look,1,501+i);
    f.renderer.dispose();
    for(const kind of ['Texture','Framebuffer','Program','Buffer','VertexArray']) {
      assert.equal(f.calls.filter(c=>c.name===`delete${kind}`).length,f.calls.filter(c=>c.name===`create${kind}`).length,kind);
    }
  }
});

test('denoise runs only on the completed 64th sample, reuses existing targets, and resets on movement',()=>{
  const f=fixture();f.renderer.render(GEMS[6],f.look,1,0);
  const textures=f.calls.filter(c=>c.name==='createTexture').length,fbos=f.calls.filter(c=>c.name==='createFramebuffer').length;
  for(let i=0;i<1000&&f.renderer.diagnostics.samples<63;i++) f.renderer.render(GEMS[6],f.look,1,500+i);
  assert.equal(f.renderer.diagnostics.denoised,false);assert.equal(f.renderer.diagnostics.denoiseRuns,0);
  for(let i=0;i<100&&f.renderer.diagnostics.samples<64;i++) f.renderer.render(GEMS[6],f.look,1,2000+i);
  assert.equal(f.renderer.diagnostics.denoised,true);assert.equal(f.renderer.diagnostics.denoiseRuns,1);
  assert.equal(f.calls.filter(c=>c.name==='createTexture').length,textures);
  assert.equal(f.calls.filter(c=>c.name==='createFramebuffer').length,fbos);
  const moved={...f.look,lamp:[400,200,420]};f.renderer.render(GEMS[6],moved,1,3000);
  assert.equal(f.renderer.diagnostics.denoised,false);assert.equal(f.renderer.diagnostics.samples,0);
  for(let i=0;i<1000&&f.renderer.diagnostics.samples<64;i++)f.renderer.render(GEMS[6],moved,1,3500+i);
  assert.equal(f.renderer.diagnostics.denoiseRuns,2);
  const count=f.calls.length;f.renderer.render(GEMS[6],moved,1,10000);assert.equal(f.calls.length,count);
  f.renderer.dispose();
});

test('caustics cache lighting independently of exposure, material and trace accumulation',()=>{
  const f=fixture(),look={...f.look,trace:false};
  f.renderer.render(GEMS[6],look,1,0);
  assert.equal(f.renderer.diagnostics.causticBakes,1);
  assert.ok(f.renderer.diagnostics.causticRays>0&&f.renderer.diagnostics.causticRays<=45000);
  for(const extra of [{exposure:1.5},{backing:0},{glow:.4},{studio:.5}])
    f.renderer.render(GEMS[6],{...look,...extra},1,100);
  assert.equal(f.renderer.diagnostics.causticBakes,1);
  f.renderer.render(GEMS[6],{...look,lamp:[300,150,420]},1,200);
  assert.equal(f.renderer.diagnostics.causticBakes,2);
  f.renderer.render(GEMS[6],{...look,warm:.6},1,300);
  assert.equal(f.renderer.diagnostics.causticBakes,3);
  f.renderer.render(GEMS[8],look,1,400);
  assert.equal(f.renderer.diagnostics.causticRays,0,'opaque opal skips all photon tracing');
  const draws=f.calls.filter(c=>c.name==='drawArraysInstanced').length;
  f.renderer.render(GEMS[8],look,1,2000);
  assert.equal(f.calls.filter(c=>c.name==='drawArraysInstanced').length,draws);
  f.renderer.dispose();
});

test('shared floor and native edge AA are confined to preview; separate RT retains its own physical transport',()=>{
  const f=fixture(3840,2160);f.renderer.render(GEMS[6],{...f.look,trace:false},2,0);
  const fast=f.sources.find(s=>s.includes('const int uTrace = 0;'));
  assert.match(fast,/return fastFloor\(vec3\(gb,gFloorZ\),gV\)/);
  assert.match(fast,/return fastFloor\(p\+d\*t,-d\)/);
  assert.match(fast,/result\+=albedo\*texture\(uCaustics,causticUv\)/);
  assert.doesNotMatch(fast,/float focus = pow\(fbm/);
  assert.equal(f.calls.find(c=>c.name==='uniform1i'&&c.args[0]?.uniform==='uFastAA').args[1],1);
  f.renderer.render(GEMS[6],f.look,2,100);
  for(let i=0;i<100;i++)f.renderer.render(GEMS[6],f.look,2,500+i);
  const trace=f.sources.find(s=>s.includes('const int uTrace = 1;')&&s.includes('pathTraceTray'));
  assert.doesNotMatch(trace,/uCaustics|fastFloor/);
  assert.equal(f.renderer.canvas.width,3840);assert.equal(f.renderer.canvas.height,2160);
  const aa=f.calls.filter(c=>c.name==='uniform1i'&&c.args[0]?.uniform==='uFastAA');
  assert.equal(aa.at(-1).args[1],0);
  f.renderer.dispose();
});
