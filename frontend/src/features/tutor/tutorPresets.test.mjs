import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const directory = path.dirname(fileURLToPath(import.meta.url)), cache = new Map();
function load(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const require = createRequire(filename);
  const source = ts.transpileModule(readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText;
  new Function('require','module','exports',source)(name => name.startsWith('.') && existsSync(path.resolve(path.dirname(filename),`${name}.ts`)) ? load(path.resolve(path.dirname(filename),`${name}.ts`)) : require(name),module,module.exports);
  return module.exports;
}
const {normalizePresets,estimatePreset,presetCommissionPercent,PRESET_IDS} = load(path.join(directory,'tutorPresets.ts'));
const defaults = JSON.parse(readFileSync(path.join(directory,'../../config/tutor-presets.json'),'utf8'));
const data = () => normalizePresets({commission_percent:50,presets:Object.fromEntries(PRESET_IDS.map(id=>[id,{config:defaults[id],scenario:{},loadedScenario:{}}]))});

test('all presets start with the requested standard scenario and saved edits remain configurable', () => {
  const {presetScenario} = load(path.join(directory, 'tutorPresets.ts'));
  const expected = JSON.parse(readFileSync(path.join(directory, '../../config/tutor-scenario-defaults.json'), 'utf8'));
  for (const id of PRESET_IDS) {
    const scenario = presetScenario(id);
    for (const [key, value] of Object.entries(expected)) assert.equal(scenario[key], value, `${id}: ${key}`);
    assert.equal(presetScenario(id, { dialogueActs: '75' }).dialogueActs, '75');
  }
});

test('maximum remains configured but is hidden and an old selection resolves to quality', () => {
  const {VISIBLE_PRESET_IDS, visiblePreset, isTutorPreset} = load(path.join(directory,'tutorPresets.ts'));
  assert.deepEqual(VISIBLE_PRESET_IDS, ['economy', 'standard', 'quality']);
  assert.equal(isTutorPreset('uncompromising'), true);
  assert.equal(visiblePreset('uncompromising'), 'quality');
  assert.equal(visiblePreset('standard'), 'standard');
});

test('hourly credits include the live margin, preserve summaries, and distinguish two recognizers', () => {
  const d=data(), prices=Object.fromEntries(PRESET_IDS.map(id=>[id,estimatePreset(d.presets[id],50,Date.UTC(2026,9,25),id)]));
  for (const id of PRESET_IDS) { assert(prices[id].credits > 0); assert.equal(prices[id].credits,prices[id].api/(id==='economy'?.75:.5)); assert(prices[id].memory.summary > 0); }
  for (const id of PRESET_IDS) { assert.equal(d.presets[id].config.messageEmbeddingModel, 'text-embedding-3-large'); assert.equal(d.presets[id].config.summaryEmbeddingModel, 'text-embedding-3-large'); }
  assert.equal(prices.economy.recognition,12*.0045); assert.equal(prices.economy.recognition,prices.standard.recognition); assert(prices.economy.tts>0);
  assert.equal(prices.economy.commissionPercent,25); assert.equal(prices.standard.commissionPercent,50);
  assert.equal(d.presets.economy.config.ttsMode,'api'); assert.equal(d.presets.economy.config.ttsModel,'gemini-3.8-flash-lite-tts');
  for(const id of ['economy','standard']) assert.equal(d.presets[id].config.tutorModel,'gpt-6-luna');
  assert(prices.economy.tts < prices.standard.tts);
  assert.equal(d.presets.quality.config.tutorModel, 'gpt-6.1-terra');
  assert.equal(d.presets.uncompromising.config.tutorModel, 'gpt-6-sol');
  assert(prices.quality.credits < prices.uncompromising.credits);
  assert.equal(prices.standard.recognition,12*.0045); assert.equal(prices.uncompromising.recognition,12*(.0045+.006));
  assert(prices.economy.credits<prices.standard.credits); assert(prices.standard.credits<prices.uncompromising.credits);
  assert.equal(estimatePreset(d.presets.standard,0).credits, estimatePreset(d.presets.standard,0).api);
  assert.equal(estimatePreset(d.presets.standard,100).credits,null);
  console.log('Default scenario credits/hour',Object.fromEntries(PRESET_IDS.map(id=>[id,prices[id].credits])));
});

test('GPT-6 Luna pricing and reasoning are available to estimates and admin settings', () => {
  const {TUTOR_PRICE_USD,TUTOR_MODEL_OPTIONS}=load(path.join(directory,'tutor-config.ts'));
  assert(TUTOR_MODEL_OPTIONS.tutor.includes('gpt-6-luna'));
  assert.deepEqual(TUTOR_PRICE_USD.textPerMillionTokens['gpt-6-luna'],{input:.1,cachedInput:.01,cacheWrite:.125,output:.5});
  const {complexQuestionEffort,tutorReasoningEfforts}=load(path.join(directory,'voiceTurn.ts'));
  assert(tutorReasoningEfforts('gpt-6-luna').includes('none'));assert.equal(complexQuestionEffort('gpt-6-luna'),'high');
});
test('long memory adds query/index/retrieved-input cost without disabling summaries or notes', () => {
  const def=data().presets.standard;
  const enabled=estimatePreset(def,50), disabled=estimatePreset({...def,config:{...def.config,longMemoryEnabled:false}},50);
  assert(enabled.credits>disabled.credits); assert(enabled.queryCost>0); assert.equal(disabled.queryCost,0);
  assert.equal(disabled.memory.messageEmbeddings,0); assert(disabled.memory.summary>0);
});
test('admin-saved scenarios stay isolated; promotional date affects API speech only', () => {
  const d=data();d.presets.standard.scenario.dialogueActs='75';
  assert.equal(d.presets.economy.scenario.dialogueActs,'120');
  assert.equal(d.presets.economy.scenario.cacheHitPercent,'90');
  const before=estimatePreset(d.presets.standard,50,Date.UTC(2027,0,1)-1),after=estimatePreset(d.presets.standard,50,Date.UTC(2027,0,1));
  assert.equal(after.tts,before.tts*2);assert.equal(after.recognition,before.recognition);
  const economyBefore=estimatePreset(d.presets.economy,50,Date.UTC(2027,0,1)-1,'economy');
  assert.equal(estimatePreset(d.presets.economy,50,Date.UTC(2027,0,1),'economy').tts,economyBefore.tts*2);
});

test('economy halves the live commission with basis point precision, not the total bill', () => {
  for(const base of [0,12,50,50.01,99]) {
    assert.equal(presetCommissionPercent('economy',base),Math.floor((Math.round(base*100)+1)/2)/100);
    assert.equal(presetCommissionPercent('standard',base),base);
  }
  const def=data().presets.economy, discounted=estimatePreset(def,50,undefined,'economy'), ordinary=estimatePreset(def,50,undefined,'standard');
  assert.equal(discounted.api,ordinary.api); assert(Math.abs(discounted.credits/ordinary.credits - 2/3) < 1e-12);
  assert.equal(estimatePreset(def,0,undefined,'economy').credits,discounted.api);
});

test('maximum GPT-6 Sol has no hidden reasoning cost unless complex mode is chosen', () => {
  const def=data().presets.uncompromising;
  assert.equal(def.config.tutorModel,'gpt-6-sol');assert.equal(def.config.reasoningEnabled,false);assert.equal(def.config.reasoningEffort,'none');
  const ordinary=estimatePreset(def,50),complex=estimatePreset({...def,config:{...def.config,reasoningEnabled:true,reasoningEffort:'high'}},50);
  assert(ordinary.credits>0);assert(complex.credits>ordinary.credits);
  const {TUTOR_PRICE_USD,TUTOR_MODEL_OPTIONS}=load(path.join(directory,'tutor-config.ts'));
  assert(TUTOR_MODEL_OPTIONS.tutor.includes('gpt-6-sol'));
  assert.deepEqual(TUTOR_PRICE_USD.textPerMillionTokens['gpt-6-sol'],{input:2,cachedInput:.2,cacheWrite:2.5,output:10});
  assert(TUTOR_MODEL_OPTIONS.tutor.includes('gpt-6.1-terra'));
  assert.deepEqual(TUTOR_PRICE_USD.textPerMillionTokens['gpt-6.1-terra'],{input:1,cachedInput:.05,cacheWrite:1.25,output:5});
  const {complexQuestionEffort,tutorReasoningEfforts}=load(path.join(directory,'voiceTurn.ts'));
  assert.deepEqual(tutorReasoningEfforts('gpt-6.1-terra'),['none','low','medium','high','xhigh','max']);assert.equal(complexQuestionEffort('gpt-6.1-terra'),'high');
});

test('device speech uses only matching languages, never substitutes a paid or wrong-language voice', () => {
  const {browserSpeechParts,browserVoiceLanguages,speakBrowserText}=load(path.join(directory,'browserTts.ts'));
  const oldWindow=globalThis.window,oldUtterance=globalThis.SpeechSynthesisUtterance;
  const spoken=[];let cancelled=0;
  globalThis.window={speechSynthesis:{getVoices:()=>[{lang:'ru-RU',name:'Fixture'}],speak:u=>spoken.push(u),cancel:()=>cancelled++}};
  globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  try{
    assert.equal(browserVoiceLanguages(),'ru');
    assert.deepEqual(browserSpeechParts('Привет! Labdien!').map(p=>p.lang),['ru','lv']);
    const result=speakBrowserText('Привет! Labdien!');
    assert.deepEqual(result.missing,['lv']);assert.equal(spoken.length,1);assert.equal(spoken[0].lang,'ru-RU');
    result.cancel();assert.equal(cancelled,1);assert.equal(spoken[0].onerror,null);
    spoken.length=0;const missing=speakBrowserText('Labdien!');assert.equal(spoken.length,0);assert.deepEqual(missing.missing,['lv']);
    missing.cancel();assert.equal(cancelled,1);
  }finally{globalThis.window=oldWindow;globalThis.SpeechSynthesisUtterance=oldUtterance;}
});
