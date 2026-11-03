/** Bounded, resumable Gemini authoring. Never retries a recorded but unresolved paid request. */
import {readFile,writeFile,mkdir,access,copyFile,open,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import dotenv from '../tutor-gateway/node_modules/dotenv/lib/main.js';
import {createGoogleAuth} from '../tutor-gateway/src/audio/googleSpeech.mjs';
import {measureRecording,lexicalWords} from './measure-audio-tempo.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const source=path.join(root,'resources/course/exams/english');
const workspace=path.join(root,'.tmp/english-exams-20261030/batch');
const privateRoot=path.join(root,'storage/app/private');
const model='gemini-3.8-flash-tts';
const sha=v=>createHash('sha256').update(v).digest('hex');
const json=v=>JSON.stringify(v,null,2)+'\n';
const exists=async p=>{try{await access(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const option=(name,fallback)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const limit=Number(option('limit','1000'));
const concurrency=Number(option('concurrency','2'));
const maximum=Number(option('max-characters','250000'));
const selectedLevel=option('level','all').toUpperCase();
if(!Number.isSafeInteger(limit)||limit<1||!Number.isSafeInteger(maximum)||maximum<1)throw Error('Positive integer limit/budget required.');
if(!Number.isSafeInteger(concurrency)||concurrency<1||concurrency>3)throw Error('Concurrency must be between one and three.');
if(!['ALL','A1','A2','B1','B2'].includes(selectedLevel))throw Error('Unknown level.');
await mkdir(workspace,{recursive:true});
const style='Speak very slowly, clearly and naturally in standard American English for an adult English learner. Aim for approximately fifty-five spoken words per minute within phrases, excluding pauses. Keep an unhurried consistent pace throughout, with smooth connected speech, ordinary stress and neutral conversational intonation. No drawling, prolonged vowels, syllable-by-syllable reading, dramatic acting or artificial long pauses. Recite the supplied words exactly once. Do not read speaker labels, add introductions or answer the questions. No music or sound effects.';
const pairs=[['Kore','Puck'],['Aoede','Rasalgethi'],['Erinome','Enceladus'],['Despina','Alnilam'],['Callirrhoe','Achird']];
const corrections=await exists(path.join(source,'audio-corrections.json'))?JSON.parse(await readFile(path.join(source,'audio-corrections.json'),'utf8')):{};
const jobs=[];
for(const level of ['A1','A2','B1','B2']){
  if(selectedLevel!=='ALL'&&!await exists(path.join(source,level.toLowerCase()+'.json')))continue;
  const variants=JSON.parse(await readFile(path.join(source,level.toLowerCase()+'.json'),'utf8'));
  if(variants.length!==5)throw Error('Expected five variants per level.');
  for(const [v,variant] of variants.entries())for(const section of variant.sections)for(const [t,task] of section.tasks.entries()){
    const items=section.skill==='listening'?[task]:section.skill==='speaking'?task.questions:[];
    for(const item of items){
      const segments=item.segments??[{speaker:'male',text:item.prompt}];
      if(!segments.length||segments.some(s=>!['male','female'].includes(s.speaker)||typeof s.text!=='string'||!s.text.trim()))throw Error('Invalid clean speech segments '+item.id);
      if(item.segments&&item.transcript!==segments.map(s=>s.text).join('\n'))throw Error('Mismatched transcript '+item.id);
      const speakers=[...new Set(segments.map(s=>s.speaker))];
      const voices=pairs[(v+t)%pairs.length];
      const casting=Object.fromEntries(speakers.map(s=>[s,section.skill==='speaking'?'Rasalgethi':voices[s==='female'?0:1]]));
      const delivery=style+(corrections[item.id]?.style?' '+corrections[item.id].style:'');
      const parts=segments.map(s=>({text:s.text,speechMetadata:{style:delivery,...(speakers.length>1?{speaker:s.speaker}:{})}}));
      const speechConfig=speakers.length>1?{multiSpeakerVoiceConfig:{speakerVoiceConfigs:speakers.map(s=>({speaker:s,voiceConfig:{voice:casting[s]}}))}}:{voiceConfig:{voice:casting[speakers[0]]}};
      const request={contents:[{role:'user',parts}],generationConfig:{responseModalities:['AUDIO'],speechConfig}};
      const requestHash=sha(JSON.stringify({model,request}));
      jobs.push({id:item.id,level,transcript:segments.map(s=>s.text).join('\n'),textHash:sha(JSON.stringify(item.segments?item.segments.map(s=>s.text):[item.prompt])),casting,requestHash,request,stem:path.join(workspace,requestHash)});
    }
  }
}
const requested=jobs.filter(j=>selectedLevel==='ALL'||j.level===selectedLevel);
const pending=[];
for(const job of [...new Map(requested.map(job=>[job.requestHash,job])).values()]){
  if(await exists(job.stem+'.receipt.json'))continue;
  if(await exists(job.stem+'.request.json'))throw Error('Unresolved paid request; inspect before retry: '+job.id+' '+job.requestHash);
  pending.push(job);
}
const selected=pending.slice(0,limit);
const preflight={model,jobs:jobs.length,selected_level:selectedLevel,pending:pending.length,selected_jobs:selected.length,characters:selected.reduce((n,j)=>n+j.transcript.length,0),written_words:selected.reduce((n,j)=>n+lexicalWords(j.transcript),0),maximum_characters:maximum,existing_pilot:'English Kore/Puck and Rasalgethi auditions retained separately; target pace is a direction, not a measurement.',no_automatic_retry:true};
await writeFile(path.join(workspace,'preflight.json'),json(preflight));
console.log(json(preflight));
if(preflight.characters>maximum)throw Error('Character budget exceeded before any provider call.');
if(!process.argv.includes('--generate'))process.exit(0);
const lock=await open(path.join(workspace,'generation.lock'),'wx');
try{
  const env=dotenv.parse(await readFile(path.join(root,'tools/tutor-gateway/.env')));
  const authenticate=createGoogleAuth({env:{GOOGLE_APPLICATION_CREDENTIALS:process.env.GOOGLE_APPLICATION_CREDENTIALS||env.GOOGLE_APPLICATION_CREDENTIALS}});
  let cursor=0, failure=null;
  const generate=async job=>{
    const {token,project}=await authenticate();
    await writeFile(job.stem+'.request.json',json({id:job.id,model,request_sha256:job.requestHash,request:job.request,created_at:new Date().toISOString()}),{flag:'wx'});
    const response=await fetch(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${model}:generateContent`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(job.request),signal:AbortSignal.timeout(240000)});
    const data=await response.json();
    if(!response.ok){await writeFile(job.stem+'.error.json',json({status:response.status,provider_status:data.error?.status??null}));throw Error('Provider HTTP '+response.status+'; stopped without retry: '+job.id);}
    const audio=data.candidates?.[0]?.content?.parts?.filter(p=>p.inlineData?.data)??[];
    if(audio.length!==1)throw Error('Unexpected audio response; review request '+job.id);
    const wav=Buffer.from(audio[0].inlineData.data,'base64');
    await writeFile(job.stem+'.wav',wav,{flag:'wx'});
    if(wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')throw Error('Expected native WAV, retained output for review.');
    execFileSync('ffmpeg',['-v','error','-xerror','-i',job.stem+'.wav','-f','null','-'],{stdio:'pipe'});
    const tempo=measureRecording({path:job.stem+'.wav',transcript:job.transcript,voice_key:Object.values(job.casting).join(' / ')});
    if(!Number.isFinite(tempo.duration)||tempo.duration<1||tempo.duration>1200)throw Error('Audio duration needs inspection '+job.id);
    const mp3=execFileSync('ffmpeg',['-v','error','-i',job.stem+'.wav','-map_metadata','-1','-codec:a','libmp3lame','-b:a','128k','-f','mp3','pipe:1'],{maxBuffer:40e6});
    await writeFile(job.stem+'.mp3',mp3,{flag:'wx'});
    execFileSync('ffmpeg',['-v','error','-xerror','-i',job.stem+'.mp3','-f','null','-'],{stdio:'pipe'});
    const seconds=Number(JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',job.stem+'.mp3'],{encoding:'utf8'})).format.duration);
    const receipt={id:job.id,model,request_sha256:job.requestHash,text_sha256:job.textHash,bytes_sha256:sha(mp3),wav_sha256:sha(wav),seconds,casting:job.casting,tempo,usage_metadata:data.usageMetadata??null,strict_decode:true,transcript_verified:false,pronunciation_verified:false,post_processing_speed:false,created_at:new Date().toISOString()};
    await writeFile(job.stem+'.receipt.json',json(receipt),{flag:'wx'});
    console.log(JSON.stringify({completed:job.id,seconds,estimated_wpm:Math.round(tempo.wpm)}));
  };
  await Promise.all(Array.from({length:Math.min(concurrency,selected.length)},async()=>{
    while(!failure&&cursor<selected.length){const job=selected[cursor++];try{await generate(job);}catch(error){failure??=error;}}
  }));
  if(failure)throw failure;
  const items={};
  for(const job of jobs){
    if(!await exists(job.stem+'.receipt.json'))continue;
    const receipt=JSON.parse(await readFile(job.stem+'.receipt.json','utf8'));
    if(receipt.request_sha256!==job.requestHash||receipt.text_sha256!==job.textHash||!receipt.strict_decode)throw Error('Stale/invalid receipt '+job.id);
    const mp3=await readFile(job.stem+'.mp3');
    if(sha(mp3)!==receipt.bytes_sha256)throw Error('Audio changed after inspection '+job.id);
    const relative='exams/gemini/'+receipt.bytes_sha256+'.mp3';
    await mkdir(path.dirname(path.join(privateRoot,relative)),{recursive:true});
    await copyFile(job.stem+'.mp3',path.join(privateRoot,relative));
    await writeFile(path.join(privateRoot,relative+'.inspection.json'),json({bytes_sha256:receipt.bytes_sha256,seconds:receipt.seconds,strict_decode:true}));
    items[job.id]={audio_path:relative,audio_seconds:receipt.seconds,audio_generation:{version:3,provider:'google',model,language:'en-US',text_sha256:job.textHash,bytes_sha256:receipt.bytes_sha256,request_sha256:job.requestHash,casting:receipt.casting,estimated_pause_excluded_wpm:Math.round(receipt.tempo.wpm),transcript_verified:receipt.transcript_verified,pronunciation_verified:false}};
  }
  await writeFile(path.join(source,'audio-manifest.json'),json({version:1,language:'en',model,expected_items:jobs.length,items}));
  console.log(JSON.stringify({available:Object.keys(items).length,expected:jobs.length}));
} finally{await lock.close();await unlink(path.join(workspace,'generation.lock'));}
