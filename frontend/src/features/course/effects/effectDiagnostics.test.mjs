import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('./effectDiagnostics.ts',import.meta.url),'utf8');
const loaded={exports:{}},calls=[];
const reading={cpu:2,gpu:null,fps:45,load:12};
new Function('require','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(()=>({
  installGlTracking(){},trackGlContext(){},createFrameMeter:()=>({begin(){calls.push('begin');},end(){calls.push('end');},read:()=>reading}),
}),loaded.exports);
const {startEffectDiagnostics,readEffectDiagnostics,recordEffectFrame,profileEffectFrame,effectDiagnosticsEnabled}=loaded.exports;
globalThis.HTMLCanvasElement=class {};
test('ordinary users incur no per-frame metering; admins see actual render callback timings',()=>{
  const canvas={isConnected:true};let frames=0;
  const frame=profileEffectFrame(canvas,()=>frames++);
  frame(1);assert.equal(frames,1);assert.deepEqual(calls,[]);assert.equal(readEffectDiagnostics(),null);
  const stop=startEffectDiagnostics();assert(effectDiagnosticsEnabled());frame(2);
  assert.deepEqual(calls,['begin','end']);assert.equal(readEffectDiagnostics().cpu,2);
  stop();assert(!effectDiagnosticsEnabled());assert.equal(readEffectDiagnostics(),null);
});
test('multiple fullscreen regions aggregate CPU, not invented GPU values; detached canvases are removed',()=>{
  const stop=startEffectDiagnostics(),a={isConnected:true},b={isConnected:true};
  recordEffectFrame(a,reading);recordEffectFrame(b,{...reading,cpu:3,fps:30,gpu:4});
  assert.deepEqual(readEffectDiagnostics(),{cpu:5,gpu:null,fps:30,load:30});
  a.isConnected=false;assert.equal(readEffectDiagnostics().cpu,3);stop();
});
test('frame failures still close the meter and propagate the original error',()=>{
  const stop=startEffectDiagnostics(),canvas={isConnected:true},frame=profileEffectFrame(canvas,()=>{throw Error('render failed');});
  assert.throws(()=>frame(3),/render failed/);assert.equal(calls.at(-1),'end');stop();
});
test('course reuses preview controls without a custom dock, and stays administrator-only',()=>{
  const overlay=readFileSync(new URL('./ThemedGroupOverlay.tsx',import.meta.url),'utf8');
  assert.match(overlay,/useSyncExternalStore\(onCameraAdminChange, isCameraAdmin/);
  assert.match(overlay,/admin && <CourseEffectDebug/);
  assert.match(overlay,/EffectDebugContext.Provider value=\{admin\}/);
  const panel=readFileSync(new URL('./tuning/EffectTuningPanel.tsx',import.meta.url),'utf8');
  assert.match(panel,/allowed === false \? null/);
  const dock=readFileSync(new URL('./CourseEffectDebug.tsx',import.meta.url),'utf8');
  assert.match(dock,/createPortal\(/);assert.match(dock,/document.body/);
  assert.match(dock,/<EffectLoadBadge/);assert.match(dock,/<EffectDebugToggle/);
  assert.doesNotMatch(dock,/<aside|<header|<strong|pi-sliders|borderRadius|boxShadow|useState/);
  assert(!existsSync(new URL('./EffectDebugDock.tsx',import.meta.url)));
  assert(!existsSync(new URL('./effect-debug.module.css',import.meta.url)));
  const preview=readFileSync(new URL('../../../app/course/effects-preview/page.tsx',import.meta.url),'utf8');
  const runner=readFileSync(new URL('./scenes/SceneEffect.tsx',import.meta.url),'utf8');
  assert.match(preview,/<EffectDebugToggle \/>/);assert.match(runner,/<EffectLoadBadge ref=\{ref\} \/>/);
  assert.match(preview,/<EffectDebugToggle settings/);assert.match(dock,/<EffectDebugToggle settings/);
  const shared=readFileSync(new URL('./EffectPreviewControls.tsx',import.meta.url),'utf8');
  assert.match(shared,/onClick=\{toggleWebglGui\}/);
  assert.match(shared,/⋮ Отладка/);
  const globals=readFileSync(new URL('../../../app/globals.css',import.meta.url),'utf8');
  assert.match(globals,/course-effect-focus body > \[data-effect-debug\]/);
});
