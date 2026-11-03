import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('./dialogueCost.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {estimateDialogueCost,priceDialogueMemory}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const input={dialogueActs:3,callsPerAct:1,fixedContextTokens:2000,initialHistoryTokens:100,userTokensPerAct:100,outputTokensPerCall:200,reasoningTokensPerCall:50,toolTokensPerCall:300,cacheHitPercent:100,historyTokenLimit:0};
const rate={input:2,cachedInput:.2,output:10};

test('replays growing context on every call, with a cold first request and no double-counted reasoning',()=>{
  const result=estimateDialogueCost(input,'gpt-5.4',rate);
  assert.deepEqual(result.requests.map(r=>r.input),[2200,2500,2800]);
  assert.deepEqual(result.requests.map(r=>r.cached),[0,2176,2432]);
  assert.equal(result.inputTokens,7500);
  assert.equal(result.uncachedTokens,2892);
  assert.equal(result.cachedTokens,4608);
  assert.equal(result.visibleOutputTokens,600);
  assert.equal(result.reasoningTokens,150);
  assert.equal(result.outputTokens,750);
  assert.equal(result.cost,.0142056);
  assert.equal(result.noCacheCost,.0225);
  const noReasoning=estimateDialogueCost({...input,reasoningTokensPerCall:0},'gpt-5.4',rate);
  assert.equal(noReasoning.inputTokens,result.inputTokens);
  assert.ok(Math.abs(result.cost-noReasoning.cost-.0015)<1e-12);
});

test('paid cache writes replace ordinary input pricing rather than adding a second input charge',()=>{
  const result=estimateDialogueCost(input,'gpt-6-luna',rate);
  assert.deepEqual(result.requests.map(r=>r.cached),[0,2200,2500]);
  assert.deepEqual(result.requests.map(r=>r.writes),[2200,300,300]);
  assert.equal(result.uncachedTokens,0);
  assert.equal(result.cachedTokens,4700);
  assert.equal(result.cacheWriteTokens,2800);
  assert.equal(result.cost,.01544);
  assert.equal(result.inputTokens,result.uncachedTokens+result.cachedTokens+result.cacheWriteTokens);
  const explicit=estimateDialogueCost(input,'gpt-5.6-sol',{...rate,cacheWrite:3});
  assert.equal(explicit.writeRate,3);
});

test('extra calls charge tool loops, but the user message is only added once per act',()=>{
  const result=estimateDialogueCost({...input,dialogueActs:2,callsPerAct:2},'gpt-5.4',rate);
  assert.deepEqual(result.requests.map(r=>r.input),[2200,2700,3000,3500]);
  assert.equal(result.calls,4);
  const fractional=estimateDialogueCost({...input,dialogueActs:30,callsPerAct:1.5},'gpt-5.4',rate);
  assert.equal(fractional.calls,45);
});

test('rolling history invalidates its cached prefix, retaining only fixed instructions',()=>{
  const result=estimateDialogueCost({...input,historyTokenLimit:300},'gpt-5.4',rate);
  assert.deepEqual(result.requests.map(r=>r.input),[2200,2400,2400]);
  assert.deepEqual(result.requests.map(r=>r.cached),[0,1920,1920]);
  assert.equal(result.historyTrims,2);
  const largeMessage=estimateDialogueCost({...input,dialogueActs:1,historyTokenLimit:10,userTokensPerAct:5000},'gpt-5.4',rate);
  assert.equal(largeMessage.firstInputTokens,7010);
});

test('cache misses, short prefixes and empty hours do not invent cached reads',()=>{
  const miss=estimateDialogueCost({...input,cacheHitPercent:0},'gpt-5.4',rate);
  assert.equal(miss.cachedTokens,0);
  assert.equal(miss.uncachedTokens,miss.inputTokens);
  assert.equal(miss.cost,miss.noCacheCost);
  const short=estimateDialogueCost({...input,fixedContextTokens:0,initialHistoryTokens:0},'gpt-6-luna',rate);
  assert.equal(short.cachedTokens,0);assert.equal(short.cacheWriteTokens,0);
  const empty=estimateDialogueCost({...input,dialogueActs:0},'gpt-5.4',rate);
  assert.equal(empty.calls,0);assert.equal(empty.cost,0);assert.equal(empty.inputTokens,0);
});

test('long-context requests are not priced silently at short-context rates',()=>{
  const result=estimateDialogueCost({...input,dialogueActs:1,fixedContextTokens:300000},'gpt-5.4',rate);
  assert.equal(result.longContext,true);assert.equal(result.cost,null);
  assert.equal(estimateDialogueCost(input,'unknown').cost,null);
});

const memory={enabled:true,retainedHistoryActs:1,summaryBatchActs:1,summaryTokensPerRun:10,summaryReasoningTokensPerRun:0};

test('compression follows the same acts, carries the summary into subsequent LLM calls and invalidates history cache',()=>{
  const result=estimateDialogueCost({...input,initialHistoryTokens:0},'gpt-5.4',rate,memory);
  assert.deepEqual(result.requests.map(r=>r.input),[2100,2400,2410]);
  assert.equal(result.requests[2].cached,1920);
  assert.equal(result.memory.compressionCalls,1);
  assert.deepEqual(result.memory.compressions,[{beforeAct:3,sourceTokens:300,inputTokens:500,outputTokens:10,reasoningTokens:0}]);
  const longer=estimateDialogueCost({...input,dialogueActs:4,initialHistoryTokens:0},'gpt-5.4',rate,memory);
  assert.equal(longer.memory.compressionCalls,2);
  assert.equal(longer.memory.summaryInputTokens,1010); // second request includes the previous 10-token summary
  assert.equal(longer.memory.summaryOutputTokens,20);
});

test('message indexing counts new user/final replies once, excluding old history, tools and reasoning',()=>{
  const simple=estimateDialogueCost(input,'gpt-5.4',rate,memory);
  const tools=estimateDialogueCost({...input,initialHistoryTokens:5000,callsPerAct:3,reasoningTokensPerCall:1000},'gpt-5.4',rate,memory);
  assert.equal(simple.memory.messageEmbeddingTokens,900);
  assert.equal(tools.memory.messageEmbeddingTokens,900);
  assert.equal(tools.visibleOutputTokens,1800);
});

test('summary cost and message index are included exactly once in combined LLM/memory cost',()=>{
  const dialogue=estimateDialogueCost({...input,initialHistoryTokens:0},'gpt-5.4',rate,{...memory,summaryReasoningTokensPerRun:50});
  const priced=priceDialogueMemory(dialogue,'gpt-5.4-mini',{input:1,cachedInput:.1,output:2},.13);
  assert.equal(priced.messageEmbeddings,.000117);
  assert.equal(priced.summary,.00062);
  assert.ok(Math.abs(priced.brainTotal-dialogue.cost-.000737)<1e-12);
});

test('disabled or unneeded compression costs zero, even without a summary tariff',()=>{
  const disabled=estimateDialogueCost(input,'gpt-5.4',rate,{...memory,enabled:false});
  assert.equal(disabled.memory.compressionCalls,0);
  assert.equal(priceDialogueMemory(disabled,'unknown',undefined,.13).summary,0);
  const short=estimateDialogueCost({...input,dialogueActs:1,initialHistoryTokens:0},'gpt-5.4',rate,memory);
  assert.equal(short.memory.compressionCalls,0);
  const empty=estimateDialogueCost({...input,dialogueActs:0},'gpt-5.4',rate,memory);
  assert.equal(priceDialogueMemory(empty,'unknown').brainTotal,0);
});
