import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const input=await readFile(new URL('./audio.ts',import.meta.url),'utf8');
const code=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {wordAudioPath}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('English records with the same spelling use their own pronunciation assets',()=>{
 const first='/audio/dictionary/en-flash/'+'a'.repeat(64)+'.mp3';
 const second='/audio/dictionary/en-flash/'+'b'.repeat(64)+'.mp3';
 assert.equal(wordAudioPath('record (noun)','EN',first),first);
 assert.equal(wordAudioPath('record (verb)','EN',second),second);
});
test('existing Latvian and English paths and reserved Windows slugs remain supported',()=>{
 assert.equal(wordAudioPath('mācīties','LV'),'/audio/synthesis/lv/audio/maaciities.mp3');
 assert.equal(wordAudioPath('hello (interjection)','en'),'/audio/synthesis/en/audio/hello.mp3');
 assert.equal(wordAudioPath('con','EN'),'/audio/synthesis/en/audio/con_.mp3');
 assert.equal(wordAudioPath('hello','de'),null);
});
test('untrusted or unrelated audio URLs cannot replace a record asset',()=>{
 for(const url of ['https://example.test/clip.mp3','javascript:alert(1)','/audio/dictionary/en-flash/../x.mp3']){
  assert.equal(wordAudioPath('hello','EN',url),'/audio/synthesis/en/audio/hello.mp3');
 }
});
test('both automatic and manual trainer playback pass the actual record audio URL',async()=>{
 const modal=await readFile(new URL('./TrainingModal.tsx',import.meta.url),'utf8');
 const trainer=await readFile(new URL('./ExamenTrainer.tsx',import.meta.url),'utf8');
 assert.match(modal,/playWordAudio\(word\.word, props\.learnLang, word\.sound_url\)/);
 assert.equal(trainer.match(/playWordAudio\(current\.word\.word, resolveLearnLang\(current\.word\), current\.word\.sound_url\)/g)?.length,2);
});
