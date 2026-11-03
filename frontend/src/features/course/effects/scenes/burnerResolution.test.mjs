import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const compile = source => ts.transpileModule(source,{fileName:'module.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const scaleModule={exports:{}};
new Function('module','exports',compile(await readFile(new URL('./burnerResolution.ts',import.meta.url),'utf8')))(scaleModule,scaleModule.exports);
const {burnerRenderScale}=scaleModule.exports;
const hostModule={exports:{}};
new Function('module','exports',compile(await readFile(new URL('./canvasPixelRatio.ts',import.meta.url),'utf8')))(hostModule,hostModule.exports);
const {canvasPixelRatio}=hostModule.exports;

test('quality 1 preserves physical 4K pane pixels at 100–300% desktop scaling',()=>{
  for(const ratio of [1,1.25,1.5,2,2.5,3]){
    const dpr=canvasPixelRatio(ratio,true,Infinity),s=burnerRenderScale(dpr,1);
    assert.equal(Math.round((3840/ratio)*.45*s),1728);
    assert.equal(Math.round((2160/ratio)*s),2160);
    assert.equal(Math.round((3840/ratio)*s),3840,'single burner is also native');
  }
});
test('only explicit manual reduction lowers the large model render; invalid inputs are safe',()=>{
  assert.equal(burnerRenderScale(1,1),1);
  assert.equal(burnerRenderScale(2,.75),1.5);
  assert.equal(burnerRenderScale(2,NaN),2);
  assert.equal(burnerRenderScale(0,1),1);
  assert.equal(burnerRenderScale(Infinity,1),1);
});
test('compact dragon keeps its previous lower-detail scale',()=>{
  assert.ok(Math.abs(burnerRenderScale(1,.7,true)-.88)<1e-12);
  assert.ok(Math.abs(burnerRenderScale(2,.7,true)-1.32)<1e-12);
});

test('large-pair controls target the pair, not the compact dragon profile',async()=>{
  const overlay=await readFile(new URL('../ThemedGroupOverlay.tsx',import.meta.url),'utf8');
  const fullscreen=await readFile(new URL('../FullscreenEffect.tsx',import.meta.url),'utf8');
  assert.match(overlay,/!forceCard.*effect\.bodyEffect\.scene === 'burner-pair'/);
  assert.match(overlay,/sceneId: 'burner-pair', sceneParams: undefined/);
  assert.match(fullscreen,/tuning\.sceneId === sceneId/);
});

test('actual constructors allocate native pair/single targets, preserve compact mode and release resources',async()=>{
  const scheduled=[],allocations=[];let disposed=0;
  const descriptor=Object.getOwnPropertyDescriptors(globalThis);
  const create=(width,height)=>{allocations.push({width,height});return {canvas:{width,height},ready:true,dispose(){disposed++;}};};
  const stubs={
    './kit':{clamp:(v,lo,hi)=>Math.min(hi,Math.max(lo,v))},
    './burnerResolution':{burnerRenderScale},
    './dragonBurnerGL':{createDragonBurner:create,GRID_LEVELS:[{label:'small'},{label:'normal'}]},
    './burnerDragon':{DRAGON_MODEL:{label:'dragon',smokeDefaults:{}}},
    './burnerMountains':{MILL_MODEL:{label:'mill'},FALLS_MODEL:{label:'falls'}},
    './orbitControl':{registerCameraSwitch:()=>()=>{}},
  };
  const loaded={exports:{}};
  new Function('require','module','exports',compile(await readFile(new URL('./dragonBurner.ts',import.meta.url),'utf8')))(name=>{assert.ok(stubs[name],name);return stubs[name];},loaded,loaded.exports);
  const {DRAGON_BURNER,DRAGON_BURNER_PAIR,DRAGON_BURNER_CARD}=loaded.exports;
  assert.equal(DRAGON_BURNER_PAIR.defaultParams.quality,1);
  assert.equal(DRAGON_BURNER.defaultParams.quality,1);
  assert.equal(DRAGON_BURNER_PAIR.pixelRatioCap,Infinity);
  assert.equal(DRAGON_BURNER.pixelRatioCap,Infinity);
  assert.equal(DRAGON_BURNER_CARD.pixelRatioCap,undefined);
  try{
    globalThis.setTimeout=fn=>{scheduled.push(fn);return scheduled.length;};globalThis.clearTimeout=()=>{};
    globalThis.window={addEventListener(){},removeEventListener(){}};
    globalThis.document={createElement:()=>({getContext:()=>({})})};
    for(const ratio of [1,1.5,2]){
      const context={width:3840/ratio,height:2160/ratio,dpr:ratio,body:true,params:{quality:1,dbModel:0,dbGrid:1},palette:['#000']};
      const pair=DRAGON_BURNER_PAIR.create(context);scheduled.shift()();
      assert.deepEqual(allocations.splice(0),[{width:1728,height:2160},{width:1728,height:2160}]);pair.dispose();
      const single=DRAGON_BURNER.create({...context,params:{...context.params}});scheduled.shift()();
      assert.deepEqual(allocations.splice(0),[{width:3840,height:2160}]);single.dispose();
    }
    const card=DRAGON_BURNER_CARD.create({width:1100,height:190,dpr:1.5,body:false,params:{quality:1},palette:['#000']});scheduled.shift()();
    assert.deepEqual(allocations.splice(0),[{width:313,height:251}]);card.dispose();
    assert.equal(disposed,10);
  }finally{
    for(const key of ['setTimeout','clearTimeout','window','document']){
      if(descriptor[key])Object.defineProperty(globalThis,key,descriptor[key]);else delete globalThis[key];
    }
  }
});
