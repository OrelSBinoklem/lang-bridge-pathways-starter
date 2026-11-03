import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLexicon,extractParts,measure,auditPath,tokens} from './audit-path-vocabulary.mjs';

const fixture=()=>({
 groups:[{id:2,category_id:20,level:'A2',position:0},{id:1,category_id:10,level:'A1',position:99}],
 categories:[{id:10,name:'First'},{id:11,parent_id:10},{id:20,name:'Second'},{id:30,name:'Unplaced'}],
 words:[{id:1,word:'Labs darbs'},{id:2,word:'māja'},{id:3,word:'vējš'},{id:4,word:'bankā'},{id:5,word:'darbu'}],
 links:[{word_id:1,category_id:11},{word_id:2,category_id:20},{word_id:3,category_id:30},{word_id:4,category_id:11},{word_id:5,category_id:20}],
 pages:[],blocks:[],variants:[]
});
const corpus={words:{noun:[
 {lemma:'darbs',source_forms:[{surface:'darbu'}]},
 {lemma:'banka',source_forms:[{surface:'bankā'},{surface:'bankas'}]},
 {lemma:'banks',source_forms:[{surface:'bankas'}]}
]}};

test('course order, descendants, phrase tokens, current and cumulative earlier levels',()=>{
 const lex=buildLexicon(fixture(),corpus);
 assert.deepEqual(lex.groups.map(g=>g.id),[1,2]);
 assert.equal(lex.groups[0].title,'First');
 assert.equal(lex.match('labs',0).bucket,'current');
 assert.equal(lex.match('labs',1).bucket,'prior');
 assert.equal(lex.match('māja',0).bucket,'future');
 assert.equal(lex.match('māja',1).bucket,'current');
 assert.equal(lex.match('vējš',1).bucket,'outside');
});
test('unambiguous morphology on both sides precedes future exact form; ambiguity remains visible',()=>{
 const lex=buildLexicon(fixture(),corpus);
 assert.equal(lex.match('darbu',0).bucket,'current');
 assert.equal(lex.match('darbu',0).method,'corpus_form');
 assert.equal(lex.match('banka',0).bucket,'current');
 assert.equal(lex.match('bankas',0).bucket,'ambiguous');
 assert.equal(lex.match('xyz',0).bucket,'unmatched');
});
test('occurrence and unique denominators differ; empty text is not zero percent',()=>{
 const lex=buildLexicon(fixture(),corpus);
 const m=measure([{text:'labs labs māja'}],lex,0);
 assert.equal(m.total,3);assert.equal(m.uncovered_percent,33.3);
 assert.equal(m.unique,2);assert.equal(m.unique_uncovered_percent,50);
 assert.equal(measure([],lex,0).uncovered_percent,null);
 assert.deepEqual(tokens('MĀJA {{blank}} 123 <b>darbs</b>'),['māja','darbs']);
});
test('extracts mixed questions and ordering choices without private metadata or duplicate transcript',()=>{
 const p=extractParts({dialogue_segments:[{speaker:'A',text:'Labs darbs.'}],transcript:'A: Labs darbs.',
  tutor_prompt:'Private secret',instruction:'Объясни тему',questions:[{prompt:'Отрицание: Es (мужчина) {{blank}} profesors.',options:['darbs'],tokens:['labs'],accepted_answers:['darbu','darbu.'],explanation:'Do not count'}]});
 assert.equal(p.body.length,1);
 assert.equal(p.questions.length,3);
 assert.equal(p.target.length,1);
 assert.ok(p.input.some(x=>x.text.includes('profesors')));
 assert.ok(!p.input.some(x=>x.text.includes('secret')||x.text.includes('darbu')));
 const open=extractParts({task_kind:'roleplay',instruction:'Расскажи о семье',tutor_prompt:'Expected Latvian'});
 assert.equal(open.input.length,0);assert.equal(open.target.length,0);
 const translation=extractParts({task_kind:'ru_to_lv',source_text:'Дом'},{text:'māja'});
 assert.equal(translation.input.length,0);assert.equal(translation.target[0].text,'māja');
});
test('audits reused grammar variants in placement context, not canonical page position',()=>{
 const s=fixture();s.pages=[{id:1,skill:'grammar',slug:'first',course_group_id:1},{id:2,skill:'grammar',slug:'canonical',course_group_id:null}];
 s.blocks=[{id:1,lesson_page_id:1,source_block_id:2,type:'grammar',title:'Placement'},{id:2,lesson_page_id:2,type:'grammar'}];
 s.variants=Array.from({length:5},(_,i)=>({id:i+1,lesson_block_id:2,position:i,config:{questions:[{prompt:'māja'}]}}));
 const r=auditPath(s,corpus);
 assert.equal(r.rows.length,5);assert.equal(r.rows[0].metrics.input.uncovered_percent,100);assert.deepEqual(r.issues,[]);
 s.variants.pop();assert.match(auditPath(s,corpus).issues[0].issue,/4/);
});
test('rejects category cycles',()=>{
 const s=fixture();s.categories[0].parent_id=11;
 assert.throws(()=>buildLexicon(s,corpus),/cycle/);
});
