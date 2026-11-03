import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPlan,cleanText,pronunciation} from './english-audio-plan.mjs';
import {reviewTranscript,normalizeTranscript} from './english-audio-review.mjs';

test('editorial import debris and spelling alternatives are not pronounced',()=>{
 for(const [source,spoken] of [['OK exclam., adj./ (adverb)','OK'],['one number/ (pronoun)','one'],
  ['castle n. B2 casual (adjective)','casual'],['content2 (adjective)','content'],['favorite/favourite (adjective)','favorite'],
  ['delighted  B2 (adjective)','delighted'],['look forward to','look forward to']])assert.equal(cleanText(source),spoken);
});
test('numeric transcription and common spelling variants are accepted without hiding wrong numbers',()=>{
 assert.equal(normalizeTranscript('twenty-one'),normalizeTranscript('21'));
 assert.equal(normalizeTranscript('fourth'),normalizeTranscript('4th'));
 assert.notEqual(normalizeTranscript('thirteen'),normalizeTranscript('thirty'));
 assert.equal(normalizeTranscript('neighbor'),normalizeTranscript('neighbour'));
 assert.notEqual(normalizeTranscript('super'),normalizeTranscript('supper'));
});
test('different pronunciations never collapse, identical copies do',()=>{
 const words=[{id:1,word:'record',type:'noun'},{id:2,word:'record (verb)',type:'verb'},
  {id:3,word:'record',type:'noun'},{id:4,word:'live',type:'verb'},{id:5,word:'live',type:'adjective'},
  {id:6,word:'IT',type:'noun'},{id:7,word:'it',type:'pronoun'}].map(w=>({...w,dictionary_id:31,learn_lang:'EN'}));
 const plan=buildPlan({words});
 assert.equal(plan.jobs.length,6);
 assert.equal(plan.records[0].job_id,plan.records[2].job_id);
 assert.notEqual(plan.records[0].job_id,plan.records[1].job_id);
 assert.notEqual(plan.records[3].job_id,plan.records[4].job_id);
 assert.notEqual(plan.records[5].job_id,plan.records[6].job_id);
 assert.equal(pronunciation({word:'read',type:'verb',info:'read /riːd/ — read /red/ — read /red/.'}).variant,'present');
});
test('review ignores spelling punctuation but catches extras, wrong words and artifacts',()=>{
 const job={id:'x',text:'hello'};
 assert.deepEqual(reviewTranscript(job,{text:'Hello.',issue:''}).problems,[]);
 assert.deepEqual(reviewTranscript(job,{text:'Hello hello',issue:''}).problems,['transcript_mismatch']);
 assert.deepEqual(reviewTranscript(job,{text:'yellow',issue:''}).problems,['transcript_mismatch']);
 assert.deepEqual(reviewTranscript(job,{text:'hello',issue:'clipped'}).problems,['audio_issue']);
 assert.deepEqual(reviewTranscript({...job,hint:'pronunciation'},{text:'hello',ipa:''}).problems,['missing_pronunciation_observation']);
 assert.deepEqual(reviewTranscript({id:'n',text:'increase',variant:'nominal',hint:'first stress'},{text:'increase',ipa:'ɪnˈkriːs'}).problems,['pronunciation_needs_review']);
 assert.deepEqual(reviewTranscript({id:'n',text:'increase',variant:'nominal',hint:'first stress'},{text:'increase',ipa:'ˈɪnˌkriːs'}).problems,[]);
});
