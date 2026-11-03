import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from '../../frontend/node_modules/sharp/lib/index.js';
import { assertExclusivePhotos } from './visual-photo-uniqueness.mjs';
import { additionalPhotos, a1Scenes, a2Pairs, b1Pairs, b1Followups, a1Requests, readingPictures, presentations } from '../../resources/course/exams/visuals/editorial-20261021.mjs';

const [sourceFile, downloads] = process.argv.slice(2);
if (!sourceFile || !downloads) throw new Error('Usage: node tools/exams/build-visual-revision.mjs SNAPSHOT_JSON DOWNLOADED_PHOTOS_DIR');
const root = 'resources/course/exams/visuals';
const source = JSON.parse((await fs.readFile(sourceFile, 'utf8')).replace(/^\uFEFF/, ''));
if (source.environment !== 'production' || source.variants.length !== 20) throw new Error('Expected reviewed current production snapshot of 20 variants');
const old = JSON.parse(await fs.readFile(`${root}/stock-selection-2026-10-21.json`, 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const photos = new Map(old.assets.map(a => [Number(a.id.replace('pexels-', '')), {
  id:Number(a.id.replace('pexels-', '')), author:a.author, source_url:a.source_url,
  description:[a.examiner_description, ...a.acceptable_interpretations, 'Do not require: '+a.do_not_require.join('; ')].join(' '),
  input:path.join(root,a.local_file),
}]));
for (const [id,author,slug,description] of additionalPhotos) photos.set(id,{id,author,source_url:`https://www.pexels.com/photo/${slug}-${id}/`,description,input:path.join(downloads,`${id}.jpg`)});
await fs.mkdir('frontend/public/course/exams/visuals',{recursive:true});
const assets=[];
for (const photo of photos.values()) {
  const bytes=await fs.readFile(photo.input);
  const output=await sharp(bytes).rotate().resize({width:1400,height:1400,fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer();
  const filename=`pexels-${photo.id}-${hash(output).slice(0,12)}.webp`;
  photo.image=`/course/exams/visuals/${filename}`;
  await fs.writeFile(`frontend/public${photo.image}`,output);
  const metadata=await sharp(output).metadata();
  assets.push({id:photo.id,author:photo.author,source_url:photo.source_url,license_url:'https://www.pexels.com/license/',reviewed_at:'2026-10-21',image:photo.image,width:metadata.width,height:metadata.height,source_sha256:hash(bytes),sha256:hash(output),examiner_description:photo.description});
}
const visual=(id,index)=>({title:`${index+1}. attēls`,image:photos.get(id).image,credit:photos.get(id).author});
const evidence=ids=>'\nReviewed visual evidence (private, not an exhaustive checklist):\n'+ids.map((id,i)=>`${i+1}. ${photos.get(id).description}`).join('\n')+'\nGrade only the public prompt. Accept plausible interpretations and unlisted incidental details. Do not transfer places or characters from other tasks. No pronunciation assessment from a transcript.';
const jobs=new Map();
function spoken(q,prompt,rubric) {
  if(q.prompt!==prompt) {
    for(const key of ['audio_path','audio_seconds','audio_generation']) delete q[key];
    const key=hash(JSON.stringify([prompt]));
    if(!jobs.has(key)) jobs.set(key,{key,text:prompt,voice:'Rasalgethi',question_ids:[]});
    jobs.get(key).question_ids.push(q.id);
  }
  q.prompt=prompt; q.rubric=rubric;
}
const entries=[];
for(const v of source.variants) {
  const n=v.position-1;
  if(!Number.isInteger(n)||n<0||n>4) throw new Error('Invalid variant');
  const speaking=structuredClone(v.content.sections.find(s=>s.skill==='speaking'));
  const sections={speaking};
  if(v.level==='A1') {
    const scene=speaking.tasks[1];
    delete scene.image; scene.visuals=[visual(a1Scenes[n],0)];
    spoken(scene.questions[0],'Pastāstiet par attēlu. Kas ir redzams? Kur ir cilvēki? Ko viņi dara? Pasakiet vismaz trīs vienkāršus teikumus.',
      'A1, maximum 3: one point for each of three distinct understandable relevant Latvian sentences about visible people, place or actions. Award 0.5 for a relevant but incomplete phrase. Do not require every person or object, complex grammar or exact relationships.'+evidence([a1Scenes[n]]));
    for(const [i,q] of speaking.tasks[2].questions.entries()) {
      const [id,prompt,goal]=a1Requests[n][i]; q.image=photos.get(id).image;
      spoken(q,prompt,`A1, maximum 1: ${goal} Award 1 for an understandable full Latvian question, 0.5 for an incomplete but understandable question, 0 for no relevant question. The learner asks, not answers, the question. No hidden factual answer or compulsory wording.`+evidence([id]));
    }
    const reading=structuredClone(v.content.sections.find(s=>s.skill==='reading'));
    const task=reading.tasks.find(t=>t.questions.some(q=>q.image));
    if (!task || task.questions.length !== 5 || readingPictures.length !== 25) throw new Error('Expected five exclusive reading pictures per A1 form');
    task.title='1. Izvēlieties attēlam atbilstošo teikumu.';
    task.questions.forEach((q,i)=>{
      const [id,...sentences]=readingPictures[n*5+i];
      const shift=(n+i)%3;
      q.image=photos.get(id).image; q.prompt='Kurš teikums atbilst attēlam?';
      q.options=Array.from({length:3},(_,j)=>({id:String(j),text:sentences[(j+shift)%3]}));
      q.correct=String((3-shift)%3); q.explanation=sentences[0];
      delete q.explanation_translations;
    });
    sections.reading=reading;
  } else if(v.level==='A2'||v.level==='B1') {
    const ids=(v.level==='A2'?a2Pairs:b1Pairs)[n];
    const task=speaking.tasks[v.level==='A2'?1:2]; delete task.image;
    task.title=v.level==='A2'?'2. Pastāstiet par abiem attēliem.':'3. Aprakstiet un salīdziniet abus attēlus.';
    task.visuals=ids.map(visual);
    const prompt=v.level==='A2'
      ? 'Pastāstiet par katru attēlu. Kur ir cilvēki? Ko viņi dara? Kādi priekšmeti ir redzami? Runājiet pilnos, vienkāršos teikumos.'
      : 'Aprakstiet abus attēlus. Kas tiem ir kopīgs, un kas atšķiras? '+b1Followups[n];
    const rubric=v.level==='A2'
      ? 'A2, maximum 6: relevant description of first scene 2 and second scene 2, understandable vocabulary and grammar 2. A description should cover a place and an action plus some visible detail; no exhaustive inventory. Comparison is not required. Accept simple connected sentences and reasonable interpretation.'
      : 'B1, maximum 9: relevant descriptions of both scenes 2, meaningful similarities and differences 2, developed answers to the two explicit follow-up questions 2, vocabulary, grammar and coherence 3. General advantages or disadvantages may be argued as possibilities, not as proven facts about these photographed people.';
    spoken(task.questions[0],prompt,rubric+evidence(ids));
  } else if(v.level==='B2') {
    const p=presentations[n], task=speaking.tasks[1];
    delete task.image; delete task.text;
    task.visuals=[
      {title:`1. ${p.topic}`,text:p.intro,image:photos.get(p.photo).image,credit:photos.get(p.photo).author},
      {title:'2. Viedokļi skaitļos',text:p.chart,bars:p.bars.map(([label,value])=>({label,value})),chart_note:'Izdomāti mācību dati: 100 respondenti, katrs izvēlējās vienu atbildi. Tie nav reāla pētījuma rezultāti.'},
      {title:'3. Risinājums',text:p.solution},
      {title:'4. Ieguvumi un riski',text:p.tradeoff},
      {title:'5. Alternatīva un kompromiss',text:p.alternative},
      {title:'6. Secinājums',text:p.conclusion},
    ];
    spoken(task.questions[0],'Sagatavojiet saistītu trīs līdz četru minūšu prezentāciju, izmantojot sešus slaidus. Raksturojiet diagrammu, piedāvājiet risinājumu un pamatojiet savu viedokli. Atbildiet arī uz jautājumiem slaidos un izvērtējiet spēcīgāko iebildumu.',
      'B2, maximum 15: meaningful coverage of six slides including accurate interpretation of the fictional chart 6; reasoned argument and counterargument 3; uncertainty or missing evidence 1; organization 2; vocabulary and grammar 3. Do not demand reading every number or every prompt verbatim. Duration is guidance only and cannot be measured from transcript. This is an original exam-style exercise, not a real survey or an official exam.'+evidence([p.photo])+'\nExact visible slide content: '+JSON.stringify(task.visuals.map(({image,credit,...slide})=>slide)));
  } else throw new Error('Unexpected level');
  entries.push({level:v.level,position:v.position,expected_sha256:v.sha256,replace_sections:sections});
}
const assignments=assertExclusivePhotos(entries,assets,70);
const pack={revision:'exam-exclusive-stock-visuals-20261021',source_environment:'production',status:'draft_requires_revoicing',variants:entries};
await fs.writeFile(`${root}/revision-draft.json`,JSON.stringify(pack,null,2)+'\n');
await fs.writeFile(`${root}/assets.json`,JSON.stringify({license:old.license,assets},null,2)+'\n');
await fs.writeFile(`${root}/photo-assignments.json`,JSON.stringify({unique_photos:assignments.length,repeated_photos:0,assignments},null,2)+'\n');
await fs.writeFile(`${root}/voice-jobs.json`,JSON.stringify({model:'gemini-3.8-flash-tts',jobs:[...jobs.values()]},null,2)+'\n');
console.log(JSON.stringify({variants:entries.length,photos:assets.length,voice_jobs:jobs.size,voice_characters:[...jobs.values()].reduce((s,j)=>s+j.text.length,0)}));
