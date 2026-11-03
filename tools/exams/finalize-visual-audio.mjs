import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [audioDirectory]=process.argv.slice(2);
if(!audioDirectory) throw new Error('Supply the private generated-audio directory');
const root='resources/course/exams/visuals';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const jobs=(await read(`${root}/voice-jobs.json`)).jobs;
const pack=await read(`${root}/revision-draft.json`);
const previous=await read(`${root}/audio-assets.json`).catch(error=>{if(error.code==='ENOENT')return {records:[]};throw error;});
const records=new Map();
await fs.mkdir('storage/app/private/exams/gemini',{recursive:true});
for(const job of jobs) {
  const stem=`${audioDirectory}/${job.key}`;
  const receipt=await read(`${stem}.receipt.json`);
  const wav=await fs.readFile(`${stem}.wav`);
  if(receipt.sha256!==sha(wav)||receipt.text!==job.text) throw new Error('Receipt mismatch');
  const cached=previous.records.find(r=>r.audio_generation.text_sha256===job.key && r.audio_generation.native_sha256===receipt.sha256 && r.audio_generation.request_sha256[0]===receipt.request_sha256);
  if(cached) {
    const filename=`storage/app/private/${cached.audio_path}`;
    const inspection=await read(`${filename}.inspection.json`);
    if(sha(await fs.readFile(filename))!==cached.audio_generation.bytes_sha256 || inspection.bytes_sha256!==cached.audio_generation.bytes_sha256 || !inspection.strict_decode || inspection.seconds!==cached.audio_seconds)throw new Error('Cached inspected audio changed');
    records.set(job.key,cached);continue;
  }
  const mp3=execFileSync('ffmpeg',['-v','error','-xerror','-i',`${stem}.wav`,'-codec:a','libmp3lame','-b:a','128k','-f','mp3','pipe:1'],{maxBuffer:20*1024*1024});
  const bytesHash=sha(mp3), relative=`exams/gemini/${bytesHash}.mp3`, filename=`storage/app/private/${relative}`;
  await fs.writeFile(filename,mp3);
  execFileSync('ffmpeg',['-v','error','-xerror','-i',filename,'-f','null','-']);
  const seconds=Number(JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',filename],{encoding:'utf8'})).format.duration);
  if(!Number.isFinite(seconds)||seconds<=0||seconds>120)throw new Error('Unexpected prompt duration');
  await fs.writeFile(`${filename}.inspection.json`,JSON.stringify({bytes_sha256:bytesHash,seconds,strict_decode:true}));
  records.set(job.key,{audio_path:relative,audio_seconds:seconds,audio_generation:{version:3,provider:'google',model:'gemini-3.8-flash-tts',text_sha256:sha(JSON.stringify([job.text])),bytes_sha256:bytesHash,native_sha256:receipt.sha256,request_sha256:[receipt.request_sha256],voices:['Rasalgethi']}});
}
let attached=0;
for(const entry of pack.variants) for(const task of entry.replace_sections.speaking.tasks) for(const q of task.questions) {
  const key=sha(JSON.stringify([q.prompt]));
  if(records.has(key)) { Object.assign(q,records.get(key)); attached++; }
  if(!q.audio_path) throw new Error(`Missing speaking audio: ${q.id}`);
}
pack.status='prepared_not_published';
await fs.writeFile(`${root}/revision.json`,JSON.stringify(pack,null,2)+'\n');
await fs.writeFile(`${root}/audio-assets.json`,JSON.stringify({records:[...records.values()]},null,2)+'\n');
console.log(JSON.stringify({unique_audio:records.size,attached_prompts:attached,total_seconds:[...records.values()].reduce((sum,r)=>sum+r.audio_seconds,0)}));
