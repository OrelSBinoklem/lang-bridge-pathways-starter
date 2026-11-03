import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('./neonSigns.ts',import.meta.url),'utf8');
const compilerOptions={module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022};
const kit={exports:{}},loaded={exports:{}};
new Function('exports',ts.transpileModule(readFileSync(new URL('./kit.ts',import.meta.url),'utf8'),{compilerOptions}).outputText)(kit.exports);
new Function('require','exports',ts.transpileModule(source,{compilerOptions}).outputText)(()=>kit.exports,loaded.exports);
const {getNeonSignContent,getNeonProductLayout,NEON_PRODUCT_ICONS,NEON_SIGNS}=loaded.exports;

test('the right fullscreen edge has its own heading, discount and shopping symbol',()=>{
  assert.deepEqual(getNeonSignContent('left'),{heading:'VEIKALS',discount:'-50%',icon:'bag'});
  assert.deepEqual(getNeonSignContent('right'),{heading:'ATVĒRTS',discount:'-30%',icon:'cart'});
  for(const key of ['heading','discount','icon'])assert.notEqual(getNeonSignContent('left')[key],getNeonSignContent('right')[key]);
});
test('cards and uninterrupted fullscreen keep the original signs',()=>{
  assert.deepEqual(getNeonSignContent(),getNeonSignContent('left'));
  assert.deepEqual(getNeonSignContent('full'),getNeonSignContent('left'));
  assert.notEqual(getNeonSignContent('right'),getNeonSignContent('right'),'presets must not be shared mutable scene state');
});
test('every label has real neon glyphs, including the macron and the new digit',()=>{
  const ast=ts.createSourceFile('neonSigns.ts',source,ts.ScriptTarget.Latest,true);
  const sets={};
  for(const statement of ast.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations){
    if(['GLYPHS','MACRONS'].includes(declaration.name.getText(ast)))sets[declaration.name.getText(ast)]=new Set(declaration.initializer.properties.map(p=>p.name.text));
  }
  for(const region of ['left','right'])for(const text of [getNeonSignContent(region).heading,getNeonSignContent(region).discount]){
    for(const ch of text)assert(sets.GLYPHS.has(ch)||sets.MACRONS.has(ch),`Missing neon glyph ${ch}`);
  }
  assert.match(source,/unit\(content.heading\)/);assert.match(source,/unit\(content.discount\)/);
});
test('region identity reaches the scene without changing card calls or shared tuning',()=>{
  const fullscreen=readFileSync(new URL('../fullscreen/SceneFullscreen.tsx',import.meta.url),'utf8');
  const runner=readFileSync(new URL('./SceneEffect.tsx',import.meta.url),'utf8');
  assert.match(fullscreen,/body region=\{region\}/);
  assert.match(runner,/scene.create\(\{[^}]*region,/);
  const card=readFileSync(new URL('../EffectSurface.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(card,/region=/);
});

test('fullscreen food outlines are distinct bent tubes with finite coordinates',()=>{
  assert.deepEqual(Object.keys(NEON_PRODUCT_ICONS),['bread','cheese','apple','bottle']);
  for(const glyph of Object.values(NEON_PRODUCT_ICONS)) {
    assert(glyph.strokes.length >= 3);
    for(const stroke of glyph.strokes) {
      assert(stroke.length >= 2);
      for(const [x,y] of stroke) { assert(Number.isFinite(x)&&Number.isFinite(y)); assert(x>=0&&x<=glyph.w); assert(y>=0&&y<=6); }
    }
  }
});

test('food belongs only to fullscreen and uses different products on each side',()=>{
  assert.deepEqual(getNeonProductLayout(1100,190,false),[]);
  const left=getNeonProductLayout(316,1080,true,'left'),right=getNeonProductLayout(316,1080,true,'right');
  assert.deepEqual(left.map(p=>p.icon),['bread','cheese']);
  assert.deepEqual(right.map(p=>p.icon),['apple','bottle']);
  for(const [width,height] of [[316,1080],[636,1440],[390,844],[1920,1080],[1100,650]]) {
    const products=getNeonProductLayout(width,height,true,'full');
    assert.equal(products.length,4);
    for(const p of products) {
      const halfWidth=p.size*NEON_PRODUCT_ICONS[p.icon].w/12;
      assert(p.x-halfWidth>0&&p.x+halfWidth<width);
      assert(p.y-p.size/2>height*.265&&p.y+p.size/2<height*.54);
    }
    for(let i=0;i<products.length;i++) for(let j=i+1;j<products.length;j++) {
      const a=products[i],b=products[j];
      assert(Math.abs(a.x-b.x)>=(a.size+b.size)/2||Math.abs(a.y-b.y)>=(a.size+b.size)/2);
    }
  }
});

test('food lighting is baked once into one extra circuit, not recalculated during animation',()=>{
  const previous=globalThis.document;
  let allocations=0;
  function canvas() {
    allocations++;
    const target={width:0,height:0},calls=[];
    const context=new Proxy({canvas:target,calls,
      createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),
      getImageData:(_x,_y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(170)}),
      createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),
      drawImage:(...args)=>calls.push(args),
    },{get:(object,key)=>key in object?object[key]:()=>{}});
    target.getContext=()=>context;
    return target;
  }
  try {
    globalThis.document={createElement:canvas};
    for(const body of [false,true]) {
      const scene=NEON_SIGNS.create({width:280,height:body?420:190,dpr:1,palette:NEON_SIGNS.palettes[0],body,region:'left',rand:()=>.5,params:{react:1,intensity:.5}});
      const output=canvas().getContext(),created=allocations;
      scene.draw(output);
      assert.equal(output.calls.length,body?7:6,'one additional cached draw, independent of food tube count');
      for(let i=0;i<60;i++) {scene.update(1/60,i/60,{active:false,clicked:false,x:0,y:0});scene.draw(output);}
      assert.equal(allocations,created,'animation must not create/rebake canvases');
      output.calls.length=0;
      scene.update(1/60,1,{active:true,clicked:true,rawX:body?280*.42625:-100,rawY:body?420*.38:-100,x:0,y:0});
      for(let i=0;i<60;i++) scene.update(1/60,1+i/60,{active:false,clicked:false,x:0,y:0});
      scene.draw(output);
      assert.equal(output.calls.length,6,'switching the product circuit off leaves the original signs running');
      scene.dispose?.();
    }
  } finally {if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
