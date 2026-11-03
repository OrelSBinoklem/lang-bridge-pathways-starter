import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('./browserSpeech.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {BrowserSpeechCapture,browserSpeechLanguage}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
function fixture(t,extra={}){
 const texts=[],drafts=[],states=[],errors=[];let native;
 class Recognition{
  starts=0;stops=0;aborts=0;
  constructor(){native=this;}
  start(){this.starts++;}
  stop(){this.stops++;}
  abort(){this.aborts++;}
 }
 const capture=new BrowserSpeechCapture({language:'lv',Constructor:Recognition,onText:text=>texts.push(text),onDraft:text=>drafts.push(text),onState:state=>states.push(state),onError:error=>errors.push(error),...extra});
 t.after(()=>capture.cancel());capture.start();
 const result=(...items)=>native.onresult?.({resultIndex:0,results:items.map(([text,isFinal])=>({isFinal,0:{transcript:text}}))});
 return {capture,get native(){return native;},texts,drafts,states,errors,result};
}

test('interim text is visible but only final results are sent once after release and native end',t=>{
 const f=fixture(t);f.native.onstart();
 assert.equal(f.native.lang,'lv-LV');assert.equal(f.native.continuous,true);assert.equal(f.native.interimResults,true);
 f.result(['Lab',false]);assert.deepEqual(f.texts,[]);assert.deepEqual(f.drafts,['Lab']);
 f.result(['Labdien!',true],['Mani',false]);f.result(['Labdien!',true],['Mani sauc Anna.',true]);
 f.capture.stop();assert.equal(f.native.stops,1);assert.deepEqual(f.texts,[]);
 const lateEnd=f.native.onend;lateEnd();lateEnd();
 assert.deepEqual(f.texts,['Labdien! Mani sauc Anna.']);assert.equal(f.states.at(-1),'idle');assert.deepEqual(f.errors,[]);
});

test('a browser pause does not send speech before the user releases the button',t=>{
 const f=fixture(t);f.native.onstart();f.result(['Jā.',true],['Jā.',true]);f.native.onend();
 assert.deepEqual(f.texts,[]);f.capture.stop();
 assert.deepEqual(f.texts,['Jā. Jā.']);assert.equal(f.native.stops,0);
});

test('release before permission resolves stops immediately on start',t=>{
 const f=fixture(t);f.capture.stop();assert.equal(f.native.stops,0);
 f.native.onstart();assert.equal(f.native.stops,1);f.result(['Labdien!',true]);f.native.onend();
 assert.deepEqual(f.texts,['Labdien!']);assert.equal(f.states.at(-1),'idle');
});

test('cancellation drops already captured text and late native callbacks',t=>{
 const f=fixture(t);f.native.onstart();f.result(['Private old conversation',true]);
 const lateResult=f.native.onresult,lateEnd=f.native.onend;
 f.capture.cancel();lateResult({resultIndex:0,results:[{isFinal:true,0:{transcript:'late'}}]});lateEnd();f.capture.stop();
 assert.deepEqual(f.texts,[]);assert.equal(f.native.aborts,1);assert.deepEqual(f.errors,[]);assert.equal(f.states.at(-1),'idle');
});

test('permission, language and service failures stop without sending partial text or retrying',t=>{
 for(const code of ['not-allowed','network','language-not-supported','service-not-allowed']){
  const f=fixture(t);f.native.onstart();f.result(['Partial',true]);f.native.onerror({error:code});f.capture.stop();
  assert.equal(f.native.starts,1);assert.equal(f.native.aborts,1);assert.equal(f.errors.length,1);assert.deepEqual(f.texts,[]);assert.equal(f.states.at(-1),'idle');
 }
});

test('unconfirmed interim speech is not submitted',t=>{
 const f=fixture(t);f.native.onstart();f.result(['Maybe',false]);f.capture.stop();f.native.onend();
 assert.deepEqual(f.texts,[]);assert.equal(f.errors[0],'Речь не распознана. Попробуйте ещё раз.');
});

test('missing end and start events cannot leave capture stuck',async t=>{
 const f=fixture(t,{finishTimeoutMs:5});f.native.onstart();f.capture.stop();
 await new Promise(resolve=>setTimeout(resolve,20));assert.equal(f.states.at(-1),'idle');assert.equal(f.errors.length,1);assert.deepEqual(f.texts,[]);
 const pending=fixture(t,{startTimeoutMs:5});await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(pending.states.at(-1),'idle');assert.equal(pending.native.aborts,1);
});

test('unsupported browser fails explicitly and language tags are selected manually',()=>{
 const errors=[];const capture=new BrowserSpeechCapture({language:'ru',onText:()=>assert.fail('must not send'),onDraft(){},onState(){},onError:error=>errors.push(error)});
 capture.start();assert.equal(errors.length,1);assert.match(errors[0],/не поддерживает/);
 assert.equal(browserSpeechLanguage('ru'),'ru-RU');assert.equal(browserSpeechLanguage('uk'),'uk-UA');assert.equal(browserSpeechLanguage('en'),'en-US');assert.equal(browserSpeechLanguage(''),'lv-LV');
});
