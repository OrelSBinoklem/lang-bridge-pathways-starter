import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const code = ts.transpileModule(await readFile(new URL('./fireflySignals.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createFireflySignals } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const tick = (s, flies, n, fps = 60) => { for(let i=0;i<n;i++) s.update(1/fps, flies, 100); };
test('a nearby flash travels with delay, a far neighbour does not receive it', () => {
  const s = createFireflySignals(3, () => .9), flies = [{x:0,y:0,z:0},{x:80,y:0,z:0},{x:210,y:0,z:0}];
  s.trigger(0); tick(s, flies, 5);
  assert.ok(s.flash[0] > .5); assert.equal(s.flash[1],0);
  tick(s, flies, 47); assert.equal(s.bursts[1],1); assert.equal(s.flash[2],0);
});
test('depth and exact radius matter even inside the same neighbouring grid cells', () => {
  const flies = [{x:0,y:0,z:0},{x:101,y:0,z:0},{x:0,y:0,z:1}];
  const s = createFireflySignals(3, () => .9); s.trigger(0); tick(s,flies,50);
  assert.equal(s.flash[1],0); assert.equal(s.flash[2],0);
});
test('chains propagate one hop at a time and cannot immediately flash back', () => {
  const flies = [0,80,160].map(x => ({x,y:0,z:0})); const s = createFireflySignals(3,()=>.9);
  s.trigger(0); tick(s,flies,55); assert.equal(s.flash[2],0);
  tick(s,flies,45); assert.equal(s.bursts[2],1); assert.equal(s.bursts[0],1);
  tick(s,flies,60); assert.equal(s.flash[0],0); assert.equal(s.bursts[0],1);
});

test('idle insects never start a global wave; a pulse fades after six neighbour relays', () => {
  const flies = Array.from({length:9},(_,i)=>({x:i*80,y:0,z:0}));
  const s=createFireflySignals(flies.length,()=>.1); tick(s,flies,1800);
  assert.ok(s.bursts.every(value=>value===0));
  s.trigger(0);tick(s,flies,600);
  assert.deepEqual([...s.bursts],[1,1,1,1,1,1,1,0,0]);
});
test('a receiver leaving the radius before delivery does not flash', () => {
  const flies=[{x:0,y:0,z:0},{x:80,y:0,z:0}];
  const s=createFireflySignals(2,()=>.5);s.trigger(0);tick(s,flies,10);
  flies[1].x=180;tick(s,flies,120);assert.equal(s.bursts[1],0);
});
test('fixed-step signals agree at 30, 60 and 120 fps', () => {
  const flies = [0,70,140].map(x=>({x,y:0,z:.5}));
  const result = [30,60,120].map(fps=>{const s=createFireflySignals(3,()=>.9);s.trigger(0);tick(s,flies,fps,fps);return [...s.flash];});
  assert.deepEqual(result[0],result[1]); assert.deepEqual(result[0],result[2]);
});
