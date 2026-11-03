import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const dataUrl = source => 'data:text/javascript;base64,'+Buffer.from(compile(source)).toString('base64');
const { createFountainFrameBudget } = await import(dataUrl(await readFile(new URL('./frameBudget.ts', import.meta.url),'utf8')));

test('high-refresh displays do not multiply fluid updates or slow down time', () => {
  for (const hz of [60,120,144,240]) {
    const gate = createFountainFrameBudget();
    let frames=0, time=0;
    for(let i=0;i<hz*4;i++) {
      const dt=gate.take(i*1000/hz,1/hz);
      if(dt!==null) { frames++; time+=dt; }
    }
    assert.ok(frames<=125 && frames>=110,`${hz} Hz: ${frames} renders`);
    assert.ok(Math.abs(time-4)<.05,`${hz} Hz: ${time} simulated seconds`);
  }
});

test('hidden tabs and long frames do not accumulate runaway catch-up work', () => {
  const gate=createFountainFrameBudget();
  gate.take(0,1/60);
  assert.equal(gate.take(5000,5,true),null);
  assert.equal(gate.take(5100,1/60),1/60);
  assert.equal(gate.take(6000,10),1/15);
  assert.equal(gate.take(6100,0),0);
});

test('group 1765 keeps one original full-page fountain and no card copy', async () => {
  const catalog=dataUrl(await readFile(new URL('../scenes/cinematic/catalog.ts',import.meta.url),'utf8'));
  const source=(await readFile(new URL('../groupEffects.config.ts',import.meta.url),'utf8'))
    .replace(/(['"])\.\/scenes\/cinematic\/catalog\1/,JSON.stringify(catalog));
  const {getGroupEffect}=await import(dataUrl(source));
  const effect=getGroupEffect({categoryId:1765,title:null});
  assert.equal(effect.sceneId,'fountain-yard');
  assert.equal(effect.bodyEffect.scene,effect.sceneId);
  assert.ok(!effect.alsoInCard);
});

test('original fluid stays finite with capped frame timing and pointer waves', async () => {
  const {createFountainSim}=await import(dataUrl(await readFile(new URL('./sim.ts',import.meta.url),'utf8')));
  let seed=42;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const sim=createFountainSim({count:20000,rate:2000,ringShare:.3,jetSpeed:7,jetSpread:.05,windX:0,windZ:0,rand});
  const gate=createFountainFrameBudget();
  for(let i=0;i<144*3;i++) {
    const dt=gate.take(i*1000/144,1/144);
    if(dt) sim.step(dt);
    if(i===144) sim.poke(2,1,-.03,.2);
  }
  assert.equal(sim.N,20000);
  for(const array of [sim.px,sim.py,sim.pz,sim.vx,sim.vy,sim.vz,sim.waves]) assert.ok([...array].every(Number.isFinite));
  assert.ok(sim.emitted>0);
});
