import {readFile,writeFile,mkdir,readdir,access,open,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from '../tutor-gateway/node_modules/dotenv/lib/main.js';
import {createGoogleAuth,streamGoogleSpeech} from '../tutor-gateway/src/audio/googleSpeech.mjs';
import {buildPlan,model,sha} from './english-audio-plan.mjs';
import {GoogleJsonClient} from './google-json-client.mjs';
import {inspectNativeWav} from './english-audio-wave.mjs';
import {EnglishAudioBatchEncoder} from './english-audio-encoder.mjs';
import {writeSavedJsonOnce} from './english-audio-files.mjs';
import {removeContextPrefix} from './english-audio-context-cut.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const option=(key,fallback)=>process.argv.find(x=>x.startsWith(`--${key}=`))?.slice(key.length+3)??fallback;
const directory=path.resolve(root,option('directory','.tmp/english-word-audio-20261031'));
if(!directory.startsWith(path.join(root,'.tmp')+path.sep))throw Error('Audio campaigns must stay inside .tmp');
const jobsDir=path.join(directory,'jobs');
const json=v=>JSON.stringify(v,null,2)+'\n';
const exists=async file=>{try{await access(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const limit=Number(option('limit','8')),concurrency=Number(option('concurrency','3'));
if(!Number.isInteger(limit)||limit<1||!Number.isInteger(concurrency)||concurrency<1||concurrency>32)throw Error('Invalid bounded job count/concurrency');
await mkdir(jobsDir,{recursive:true});
const source=JSON.parse(await readFile(path.join(directory,'source.json'),'utf8'));
const planFile=path.join(directory,'reviewed-plan.json');
let plan;
if(await exists(planFile)){
 plan=JSON.parse(await readFile(planFile,'utf8'));
 if(plan.source_sha256!==sha(JSON.stringify(source)))throw Error('Source snapshot changed');
}else{plan=buildPlan(source);await writeFile(planFile,json(plan),{flag:'wx'});}
const only=new Set(option('only','').split('|').filter(Boolean));
const selected=plan.jobs.filter(j=>!only.size||only.has(j.text)).slice(0,limit);
const cashMaximum=plan.budget.tts_effective_usd;
const priorMaximum=plan.budget.prior_effective_maximum_usd??0;
if(!Number.isFinite(cashMaximum)||cashMaximum<=0||!Number.isFinite(priorMaximum)||priorMaximum<0
 ||priorMaximum+cashMaximum+plan.budget.verification_reserve_usd>8)throw Error('Campaign exceeds the shared authorized budget');
const preflight={records:plan.records.length,unique_recordings:plan.jobs.length,selected:selected.length,model,voice:plan.voice,tts_effective_limit_usd:cashMaximum,total_effective_limit_usd:8,regular_spend_tts_limit_usd:cashMaximum*2,post_processing_speed:false,database_writes:false};
await writeFile(path.join(directory,'preflight.json'),json(preflight));
console.log(json(preflight));
if(!process.argv.includes('--generate'))process.exit(0);
if(Date.now()>=Date.parse('2027-01-01T00:00:00Z'))throw Error('Introductory pricing expired; verify rates before further paid generation');
const lockPath=path.join(directory,'run.lock');
const lock=await open(lockPath,'wx');await lock.writeFile(json({pid:process.pid,started_at:new Date().toISOString()}));
let cost=0,reserved=0,done=0,failed=null,cursor=0,active=0;
const client=new GoogleJsonClient();
const encoder=new EnglishAudioBatchEncoder();
const statusFile=path.join(directory,'status.json');
let statusChain=Promise.resolve();
const status=()=>{
 const operation=statusChain.catch(()=>{}).then(async()=>{
 const value={total:plan.jobs.length,completed:done,selected:selected.length,active,effective_tts_usd:Number(cost.toFixed(6)),regular_tts_usd:Number((cost*2).toFixed(6)),reserved_effective_usd:Number(reserved.toFixed(6)),limit_effective_usd:cashMaximum,updated_at:new Date().toISOString(),error:failed?.message??null};
 await writeFile(statusFile+'.tmp',json(value));
 const {rename}=await import('node:fs/promises');
 for(let attempt=0;;attempt++){
  try{await rename(statusFile+'.tmp',statusFile);break;}
  catch(error){
   if(!['EPERM','EBUSY'].includes(error.code)||attempt>=30)throw error;
   // Windows readers and virus scanners can temporarily hold the destination open.
   await new Promise(resolve=>setTimeout(resolve,100));
  }
 }
 });
 statusChain=operation;
 return operation;
};
try{
 const receipts=new Map();
 const uncertaintyFile=path.join(directory,'uncertain-attempts.json');
 if(await exists(uncertaintyFile))cost+=JSON.parse(await readFile(uncertaintyFile,'utf8')).reduce((sum,attempt)=>sum+attempt.reserved_effective_usd,0);
 for(const file of await readdir(jobsDir))if(file.endsWith('.receipt.json')){
  const receipt=JSON.parse(await readFile(path.join(jobsDir,file),'utf8'));
  const target=plan.jobs.find(j=>j.id===receipt.id);
  if(!target){
   // Earlier completed takes remain in the expense ledger even if editorial cleanup superseded them.
   cost+=receipt.effective_cost_usd;continue;
  }
  if(receipt.request_sha256!==sha(JSON.stringify(target.request)))throw Error('Stale receipt '+file);
  if(sha(await readFile(path.join(jobsDir,receipt.id+'.mp3')))!==receipt.bytes_sha256)throw Error('Corrupt cached audio');
  receipts.set(receipt.id,receipt);cost+=receipt.effective_cost_usd;done++;
 }
 const env=dotenv.parse(await readFile(path.join(root,'tools/tutor-gateway/.env')));
 const credentials=process.env.GOOGLE_APPLICATION_CREDENTIALS||env.GOOGLE_APPLICATION_CREDENTIALS||path.join(root,'.tmp/google-tts-service-account.json');
 const auth=createGoogleAuth({env:{GOOGLE_APPLICATION_CREDENTIALS:credentials}});
 const speedPilot=path.join(directory,'stream-speed.result.json');
 if(await exists(speedPilot)){
  const speed=JSON.parse(await readFile(speedPilot,'utf8'));
  cost+=((speed.usage?.inputTokens??8192)+(speed.usage?.outputAudioTokens??16384)*18)/1e6*0.5;
 }
 const pending=selected.filter(j=>!receipts.has(j.id));
 // A recorded but unresolved paid attempt is never sent again automatically.
 const unresolved=[];
 for(const job of [...pending])if(await exists(path.join(jobsDir,job.id+'.request.json'))){
  if(!process.argv.includes('--skip-unresolved'))throw Error('Unresolved request needs review: '+job.text);
  unresolved.push(job.id);
  pending.splice(pending.indexOf(job),1);
  // Hold the provider maximum for every request with an unknown billing outcome.
  cost+=(8192+16384*18)/1e6*0.5;
 }
 await writeFile(path.join(directory,'skipped-unresolved.json'),json({job_ids:unresolved,reserved_effective_usd:unresolved.length*(8192+16384*18)/1e6*0.5}));
 const generate=async job=>{
  // Reserve the entire provider-documented model maximum, not the expected two-second clip.
  // https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-flash-tts
  const reserve=(8192+16384*18)/1e6*0.5;
  while(cost+reserved+reserve>cashMaximum){
   if(failed) return;
   if(active===0) throw Error('Cost limit reached; stopped before another paid request');
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(failed) return;
  reserved+=reserve;active++;
  const stem=path.join(jobsDir,job.id);
  try{
   await auth();
   await writeFile(stem+'.request.json',json({id:job.id,text:job.text,model,voice:job.voice,transport:'streamGenerateContent',request_sha256:sha(JSON.stringify(job.request)),request:job.request,reserved_effective_usd:reserve,created_at:new Date().toISOString()}),{flag:'wx'});
   const chunks=[],events=[];
   let result;
   try{
    result=await streamGoogleSpeech({text:job.request.contents[0].parts[0].text,model,voice:job.voice,instructions:job.request.contents[0].parts[0].speechMetadata.style,
     authenticate:auth,fetchImpl:(url,init)=>client.fetch(url,init,chunk=>events.push(Buffer.from(chunk))),onChunk:chunk=>chunks.push(Buffer.from(chunk.pcm))});
   }finally{await writeFile(stem+'.stream.sse',Buffer.concat(events),{flag:'wx'});}
   const pcm=Buffer.concat(chunks),header=Buffer.alloc(44);
   header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);
   header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);
   header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
   let wav=Buffer.concat([header,pcm]),editorialCut=null;
   const nativeHash=sha(wav);
   const data={transport:'streamGenerateContent',streaming_result:result,usageMetadata:{promptTokenCount:result.usage.inputTokens,candidatesTokenCount:result.usage.outputAudioTokens},candidates:[{finishReason:'STOP'}]};
   await writeFile(stem+'.response.json',JSON.stringify(data),{flag:'wx'});
   if(job.context_prefix){
    await writeFile(stem+'.native.wav',wav,{flag:'wx'});
    try{const trimmed=removeContextPrefix(wav);wav=trimmed.wav;editorialCut=trimmed.cut;}
    catch(error){
     editorialCut={kind:'unchanged_context_candidate',requires_explicit_review:true,reason:error.message};
     console.warn('Context boundary requires exact-word audio review', {text:job.text,reason:error.message});
    }
   }
   await writeFile(stem+'.wav',wav,{flag:'wx'});
   if(wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')throw Error('Expected native WAV: '+job.text);
   const inspection=inspectNativeWav(wav),seconds=inspection.seconds;
   const mp3=await encoder.encode(stem);
   const usage=data.usageMetadata??null;
   const input=usage?.promptTokenCount??JSON.stringify(job.request).length;
   const output=usage?.candidatesTokenCount??Math.ceil(seconds*25);
   const billed=(input+output*18)/1e6*0.5;
   cost+=billed;
   const receipt={id:job.id,text:job.text,variant:job.variant,model,voice:job.voice,request_sha256:sha(JSON.stringify(job.request)),bytes_sha256:sha(mp3),wav_sha256:sha(wav),native_wav_sha256:nativeHash,editorial_cut:editorialCut,seconds,inspection,usage_metadata:usage,effective_cost_usd:billed,regular_cost_usd:billed*2,strict_decode:true,post_processing_speed:false,transcript_verified:false,pronunciation_verified:false,finish_reason:data.candidates?.[0]?.finishReason,created_at:new Date().toISOString()};
   await writeSavedJsonOnce(stem+'.receipt.json',receipt);
   receipts.set(job.id,receipt);done++;
   if(!Number.isFinite(seconds)||seconds<0.15||seconds>12||receipt.finish_reason==='MAX_TOKENS')throw Error('Recording duration/finish needs review: '+job.text);
  }catch(error){
   await writeFile(stem+'.local-error.json',json({name:error.name,message:error.message,cause_code:error.cause?.code??null,created_at:new Date().toISOString()}));
   throw error;
  }finally{reserved-=reserve;active--;}
 };
 let reporting=false;
 const reporter=setInterval(()=>{
  if(reporting)return;
  reporting=true;
  void status().catch(e=>{failed??=Error('Cannot save generation status: '+e.message);}).finally(()=>{reporting=false;});
 },5000);
 try{
  await Promise.all(Array.from({length:Math.min(concurrency,pending.length)},async()=>{
   while(!failed&&cursor<pending.length){
    const job=pending[cursor++];
    if(await exists(path.join(directory,'pause-requested'))){failed??=Error('Paused safely before another request');break;}
    try{await generate(job);}catch(e){failed??=e;}
   }
  }));
 }finally{clearInterval(reporter);await status();}
 console.log(JSON.stringify({completed:done,effective_tts_usd:cost,error:failed?.message??null}));
 if(failed)throw failed;
}finally{client.close();await lock.close();await unlink(lockPath);}
