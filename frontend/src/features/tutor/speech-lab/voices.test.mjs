import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('./voices.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {languageVoices,selectedVoice,voiceId,speechLanguages,voiceSnapshot}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('language selection cannot silently replace a missing Latvian/Ukrainian voice with Russian',()=>{
 const voices=[{id:'ru',name:'Google русский',lang:'ru-RU',google:true},{id:'lv',name:'Latvian local',lang:'lv_LV',google:false}];
 assert.equal(selectedVoice(languageVoices(voices,'lv')).id,'lv');
 assert.deepEqual(languageVoices(voices,'uk'),[]);assert.equal(selectedVoice(languageVoices(voices,'uk')),undefined);
 assert.deepEqual(speechLanguages.map(language=>language.tag),['ru-RU','uk-UA','lv-LV']);
});
test('Google named voice is preferred, but an explicit same-language selection is respected',()=>{
 const voices=[{id:'local',name:'Local',lang:'ru-RU',google:false,preferred:true},{id:'google',name:'Google',lang:'ru-RU',google:true}];
 assert.equal(selectedVoice(voices).id,'google');assert.equal(selectedVoice(voices,'local').id,'local');
 assert.equal(selectedVoice(voices,'removed').id,'google');
 assert.notEqual(voiceId({voiceURI:'same',name:'A',lang:'ru-RU',localService:true}),voiceId({voiceURI:'same',name:'A',lang:'uk-UA',localService:true}));
});
test('voice inventory is stable across native reordering and preserves language/provider labels',()=>{
 const old=globalThis.window;let voices=[{voiceURI:'a',name:'Google русский',lang:'ru-RU',localService:false,default:true},{voiceURI:'b',name:'Latvian',lang:'lv-LV',localService:true,default:false}];
 try{
  globalThis.window={speechSynthesis:{getVoices:()=>voices}};
  const first=voiceSnapshot();voices=voices.toReversed();assert.equal(voiceSnapshot(),first);
  assert.equal(JSON.parse(first).find(voice=>voice.name==='Google русский').google,true);
  assert.equal(JSON.parse(first).find(voice=>voice.lang==='lv-LV').local,true);
 }finally{globalThis.window=old;}
});
