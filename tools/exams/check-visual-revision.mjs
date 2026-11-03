import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { assertExclusivePhotos } from './visual-photo-uniqueness.mjs';
const root='resources/course/exams/visuals';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const pack=await read(`${root}/revision.json`);
const assets=(await read(`${root}/assets.json`)).assets;
const jobs=(await read(`${root}/voice-jobs.json`)).jobs;
const photos=new Set(assets.map(a=>a.image));
const assignments=assertExclusivePhotos(pack.variants,assets,70);
assert.equal(pack.variants.length,20);
for(const level of ['A1','A2','B1','B2'])assert.deepEqual(pack.variants.filter(v=>v.level===level).map(v=>v.position).sort(),[1,2,3,4,5]);
for(const asset of assets)assert.equal(sha(await fs.readFile(`frontend/public${asset.image}`)),asset.sha256);
let imageReferences=0,spokenReferences=0;
for(const entry of pack.variants)for(const section of Object.values(entry.replace_sections))for(const task of section.tasks){
  for(const visual of task.visuals??[])if(visual.image){assert(photos.has(visual.image));imageReferences++;}
  for(const q of task.questions){
    if(q.image){assert(photos.has(q.image));imageReferences++;}
    if(q.audio_path){
      spokenReferences++;
      assert.equal(q.audio_generation.text_sha256,sha(JSON.stringify([q.prompt])));
      const filename=`storage/app/private/${q.audio_path}`;
      const checksum=sha(await fs.readFile(filename));
      assert.equal(checksum,q.audio_generation.bytes_sha256);
      const receipt=await read(`${filename}.inspection.json`);
      assert.equal(receipt.bytes_sha256,checksum);assert.equal(receipt.strict_decode,true);
      assert(Math.abs(receipt.seconds-q.audio_seconds)<0.05);
    }
  }
}
const audioDirectory=process.argv[2];
const speechChecks=[];
if(audioDirectory){
  const normalized=text=>text.toLocaleLowerCase('lv').replace(/[^\p{L}\p{N}]/gu,'');
  for(const job of jobs){
    const transcript=await read(`${audioDirectory}/${job.key}.transcript.json`);
    const matches=normalized(job.text)===normalized(transcript.text);
    assert(matches,`Speech mismatch: ${job.key}`);
    speechChecks.push({text_sha256:job.key,normalized_words_match:true});
  }
}
const result={variants:20,photos:assets.length,imageReferences,uniquePhotos:assignments.length,repeatedPhotos:0,spokenReferences,new_recordings:jobs.length,speechChecks};
await fs.mkdir('.tmp/exam-visuals-20261021',{recursive:true});
await fs.writeFile('.tmp/exam-visuals-20261021/content-check.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,speechChecks:speechChecks.length}));
