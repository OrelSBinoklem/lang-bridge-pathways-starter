/** Independent recognition, without giving the recognizer the expected transcript. */
import {readFile,writeFile,readdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from '../tutor-gateway/node_modules/dotenv/lib/main.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const directory=path.join(root,'.tmp/english-exams-20261030/batch');
const option=(key,fallback)=>process.argv.find(x=>x.startsWith(`--${key}=`))?.slice(key.length+3)??fallback;
const limit=Number(option('limit','1000')), maximumMinutes=Number(option('max-minutes','400'));
const model=option('model','gpt-transcribe');
if(!['gpt-transcribe','gpt-4o-transcribe'].includes(model))throw Error('Unknown verification model.');
const suffix=model==='gpt-transcribe'?'asr':'asr-independent';
const only=new Set(option('only','').split(',').filter(Boolean));
if(!Number.isSafeInteger(limit)||limit<1||!Number.isFinite(maximumMinutes)||maximumMinutes<=0)throw Error('Positive bounded limits required.');
const sha=v=>createHash('sha256').update(v).digest('hex');
const json=v=>JSON.stringify(v,null,2)+'\n';
const exists=async p=>{try{await access(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
export function normalized(text){return text.normalize('NFKC').toLowerCase().replaceAll('’',"'").replaceAll('colour','color').replaceAll('centre','center').replaceAll('favourite','favorite').replace(/[^\p{L}\p{N}']/gu,' ').replace(/\s+/g,' ').trim();}
export function distance(a,b){
  const previous=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let diagonal=previous[0];previous[0]=i;
    for(let j=1;j<=b.length;j++){const old=previous[j];previous[j]=Math.min(previous[j]+1,previous[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=old;}
  }
  return previous[b.length];
}
const files=(await readdir(directory)).filter(x=>x.endsWith('.receipt.json'));
const activeManifest=JSON.parse(await readFile(path.join(root,'resources/course/exams/english/audio-manifest.json'),'utf8'));
const jobs=[];
for(const file of files){
  const receipt=JSON.parse(await readFile(path.join(directory,file),'utf8'));
  if(activeManifest.items[receipt.id]?.audio_generation?.bytes_sha256!==receipt.bytes_sha256)continue;
  const stem=path.join(directory,file.replace(/\.receipt\.json$/,''));
  const request=JSON.parse(await readFile(stem+'.request.json','utf8'));
  const expected=request.request.contents[0].parts.map(p=>p.text).join('\n');
  jobs.push({stem,receipt,expected});
}
const pending=[];
for(const job of jobs){
  if(only.size&&!only.has(job.receipt.id))continue;
  if(await exists(job.stem+'.'+suffix+'.json'))continue;
  if(await exists(job.stem+'.'+suffix+'-request.json'))throw Error('Unresolved recognition request '+job.receipt.id+'; no retry.');
  pending.push(job);
}
const selected=pending.slice(0,limit);
const minutes=selected.reduce((n,j)=>n+j.receipt.seconds/60,0);
console.log(JSON.stringify({recordings:jobs.length,pending:pending.length,selected:selected.length,minutes,maximumMinutes}));
if(minutes>maximumMinutes)throw Error('Recognition budget exceeded.');
if(!process.argv.includes('--verify'))process.exit(0);
const env=dotenv.parse(await readFile(path.join(root,'tools/tutor-gateway/.env')));
const appEnv=dotenv.parse(await readFile(path.join(root,'.env')));
const key=process.env.OPENAI_API_KEY||env.OPENAI_API_KEY||appEnv.OPENAI_API_KEY;
if(!key)throw Error('Recognition key unavailable.');
for(const job of selected){
  const bytes=await readFile(job.stem+'.mp3');
  if(sha(bytes)!==job.receipt.bytes_sha256)throw Error('Changed audio '+job.receipt.id);
  await writeFile(job.stem+'.'+suffix+'-request.json',json({id:job.receipt.id,model,bytes_sha256:sha(bytes),prompt:'Transcribe the English recording verbatim. Do not add, translate, correct or complete anything.',created_at:new Date().toISOString()}),{flag:'wx'});
  const form=new FormData();form.set('model',model);form.set('file',new Blob([bytes],{type:'audio/mpeg'}),'exam.mp3');form.set(model==='gpt-transcribe'?'languages[]':'language','en');form.set('prompt','Transcribe the English recording verbatim. Do not add, translate, correct or complete anything.');
  const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,signal:AbortSignal.timeout(180000)});
  const result=await response.json();
  if(!response.ok){await writeFile(job.stem+'.'+suffix+'-error.json',json({status:response.status,code:result.error?.code??null}));throw Error('Recognition HTTP '+response.status+'; no retry.');}
  if(typeof result.text!=='string'||!result.text.trim())throw Error('Empty transcription, retained request.');
  const expected=normalized(job.expected),heard=normalized(result.text);
  const report={id:job.receipt.id,model,bytes_sha256:sha(bytes),text:result.text,expected:job.expected,exact_normalized:expected===heard,word_edit_rate:distance(expected.split(' '),heard.split(' '))/Math.max(1,expected.split(' ').length),usage:result.usage??null,checked_at:new Date().toISOString()};
  await writeFile(job.stem+'.'+suffix+'.json',json(report),{flag:'wx'});
  console.log(JSON.stringify({checked:report.id,exact:report.exact_normalized,edit_rate:Math.round(report.word_edit_rate*1000)/1000}));
}
const report=[];
for(const job of jobs)if(await exists(job.stem+'.'+suffix+'.json'))report.push(JSON.parse(await readFile(job.stem+'.'+suffix+'.json','utf8')));
await writeFile(path.join(directory,'transcript-review'+(suffix==='asr'?'':'-independent')+'.json'),json({checked:report.length,exact:report.filter(r=>r.exact_normalized).length,needs_review:report.filter(r=>!r.exact_normalized)}));
