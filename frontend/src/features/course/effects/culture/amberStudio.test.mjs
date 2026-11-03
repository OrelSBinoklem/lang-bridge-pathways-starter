import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as T from 'three';

const require=createRequire(import.meta.url),cache=new Map(),renderers=[];
class Renderer {
  constructor({canvas}) {this.canvas=canvas;this.capabilities={getMaxAnisotropy:()=>4};this.disposals=0;renderers.push(this);}
  setPixelRatio(r) {this.ratio=r;}
  setSize(w,h) {this.canvas.width=Math.round(w*this.ratio);this.canvas.height=Math.round(h*this.ratio);}
  async compileAsync() {if(Renderer.failCompilation)throw new Error('test compilation failure');}
  render(scene,camera) {this.scene=scene;this.camera=camera;}
  dispose() {this.disposals++;}
  forceContextLoss() {this.lost=true;}
}
function load(file) {
  if(cache.has(file))return cache.get(file);
  const out={exports:{}};cache.set(file,out.exports);
  new Function('require','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{
    if(name==='three')return {...T,WebGLRenderer:Renderer,PMREMGenerator:class {fromScene(){return {texture:new T.Texture(),dispose(){}};}dispose(){}}};
    if(name.includes('RoomEnvironment'))return {RoomEnvironment:class extends T.Scene {dispose(){}}};
    if(name.startsWith('.'))return load(new URL(name+'.ts',file));
    return require(name);
  },out.exports);return out.exports;
}
const model=load(new URL('./amberModel.ts',import.meta.url)),{createAmberParams}=load(new URL('./params.ts',import.meta.url));
const {createAmberStudio}=load(new URL('./amberStudio.ts',import.meta.url));
function canvas() {
  const labels=[],listeners=new Map();
  const context={labels,createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){},fillText(t){labels.push(t);},measureText:t=>({width:t.length*9}),createRadialGradient:()=>({addColorStop(){}}),setTransform(){},clearRect(){},beginPath(){},roundRect(){},fill(){}};
  return {width:1,height:1,dataset:{},listeners,context,getContext:()=>context,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};
}
const pointer=()=>({x:0,y:0,active:false,moved:false,pressed:false});

test('separate amber nuggets have finite smooth geometry and deterministic irregular shapes',()=>{
  const a=model.amberGeometry(2),b=model.amberGeometry(2),c=model.amberGeometry(3);
  try {assert.deepEqual(a.attributes.position.array,b.attributes.position.array);assert.notDeepEqual(a.attributes.position.array,c.attributes.position.array);
    assert.ok(a.index);assert.ok(a.attributes.position.array.every(Number.isFinite));assert.ok(a.attributes.normal.array.every(Number.isFinite));
    for(let i=0;i<a.attributes.position.count;i++)assert.ok(new T.Vector3().fromBufferAttribute(a.attributes.position,i).length()>.8);
  }finally{a.dispose();b.dispose();c.dispose();}
});

test('compact, full-window and portrait layouts keep all stones in view',()=>{
  for(const [w,h] of [[1100,190],[500,220],[1280,720],[390,844],[1920,1080]]){
    const l=model.amberLayout(w,h),aspect=w/h,halfY=l.distance*Math.tan(19*Math.PI/180),halfX=halfY*aspect;
    assert.ok(Math.abs(l.main.x)+l.scale.x*1.14<halfX,`${w} main x`);
    assert.ok(Math.abs(l.main.y)+l.scale.y*1.14<halfY,`${w} main y`);
    for(const [x,y] of l.satellites){assert.ok(Math.abs(x)+.98<halfX,`${w} satellites x`);assert.ok(Math.abs(y)+.98<halfY,`${w} satellites y`);}
  }
});

