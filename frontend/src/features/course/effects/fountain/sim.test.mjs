import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const code=ts.transpileModule(await readFile(new URL('./sim.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createFountainSim,POOL,PIPE,FOUNTAIN:F}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
function make(){let seed=17;return createFountainSim({count:1200,rate:120,ringShare:.3,jetSpeed:6,jetSpread:.05,windX:.2,windZ:0,rand:()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296});}
test('water count remains constant, finite and bounded throughout circulation',()=>{
 const s=make();for(let k=0;k<600;k++)s.step(1/60);
 assert.equal([...s.counts].reduce((a,b)=>a+b),s.N);assert.equal(s.counts[PIPE],s.queued);
 for(let i=0;i<s.N;i++){assert.ok(Number.isFinite(s.px[i]+s.py[i]+s.pz[i]));if(s.state[i]===POOL)assert.ok(Math.hypot(s.px[i],s.pz[i])<F.basinIn+.001);}
 assert.ok(Math.max(...s.waves)<.15);assert.ok(Math.min(...s.waves)>-.15);
});
test('fixed physics agrees at different display frequencies',()=>{
 const snapshots=[30,60,120].map(fps=>{const s=make();for(let i=0;i<fps*2;i++)s.step(1/fps);return [[...s.px],[...s.py],[...s.state],[...s.waves]];});
 assert.deepEqual(snapshots[0],snapshots[1]);assert.deepEqual(snapshots[0],snapshots[2]);
});
test('invalid and paused updates do not emit water',()=>{const s=make();s.step(0);s.step(-1);s.step(NaN);assert.equal(s.emitted,0);});
