import {readFile,writeFile,readdir,mkdir,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha} from './english-audio-plan.mjs';
import {reviewTranscript} from './english-audio-review.mjs';
import {inspectNativeWav} from './english-audio-wave.mjs';
import {readSavedJson} from './english-audio-files.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const directory=path.join(root,'.tmp/english-word-audio-20261031');
const plan=JSON.parse(await readFile(path.join(directory,'reviewed-plan.json'),'utf8'));
const exists=async file=>{try{await access(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
const json=value=>JSON.stringify(value,null,2)+'\n';
const observations=new Map();
let verificationCost=0,ttsCost=0;
const reviewFiles=await readdir(path.join(directory,'google-verification'));
for(const file of reviewFiles)if(file.endsWith('.billing.json'))verificationCost+=JSON.parse(await readFile(path.join(directory,'google-verification',file),'utf8')).effective_cost_usd;
const reports=[];
for(const file of reviewFiles){
  if(!file.endsWith('.result.json'))continue;
  const report=JSON.parse(await readFile(path.join(directory,'google-verification',file),'utf8'));
  if(!reviewFiles.includes(file.replace('.result.json','.billing.json')))verificationCost+=report.effective_cost_usd;
  reports.push(report);
}
for(const report of reports.sort((a,b)=>a.created_at.localeCompare(b.created_at))){
  if(report.items.some(item=>!item.bytes_sha256)){
    const fingerprints=[];
    for(const item of report.items){
      const receipt=JSON.parse(await readFile(path.join(directory,'jobs',item.job_id+'.receipt.json'),'utf8'));
      fingerprints.push([item.job_id,receipt.bytes_sha256]);
    }
    // Legacy pilot reports are accepted only when their batch fingerprint proves the current bytes.
    if(sha(JSON.stringify(fingerprints))!==report.id)continue;
    report.items.forEach((item,index)=>{item.bytes_sha256=fingerprints[index][1];});
  }
  for(const item of report.items)observations.set(item.job_id+':'+item.bytes_sha256,item);
}
// Count superseded successful takes too. They remain in the original expense ledger.
for(const file of await readdir(path.join(directory,'jobs'))){
  if(file.endsWith('.receipt.json'))ttsCost+=(await readSavedJson(path.join(directory,'jobs',file))).effective_cost_usd;
}
const pilot=JSON.parse(await readFile(path.join(directory,'stream-speed.result.json'),'utf8'));
ttsCost+=(pilot.usage.inputTokens+pilot.usage.outputAudioTokens*18)/1e6*.5;
const uncertain=await exists(path.join(directory,'uncertain-attempts.json'))
  ?JSON.parse(await readFile(path.join(directory,'uncertain-attempts.json'),'utf8')):[];
const uncertainVerification=await exists(path.join(directory,'google-verification/uncertain-attempts.json'))
  ?JSON.parse(await readFile(path.join(directory,'google-verification/uncertain-attempts.json'),'utf8')):[];
const uncertainMaximum=[...uncertain,...uncertainVerification].reduce((sum,attempt)=>sum+attempt.reserved_effective_usd,0);
if(ttsCost+verificationCost+uncertainMaximum>8)throw Error('Total budget exceeded');

const decisions=await exists(path.join(directory,'review-decisions.json'))
  ?JSON.parse(await readFile(path.join(directory,'review-decisions.json'),'utf8')):{};
const missing=[],needsReview=[],clips=[];
for(const job of plan.jobs){
  const stem=path.join(directory,'jobs',job.id);
  if(!await exists(stem+'.receipt.json')){missing.push({id:job.id,text:job.text});continue;}
  const receipt=await readSavedJson(stem+'.receipt.json');
  const [mp3,wav]=await Promise.all([readFile(stem+'.mp3'),readFile(stem+'.wav')]);
  if(receipt.request_sha256!==sha(JSON.stringify(job.request))||receipt.bytes_sha256!==sha(mp3)
    ||receipt.wav_sha256!==sha(wav)||receipt.strict_decode!==true||receipt.finish_reason!=='STOP')throw Error('Changed or unfinished recording: '+job.text);
  const inspection=inspectNativeWav(wav);
  const observed=observations.get(job.id+':'+receipt.bytes_sha256);
  const review=observed?reviewTranscript(job,observed):{problems:['not_transcribed']};
  const decision=decisions[job.id];
  const approved=decision?.decision==='accept'&&decision.bytes_sha256===receipt.bytes_sha256&&decision.reason?.length>8;
  if(receipt.editorial_cut?.requires_explicit_review&&!approved)review.problems.push('context_prefix_needs_explicit_review');
  if(review.problems.length&&!approved)needsReview.push({job_id:job.id,text:job.text,variant:job.variant,bytes_sha256:receipt.bytes_sha256,...review});
  clips.push({id:job.id,text:job.text,variant:job.variant,voice:job.voice,model:job.model,
    sound_url:`/audio/dictionary/en-flash/${receipt.bytes_sha256}.mp3`,bytes_sha256:receipt.bytes_sha256,
    request_sha256:receipt.request_sha256,inspection,transcript:observed?.text,ipa:observed?.ipa,
    review:approved?decision.reason:'Independent audio transcription matches the headword; strict decoding and PCM inspection passed.'});
}
const summary={records:plan.records.length,recordings:plan.jobs.length,ready:clips.length,missing:missing.length,
  needs_review:needsReview.length,confirmed_effective_usd:ttsCost+verificationCost,
  confirmed_tts_effective_usd:ttsCost,confirmed_verification_effective_usd:verificationCost,
  uncertain_maximum_effective_usd:uncertainMaximum,total_maximum_effective_usd:ttsCost+verificationCost+uncertainMaximum,
  promotional_credit_fraction:.5,post_processing_speed:false};
await writeFile(path.join(directory,'release-inspection.json'),json({summary,missing,needsReview,clips}));
console.log(json(summary));
if(!process.argv.includes('--publish-local'))process.exit(0);
if(missing.length||needsReview.length)throw Error('Incomplete generation or unresolved audio reviews; database unchanged');
const output=path.join(root,'frontend/public/audio/dictionary/en-flash');
await mkdir(output,{recursive:true});
for(const clip of clips){
  const target=path.join(output,clip.bytes_sha256+'.mp3');
  const bytes=await readFile(path.join(directory,'jobs',clip.id+'.mp3'));
  if(await exists(target)){if(sha(await readFile(target))!==clip.bytes_sha256)throw Error('Existing immutable audio changed');}
  else await writeFile(target,bytes,{flag:'wx'});
}
const urls=new Map(clips.map(clip=>[clip.id,clip.sound_url]));
await writeFile(path.join(directory,'publication.json'),json({version:1,summary,clips,
  records:plan.records.map(record=>({...record,sound_url:urls.get(record.job_id)}))}));
console.log('Verified immutable MP3 assets prepared locally. Apply the guarded PHP manifest separately.');