test('drag, release, fast taps, leave and reduced motion remain bounded without repeated clicks',()=>{
  const s=model.createAmberMotion(),p=pointer();p.active=p.pressed=true;p.press={serial:1,x:0,y:0};model.stepAmberMotion(s,.016,p,720,false);
  p.x=150;model.stepAmberMotion(s,.016,p,720,false);const yaw=s.yaw;
  p.pressed=false;model.stepAmberMotion(s,.016,p,720,false);assert.equal(s.click,false);assert.notEqual(s.yaw,yaw);
  p.press={serial:2,x:150,y:0};model.stepAmberMotion(s,.016,p,720,false);assert.equal(s.click,true);
  model.stepAmberMotion(s,.016,p,720,false);assert.equal(s.click,false);
  p.press={serial:3,x:0,y:0};p.x=200;model.stepAmberMotion(s,.016,p,720,false);assert.equal(s.click,false);
  p.active=false;for(let i=0;i<3000;i++)model.stepAmberMotion(s,.03,p,720,false);
  assert.ok(Number.isFinite(s.yaw)&&Math.abs(s.yaw)<=Math.PI&&Math.abs(s.pitch)<=.65);
  const still=model.createAmberMotion();for(let i=0;i<500;i++)model.stepAmberMotion(still,.03,p,720,true);assert.equal(still.time,0);assert.equal(still.yaw,-.12);
});

test('invalid old tuning values cannot produce nonfinite transforms or excessive instances',()=>{
  const p=createAmberParams(Object.fromEntries(Object.keys(createAmberParams()).map(k=>[k,NaN]))),s=model.amberSettings(p);
  assert.ok(Object.values(s).every(Number.isFinite));assert.equal(s.words,9);
  assert.equal(model.amberSettings({...p,words:999,inclusions:999}).words,25);
  for(let i=0;i<25;i++)assert.ok(model.amberWordPosition(i).length()<1);
});

test('renderer resizes and tunes in place, preserves geometry, and disposes resources once',async()=>{
  const old={document:globalThis.document,matchMedia:globalThis.matchMedia,devicePixelRatio:globalThis.devicePixelRatio};
  globalThis.document={hidden:false,createElement:()=>canvas()};globalThis.matchMedia=()=>({matches:false});globalThis.devicePixelRatio=2;
  let studio;
  try {
    const target=canvas(),overlay=canvas(),p=createAmberParams();studio=await createAmberStudio({canvas:target,overlay,width:1100,height:190,params:p,uk:false});
    const mouse=pointer();studio.frame(0,mouse);const r=renderers.at(-1),before=new Set();r.scene.traverse(o=>{if(o.geometry)before.add(o.geometry);});
    assert.equal(r.scene.getObjectsByProperty('name','amber-nugget').length,4);
    for(const [w,h] of [[1280,720],[390,844],[500,220],[1920,1080]]){
      studio.resize(w,h);p.words=25;p.inclusions=2;for(let i=0;i<80;i++)studio.frame(i*17,mouse);
      assert.ok(target.width*target.height<=2_010_000);assert.ok(r.camera.aspect===w/h);
      r.scene.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(o.geometry)assert.ok(before.has(o.geometry));});
    }
    assert.ok(overlay.context.labels.some(s=>s.includes('dzintars — янтарь')));
    const geometries=[...before],disposed=new Set();geometries.forEach(g=>g.addEventListener('dispose',()=>disposed.add(g)));
    studio.dispose();studio.dispose();assert.equal(r.disposals,1);assert.equal(target.listeners.size,0);assert.equal(disposed.size,geometries.length);
  }finally{studio?.dispose();for(const [key,value] of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('a shader setup failure disposes the renderer and its context listeners',async()=>{
  const old={document:globalThis.document,matchMedia:globalThis.matchMedia,devicePixelRatio:globalThis.devicePixelRatio};
  globalThis.document={hidden:false,createElement:()=>canvas()};globalThis.matchMedia=()=>({matches:false});globalThis.devicePixelRatio=1;Renderer.failCompilation=true;
  const target=canvas();
  try{
    await assert.rejects(createAmberStudio({canvas:target,overlay:canvas(),width:500,height:220,params:createAmberParams(),uk:false}),/test compilation failure/);
    assert.equal(renderers.at(-1).disposals,1);assert.equal(target.listeners.size,0);
  }finally{Renderer.failCompilation=false;for(const [key,value]of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('restored entry point uses the original shader and fallback instead of the shelved studio',()=>{
  const entry=readFileSync(new URL('./AmberEffect.tsx',import.meta.url),'utf8');
  assert.match(entry,/from '\.\/amberShader'/);
  assert.doesNotMatch(entry,/amberStudio/);
  assert.match(entry,/<AmberFallback/);
  assert.match(entry,/cancelAnimationFrame\(rafId\)/);
  assert.match(entry,/removeEventListener\('webglcontextlost'/);
  assert.match(entry,/gl.deleteProgram\(program\)/);
});
