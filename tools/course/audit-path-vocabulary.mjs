import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const normalize = text => String(text).normalize('NFC').toLocaleLowerCase('lv').trim();
export const tokens = text => (String(text).replace(/<[^>]*>/g,' ').replace(/\{\{[^}]*\}\}/g,' ').match(/[\p{Script=Latin}\p{M}]+(?:[-’'][\p{Script=Latin}\p{M}]+)*/gu)??[]).map(normalize);
const parse = value => typeof value==='string'?JSON.parse(value):value??{};
const percent = (n,d) => d?Math.round(n/d*1000)/10:null;
export function buildLexicon(snapshot,corpus){
 const forms=new Map();
 for(const entries of Object.values(corpus.words??{}))for(const e of entries){
  const lemma=normalize(e.lemma);
  for(const surface of [lemma,...(e.source_forms??[]).map(f=>f.surface)]){
   const key=normalize(surface);if(!forms.has(key))forms.set(key,new Set());forms.get(key).add(lemma);
  }
 }
 const levels=['A1','A2','B1','B2'];
 const categories=new Map(snapshot.categories.map(c=>[c.id,c]));
 const groups=snapshot.groups.map(g=>({...g,title:categories.get(g.category_id)?.name??g.title})).sort((a,b)=>levels.indexOf(a.level)-levels.indexOf(b.level)||a.position-b.position||a.id-b.id);
 const owners=new Map(groups.filter(g=>g.category_id).map((g)=>[g.category_id,groups.indexOf(g)]));
 const memberships=new Map();
 for(const cat of snapshot.categories){
  const seen=new Set(), ranks=[];let id=cat.id;
  while(id&&categories.has(id)&&!seen.has(id)){seen.add(id);if(owners.has(id))ranks.push(owners.get(id));id=categories.get(id).parent_id;}
  if(id&&seen.has(id))throw Error(`Category cycle ${cat.id}`);
  memberships.set(cat.id,ranks);
 }
 const links=new Map();for(const l of snapshot.links){if(!links.has(l.word_id))links.set(l.word_id,[]);links.get(l.word_id).push(l.category_id);}
 const exact=new Map(),lemmas=new Map();
 function add(map,key,rank,entry){
  if(!map.has(key))map.set(key,{rank,examples:[]});const value=map.get(key);
  if(rank<value.rank){value.rank=rank;value.examples=[];}
  if(rank===value.rank&&value.examples.length<3&&!value.examples.some(x=>x.id===entry.id))value.examples.push(entry);
 }
 for(const word of snapshot.words){
  const cats=links.get(word.id)??[], ranks=cats.flatMap(c=>memberships.get(c)??[]);
  const rank=ranks.length?Math.min(...ranks):Infinity;
  const entry={id:word.id,word:word.word,categories:cats};
  for(const token of new Set(tokens(word.word))){
   add(exact,token,rank,entry);
   const candidates=[...(forms.get(token)??[])];
   if(candidates.length===1)add(lemmas,candidates[0],rank,entry);
  }
 }
 const cache=new Map();
 function match(key,position){
  const cacheKey=position+':'+key;if(cache.has(cacheKey))return cache.get(cacheKey);
  const direct=exact.get(key), candidates=[...(forms.get(key)??[])];
  let found=direct,method=direct?'exact':'unmatched',lemma=null;
  if(candidates.length===1){const byLemma=lemmas.get(candidates[0]);if(byLemma&&(!found||byLemma.rank<found.rank)){found=byLemma;method='corpus_form';lemma=candidates[0];}}
  let bucket=found?(found.rank<position?'prior':found.rank===position?'current':Number.isFinite(found.rank)?'future':'outside'):candidates.length>1?'ambiguous':'unmatched';
  // A future exact form does not resolve whether an ambiguous earlier lemma was taught.
  if((!found||found.rank>position)&&candidates.length>1&&candidates.some(l=>(lemmas.get(l)?.rank??Infinity)<=position))bucket='ambiguous';
  const result={bucket,method,lemma,candidates:candidates.length>1?candidates:[],first_group:found&&Number.isFinite(found.rank)?groups[found.rank].id:null,dictionary_examples:found?.examples??[]};
  cache.set(cacheKey,result);return result;
 }
 return {groups,match,exact,forms};
}

export function extractParts(config,reference=null){
 const body=[],questions=[],target=[];let mixed=0;
 const add=(list,label,value,allowMixed=false)=>{if(typeof value!=='string'||!value.trim())return;if(/\p{Script=Cyrillic}/u.test(value)&&!allowMixed){mixed++;return;}if(tokens(value).length)list.push({label,text:value});};
 if(config.dialogue_segments?.length)config.dialogue_segments.forEach((s,i)=>add(body,`Реплика ${i+1}`,s.text));
 else add(body,'Диалог',config.transcript?.replace(/^[AB]:\s*/gm,''));
 add(body,'Текст',config.text);if(config.task_kind!=='ru_to_lv')add(body,'Исходный текст',config.source_text);
 add(body,'Инструкция',config.instruction);add(body,'Вопрос',config.prompt);
 for(const [i,q] of (config.questions??[]).entries()){
  add(questions,`Вопрос ${i+1}`,q.prompt??q.statement,true);
  for(const v of q.options??[])add(questions,'Вариант ответа',v,true);
  for(const v of q.tokens??[])add(questions,'Слово для составления',v,true);
  // Equivalent accepted punctuation variants are not separate expected answers.
  if(q.accepted_answers?.length)add(target,`Эталон ${i+1}`,q.accepted_answers[0]);
 }
 if(config.task_kind==='ru_to_lv')add(target,'Эталон перевода',config.reference_translation??reference?.text);
 return {body,questions,input:[...body,...questions],target,mixed};
}

export function measure(parts,lexicon,position){
 const counts=new Map();for(const part of parts)for(const token of tokens(part.text))counts.set(token,(counts.get(token)??0)+1);
 const buckets={prior:0,current:0,future:0,outside:0,ambiguous:0,unmatched:0};
 const words=[...counts].map(([word,count])=>{const m=lexicon.match(word,position);buckets[m.bucket]+=count;return {word,count,...m};});
 const total=[...counts.values()].reduce((a,b)=>a+b,0),uncovered=total-buckets.prior-buckets.current;
 const uniqueUncovered=words.filter(w=>!['prior','current'].includes(w.bucket)).length;
 return {total,unique:counts.size,uncovered,uncovered_percent:percent(uncovered,total),unique_uncovered:uniqueUncovered,unique_uncovered_percent:percent(uniqueUncovered,counts.size),buckets,words};
}

export function auditPath(snapshot,corpus,references={}){
 const lex=buildLexicon(snapshot,corpus),pages=new Map(snapshot.pages.map(p=>[p.id,p])),blocks=new Map(snapshot.blocks.map(b=>[b.id,b]));
 const byPage=new Map(),byBlock=new Map();for(const b of snapshot.blocks){if(!byPage.has(b.lesson_page_id))byPage.set(b.lesson_page_id,[]);byPage.get(b.lesson_page_id).push(b);}
 for(const v of snapshot.variants){if(!byBlock.has(v.lesson_block_id))byBlock.set(v.lesson_block_id,[]);byBlock.get(v.lesson_block_id).push(v);}
 const rows=[],issues=[];
 for(const [position,group] of lex.groups.entries()){
  for(const page of snapshot.pages.filter(p=>p.course_group_id===group.id)){
   for(const block of (byPage.get(page.id)??[]).sort((a,b)=>a.position-b.position||a.id-b.id)){
    const source=blocks.get(block.source_block_id||block.id),sp=pages.get(source?.lesson_page_id);
    if(!source||!sp||(block.source_block_id&&(block.type!=='grammar'||source.type!=='grammar'||source.source_block_id||sp.skill!=='grammar'))){issues.push({page:page.slug,block:block.id,issue:'Unavailable source'});continue;}
    const variants=(byBlock.get(source.id)??[]).sort((a,b)=>a.position-b.position||a.id-b.id);
    if(variants.length!==5)issues.push({page:page.slug,block:block.id,issue:`Actual variant count: ${variants.length}`});
    for(const [variantIndex,variant] of (variants.length?variants:[null]).entries()){
     const config=parse(variant?.config??source.config),parts=extractParts(config,references[variant?.id]);
     const row={id:`${group.id}/${block.id}/${variant?.id??'base'}`,group_id:group.id,group_position:position,category_id:group.category_id,level:group.level,group_title:group.title,skill:page.skill,page:page.slug,block_id:block.id,block_title:block.title,source_block_id:source.id,variant_id:variant?.id??null,variant:variantIndex+1,variant_count:variants.length,title:variant?.title??block.title,task_kind:config.task_kind??block.type,mixed_instructions_skipped:parts.mixed,reference:references[variant?.id]?.path??null,metrics:{}};
     for(const scope of ['body','questions','input','target'])row.metrics[scope]=measure(parts[scope],lex,position);
     row.status=row.metrics.input.total?'measurable':row.metrics.target.total?'target_only':'no_fixed_latvian_text';
     row.parts=parts;rows.push(row);
    }
   }
  }
 }
 const controls=lex.groups.map((g,i)=>({group_id:g.id,words_available:[...lex.exact.values()].filter(w=>w.rank<=i).length}));
 return {schema_version:1,created_at:new Date().toISOString(),snapshot_created_at:snapshot.created_at,source:snapshot.source,dictionary_id:snapshot.dictionary_id,groups:lex.groups,rows,issues,controls,
  methodology:['Published group order: A1, A2, B1, B2; position and id. Earlier levels remain available.',
   'All Latin word occurrences in dictionary entries, including words inside phrases and nested categories. No translations or personal mastery.',
   'Primary percentage: occurrences not confirmed in current/prior dictionary / all Latin word occurrences. Unique forms are reported separately.',
   'Exact forms plus unambiguous E-Laipa morphology on both dictionary and exercise sides. No guessed endings. Ambiguous is not confirmed knowledge.',
   'E-Laipa supplies morphology only, never adds taught vocabulary. Names and function words are not excluded; numbers are excluded.',
   'Input includes learner text, statements, choices and ordering tokens; excludes answers, explanations, speaker names/labels and private tutor prompts.',
   'Russian/mixed general instructions are not translated or counted. Latin text within mixed question prompts is counted. Fixed Latvian reference outputs are separate; open responses cannot be estimated from prompts.',
   'Not a difficulty or CEFR score. A missing morphology form can inflate the percentage.']};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [snapshotPath,corpusPath,referencesPath,output]=process.argv.slice(2);
 if(!output||!path.resolve(output).startsWith(path.resolve('.tmp')+path.sep)||existsSync(output))throw Error('New output path must be inside .tmp');
 const read=p=>JSON.parse(readFileSync(p,'utf8'));
 const report=auditPath(read(snapshotPath),read(corpusPath),read(referencesPath));
 report.source_hashes=Object.fromEntries([snapshotPath,corpusPath,referencesPath].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
 mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report),{flag:'wx'});
 console.log(JSON.stringify({groups:report.groups.length,variants:report.rows.length,measurable:report.rows.filter(r=>r.status==='measurable').length,target_only:report.rows.filter(r=>r.status==='target_only').length,no_fixed_text:report.rows.filter(r=>r.status==='no_fixed_latvian_text').length,issues:report.issues}));
}
