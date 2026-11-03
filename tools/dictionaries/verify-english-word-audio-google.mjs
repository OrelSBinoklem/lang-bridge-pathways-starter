import {readFile,writeFile,mkdir,readdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import dotenv from '../tutor-gateway/node_modules/dotenv/lib/main.js';
import {createGoogleAuth} from '../tutor-gateway/src/audio/googleSpeech.mjs';
import {sha} from './english-audio-plan.mjs';
import {GoogleJsonClient} from './google-json-client.mjs';
import {readSavedJson,writeSavedJsonOnce} from './english-audio-files.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const opt=(key,fallback)=>process.argv.find(x=>x.startsWith(`--${key}=`))?.slice(key.length+3)??fallback;
const directory=path.resolve(root,opt('directory','.tmp/english-word-audio-20261031'));
if(!directory.startsWith(path.join(root,'.tmp')+path.sep))throw Error('Audio campaigns must stay inside .tmp');
const out=path.join(directory,'google-verification');await mkdir(out,{recursive:true});
const plan=JSON.parse(await readFile(path.join(directory,'reviewed-plan.json'),'utf8'));
const verificationLimit=plan.budget.verification_reserve_usd;
const priorMaximum=plan.budget.prior_effective_maximum_usd??0,ttsLimit=plan.budget.tts_effective_usd;
if(!Number.isFinite(verificationLimit)||verificationLimit<=0||!Number.isFinite(ttsLimit)||ttsLimit<=0
 ||!Number.isFinite(priorMaximum)||priorMaximum<0
 ||priorMaximum+ttsLimit+verificationLimit>8)throw Error('Campaign exceeds the shared authorized budget');
const reviewModel=opt('model','gemini-3.8-flash');
const reviewPrice={'gemini-3.8-flash':{input:1.5,output:7.5,fraction:.5},'gemini-3.1-pro-preview':{input:2,output:12,fraction:1}}[reviewModel];
if(!reviewPrice)throw Error('Unsupported bounded review model');
const limit=Number(opt('limit','10')),batchSize=Number(opt('batch-size','40'));
if(process.argv.includes('--verify')&&Date.now()>=Date.parse('2027-01-01T00:00:00Z'))throw Error('Introductory pricing expired; verify rates before paid audio review');
if(!Number.isSafeInteger(limit)||limit<1||!Number.isSafeInteger(batchSize)||batchSize<1||batchSize>40)throw Error('Invalid bounds');
const exists=async file=>{try{await access(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const json=v=>JSON.stringify(v,null,2)+'\n';
const env=dotenv.parse(await readFile(path.join(root,'tools/tutor-gateway/.env')));
const credentials=process.env.GOOGLE_APPLICATION_CREDENTIALS||env.GOOGLE_APPLICATION_CREDENTIALS||path.join(root,'.tmp/google-tts-service-account.json');
const auth=createGoogleAuth({env:{GOOGLE_APPLICATION_CREDENTIALS:credentials}});
const onlyFile=opt('only-jobs','');
const only=onlyFile?new Set(JSON.parse(await readFile(path.resolve(root,onlyFile),'utf8'))):null;
const selected=plan.jobs.filter(job=>!only||only.has(job.id)).slice(0,limit),reports=[];
const client=new GoogleJsonClient();
let cost=0,reserved=0;
if(await exists(path.join(out,'uncertain-attempts.json')))cost+=JSON.parse(await readFile(path.join(out,'uncertain-attempts.json'),'utf8')).reduce((sum,item)=>sum+item.reserved_effective_usd,0);
for(const file of await readdir(out)){
 if(file.endsWith('.billing.json'))cost+=JSON.parse(await readFile(path.join(out,file),'utf8')).effective_cost_usd;
 if(file.endsWith('.result.json')&&!await exists(path.join(out,file.replace('.result.json','.billing.json'))))cost+=JSON.parse(await readFile(path.join(out,file),'utf8')).effective_cost_usd;
}
const verifyBatch=async i=>{
 const group=[];
 for(const job of selected.slice(i,i+batchSize)){
  const file=path.join(directory,'jobs',job.id+'.receipt.json');
  if(await exists(file))group.push({...job,receipt:await readSavedJson(file)});
 }
 // Stable plan-based groups keep already reviewed batches reusable as generation progresses.
 if(group.length!==selected.slice(i,i+batchSize).length)return;
 const batchId=sha(JSON.stringify(group.map(j=>[j.id,j.receipt.bytes_sha256]))+(process.argv.includes('--phonetics-all')?'::full-phonetics':'')+(reviewModel==='gemini-3.8-flash'?'':'::'+reviewModel)),stem=path.join(out,batchId);
 if(await exists(stem+'.result.json')){reports.push(JSON.parse(await readFile(stem+'.result.json','utf8')));return;}
 if(await exists(stem+'.request.json'))throw Error('Unresolved audio verification request; do not retry');
 const seconds=group.reduce((n,j)=>n+j.receipt.seconds,0);
 const reserve=((seconds*32+4000)*reviewPrice.input+4096*reviewPrice.output)/1e6*reviewPrice.fraction;
 if(cost+reserved+reserve>verificationLimit)throw Error('Verification cost limit reached before another request');
 reserved+=reserve;
 try{
 const phonetics=group.flatMap((j,index)=>j.hint||process.argv.includes('--phonetics-all')?[index+1]:[]);
 const prompt=`Independently transcribe each numbered audio clip exactly as heard, in English. Do not add words, definitions, corrections or explanations. The clips are isolated dictionary words or short phrases. Return exactly ${group.length} items in the same order, each with index, text, ipa and issue. One clip may contain SEVERAL words: keep ALL of them in its ONE text field. Never split a clip into two items or shift subsequent indices. For indices ${phonetics.join(', ')||'none'}, also transcribe the actually heard pronunciation in IPA including stress; leave ipa empty for the others. Set issue only for missing speech, repeated words, extra spoken introductions, clipping, hum or unnatural artifacts you can actually hear; otherwise an empty string. You are not given the expected words. Return only JSON.`;
 const parts=[{text:prompt}];
 for(const [index,job] of group.entries()){
  const bytes=await readFile(path.join(directory,'jobs',job.id+'.mp3'));
  if(sha(bytes)!==job.receipt.bytes_sha256)throw Error('Changed audio');
  parts.push({text:`Audio ${index+1}:`},{inlineData:{mimeType:'audio/mpeg',data:bytes.toString('base64')}});
 }
 const request={contents:[{role:'user',parts}],generationConfig:{maxOutputTokens:4096,thinkingConfig:{thinkingLevel:'LOW'},responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{items:{type:'ARRAY',items:{type:'OBJECT',properties:{index:{type:'INTEGER'},text:{type:'STRING'},ipa:{type:'STRING'},issue:{type:'STRING'}},required:['index','text','ipa','issue']}}},required:['items']}}};
 if(!process.argv.includes('--verify')){console.log(json({batch:batchId,seconds,reserved_effective_usd:reserve,clips:group.length}));return;}
 const {token,project}=await auth();
 await writeFile(stem+'.request.json',json({model:reviewModel,request_sha256:sha(JSON.stringify(request)),job_ids:group.map(j=>j.id),prompt,reserved_effective_usd:reserve,created_at:new Date().toISOString()}),{flag:'wx'});
 let response;
 for(let attempt=0;attempt<4;attempt++){
  response=await client.post(`/v1/projects/${project}/locations/global/publishers/google/models/${reviewModel}:generateContent`,token,request,180000);
  if(response.status!==429)break;
  await writeSavedJsonOnce(stem+`.rate-limit-${Date.now()}.json`,{status:429,known_unbilled:true,attempt,created_at:new Date().toISOString()});
  if(attempt<3)await new Promise(resolve=>setTimeout(resolve,15000*2**attempt));
 }
 const data=response.data;
 if(!response.ok){await writeFile(stem+'.error.json',json({status:response.status,message:data.error?.message}));throw Error('Google verification HTTP '+response.status);}
 await writeFile(stem+'.response.json',JSON.stringify(data),{flag:'wx'});
 const usage=data.usageMetadata??{},generated=Math.max(0,(usage.totalTokenCount??0)-(usage.promptTokenCount??0));
 const effective=((usage.promptTokenCount??0)*reviewPrice.input+generated*reviewPrice.output)/1e6*reviewPrice.fraction;
 cost+=effective;
 await writeFile(stem+'.billing.json',json({usage,effective_cost_usd:effective}),{flag:'wx'});
 const text=data.candidates?.[0]?.content?.parts?.filter(p=>p.text&&!p.thought).map(p=>p.text).join('')??'';
 const parsed=JSON.parse(text);
 if(!Array.isArray(parsed.items)||parsed.items.length!==group.length||parsed.items.some((item,index)=>item.index!==index+1))throw Error('Verification response omitted or reordered clips');
 const results=parsed.items.map((item,index)=>({...item,job_id:group[index].id,bytes_sha256:group[index].receipt.bytes_sha256,expected:group[index].text,variant:group[index].variant}));
 const report={id:batchId,model:reviewModel,items:results,usage,effective_cost_usd:effective,regular_cost_usd:effective/reviewPrice.fraction,created_at:new Date().toISOString()};
 await writeSavedJsonOnce(stem+'.result.json',report);reports.push(report);
 console.log(JSON.stringify({verified_clips:group.length,total_effective_verification_usd:cost,issues:results.filter(r=>r.issue).map(r=>({text:r.expected,issue:r.issue}))}));
 }finally{reserved-=reserve;}
};
const starts=Array.from({length:Math.ceil(selected.length/batchSize)},(_,index)=>index*batchSize);
let cursor=0,failed;
try{
 await Promise.all(Array.from({length:2},async()=>{
  while(!failed&&cursor<starts.length){const index=starts[cursor++];try{await verifyBatch(index);}catch(error){failed??=error;}}
 }));
 if(failed)throw failed;
}finally{client.close();}
await writeFile(path.join(out,'summary.json'),json({batches:reports.length,recordings:reports.reduce((n,r)=>n+r.items.length,0),effective_cost_usd:cost,reports:reports.map(r=>r.id)}));
