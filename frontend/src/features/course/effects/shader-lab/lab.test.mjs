import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const modules = new Map();
async function url(file) {
  const key = file.href; if (modules.has(key)) return modules.get(key);
  let js = ts.transpileModule(await readFile(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const item of [...js.matchAll(/from ['"]([^'"]+)['"]/g)]) {
    const replacement = item[1].startsWith('.') ? await url(new URL(item[1] + '.ts', file)) : import.meta.resolve(item[1]);
    js = js.replace(item[0], `from ${JSON.stringify(replacement)}`);
  }
  const result = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64'); modules.set(key, result); return result;
}
const { percentile, summarize, previewSize, tileRects } = await import(await url(new URL('./metrics.ts', import.meta.url)));
const { LAB_SCENES } = await import(await url(new URL('./catalog.ts', import.meta.url)));
const { LabRenderer } = await import(await url(new URL('./renderer.ts', import.meta.url)));

test('23 unique shaders, twelve new studies/showcases and valid palettes', () => {
  assert.equal(LAB_SCENES.length, 23); assert.equal(new Set(LAB_SCENES.map(s => s.id)).size, 23);
  for (const s of LAB_SCENES) { assert.match(s.fragment, /vec3 scene\(/); for (const p of s.palettes) { assert.equal(p.length, 4); p.forEach(c => assert.match(c, /^#[a-f\d]{6}$/i)); } }
});
test('frame statistics use total elapsed time, real percentiles and honest missing GPU data', () => {
  const stats = summarize({ frames: [10, 10, 40], cpu: [0.2, 0.1, 0.3], gpu: [] });
  assert.equal(stats.fps, 50); assert.equal(stats.frameP95, 40); assert.equal(stats.slowFrames, 1);
  assert.equal(stats.cpuMedian, .2); assert.equal(stats.gpuMedian, null); assert.equal(stats.reliable, false);
  assert.equal(summarize({frames:Array(180).fill(1000/60),cpu:[],gpu:[]}).reliable, true);
  assert.equal(percentile([NaN, -1, Infinity], .95), null);
});
test('preview honours quality and density, caps allocation, and never silently halves native pixels', () => {
  assert.deepEqual(previewSize(1280,720,1,1), {width:1280,height:720});
  assert.deepEqual(previewSize(1280,720,2,.5), {width:1280,height:720});
  const high = previewSize(8000,4000,2,1.5); assert.ok(high.width*high.height <= 4200000);
});
for (const count of [1,4,9,16]) test(`mosaic ${count}: complete, non-overlapping local viewports`, () => {
  const tiles = tileRects(1511,853,count); assert.equal(tiles.reduce((s,t)=>s+t.width*t.height,0),1511*853);
  for (let i=0;i<tiles.length;i++) for(let j=i+1;j<tiles.length;j++) {
    const a=tiles[i],b=tiles[j]; assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
  }
});
function fixture({ timer=true, fail=false }={}) {
  let serial=0; const deleted={shaders:0,programs:0,queries:0,contexts:0}; const sources=[]; const origins=[];
  const gl={ VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,DEPTH_TEST:5,BLEND:6,SCISSOR_TEST:7,TRIANGLES:8,QUERY_RESULT_AVAILABLE:9,QUERY_RESULT:10,
    getExtension: n=>n==='EXT_disjoint_timer_query_webgl2'?(timer?{TIME_ELAPSED_EXT:11,GPU_DISJOINT_EXT:12}:null):{loseContext:()=>deleted.contexts++},
    disable(){},enable(){}, createShader:type=>({type,id:serial++}),shaderSource(s,source){sources.push(source);},compileShader(){}, getShaderParameter:s=>!(fail&&s.type===2),getShaderInfoLog:()=> 'intentional test failure',deleteShader(){deleted.shaders++;},
    createProgram:()=>({id:serial++}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,deleteProgram(){deleted.programs++;},getUniformLocation:(p,name)=>name,
    isContextLost:()=>false,viewport(){},scissor(){},useProgram(){},uniform3fv(){},uniform2f(k,x,y){if(k==='uTileOrigin')origins.push([x,y]);},uniform1f(){},uniform4fv(){},uniform4f(){},drawArrays(){},
    createQuery:()=>({id:serial++}),beginQuery(){},endQuery(){},getParameter:()=>false,getQueryParameter:(q,k)=>k===9?true:2300000,deleteQuery(){deleted.queries++;},
  };
  const canvas={width:0,height:0,getContext:()=>gl}; const renderer=new LabRenderer(canvas);
  const frame={scenes:LAB_SCENES.slice(0,4),width:1280,height:720,time:6,speed:1,palette:0,intensity:1,pointer:[.5,.5,0,0],tag:'run:0'};
  return {renderer,canvas,gl,frame,deleted,sources,origins};
}
test('renderer reuses programs, offsets each tile, tags asynchronous GPU samples and frees everything', () => {
  const f=fixture(); f.renderer.draw(f.frame); f.renderer.draw(f.frame);
  assert.equal(f.sources.length,8); assert.equal(f.deleted.shaders,8);
  assert.deepEqual(f.origins.slice(0,4),[[0,360],[640,360],[0,0],[640,0]]);
  assert.ok(f.sources.some(s=>s.includes('(gl_FragCoord.xy - uTileOrigin) / uRes')));
  assert.deepEqual(f.renderer.poll(),[{tag:'run:0',ms:2.3},{tag:'run:0',ms:2.3}]);
  f.renderer.dispose(); assert.equal(f.deleted.programs,4);assert.equal(f.deleted.queries,2);assert.equal(f.deleted.contexts,1);
});
test('missing timer is not reported as zero GPU time; disjoint results are discarded', () => {
  const f=fixture({timer:false});f.renderer.draw(f.frame);assert.deepEqual(f.renderer.poll(),[]);f.renderer.dispose();
  const g=fixture();g.renderer.draw(g.frame);g.gl.getParameter=()=>true;assert.deepEqual(g.renderer.poll(),[]);assert.equal(g.deleted.queries,1);g.renderer.dispose();
});
test('a compilation failure frees partial resources and remains a visible error', () => {
  const f=fixture({fail:true}); const previous=console.error;console.error=()=>{};
  try {assert.throws(()=>f.renderer.draw(f.frame),/Ошибка компиляции/);assert.equal(f.deleted.shaders,2);}finally{console.error=previous;f.renderer.dispose();}
});
