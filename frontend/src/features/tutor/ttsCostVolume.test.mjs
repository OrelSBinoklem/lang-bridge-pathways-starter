import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('./ttsCostVolume.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {estimateTtsVolume}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('ten minutes at 150 words/minute estimates text and model-specific audio separately',()=>{
  assert.deepEqual(estimateTtsVolume(150,10,'gemini-3.8-flash-tts'),{words:1500,minutes:10,ttsInputTokens:3000,ttsAudioTokens:15000});
  const openai=estimateTtsVolume(150,10,'gpt-4o-mini-tts');
  assert.equal(openai.ttsAudioTokens,12000);
  assert.equal(openai.ttsInputTokens,3000);
});

test('speed changes text volume without changing the duration of audio',()=>{
  const slow=estimateTtsVolume(100,10,'gemini-3.8-flash-tts');
  const fast=estimateTtsVolume(200,10,'gemini-3.8-flash-tts');
  assert.equal(fast.ttsInputTokens,slow.ttsInputTokens*2);
  assert.equal(fast.ttsAudioTokens,slow.ttsAudioTokens);
});

test('fractional minutes scale both billable components',()=>{
  const volume=estimateTtsVolume(150,2.5,'gemini-3.8-flash-tts');
  const cost=(volume.ttsInputTokens*.5+volume.ttsAudioTokens*9)/1e6;
  assert.equal(volume.words,375);
  assert.equal(cost,.034125);
});

test('zero or invalid speech produces no chargeable volume; hourly duration is bounded',()=>{
  for(const [speed,minutes] of [[0,10],[150,0],[-1,10],[NaN,10],[150,-1],[150,Infinity]]){
    const volume=estimateTtsVolume(speed,minutes,'gemini-3.8-flash-tts');
    assert.equal(volume.ttsInputTokens,0);
    assert.equal(volume.ttsAudioTokens,0);
  }
  assert.equal(estimateTtsVolume(150,90,'gemini-3.8-flash-tts').minutes,60);
});
