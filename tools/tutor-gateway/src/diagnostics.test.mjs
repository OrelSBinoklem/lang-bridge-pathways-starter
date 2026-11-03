import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createTutorDiagnostics} from './diagnostics.mjs';
import {createBilling} from './billing.mjs';

const root=fileURLToPath(new URL('../../../.tmp/tutor-diagnostic-tests/',import.meta.url));
async function directory(t){await mkdir(root,{recursive:true});const dir=await mkdtemp(path.join(root,'run-'));assert(path.resolve(dir).startsWith(path.resolve(root)+path.sep));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}

test('private file contains allowed timing/usage fields and correlation, never content or credentials',async t=>{
 const dir=await directory(t),diagnostics=createTutorDiagnostics({enabled:true,directory:dir,now:()=>new Date('2026-10-26T10:00:00Z')});
 diagnostics.run({trace_id:'trace-1',connection_id:'connection-1',session:'private-session'},()=>diagnostics.log('provider.completed',{
   model:'gpt-6-sol',input_tokens:1200,output_tokens:50,headers:{Authorization:'private-key'},audio:'private-audio',text:'private-message',message:'private-error',url:'https://example.test/?key=private-key',error_type:'Error',duration_ms:15,
 }));await diagnostics.flush();
 const raw=await readFile(path.join(dir,'tutor-2026-10-26.jsonl'),'utf8'),record=JSON.parse(raw);
 assert.equal(record.trace_id,'trace-1');assert.equal(record.input_tokens,1200);assert.equal(record.duration_ms,15);
 assert(!raw.includes('private-'));assert.equal(record.source,'gateway');
});

test('async traces stay isolated, daily cap applies and retention only removes owned log names',async t=>{
 const dir=await directory(t);await writeFile(path.join(dir,'tutor-2026-10-01.jsonl'),'old');await writeFile(path.join(dir,'keep.log'),'foreign');
 const d=createTutorDiagnostics({enabled:true,directory:dir,maxBytes:200,now:()=>new Date('2026-10-26T10:00:00Z')});
 await Promise.all(['a','b'].map(id=>d.run({trace_id:id},async()=>{await Promise.resolve();d.log('trace.event',{ok:true});})));
 await d.flush();const lines=(await readFile(path.join(dir,'tutor-2026-10-26.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
 assert.equal(lines[0].trace_id,'a');assert(lines.length<=2);assert((await readdir(dir)).includes('keep.log'));assert(!(await readdir(dir)).includes('tutor-2026-10-01.jsonl'));
 const before=(await readFile(path.join(dir,'tutor-2026-10-26.jsonl'),'utf8')).length;d.log('trace.event',{ok:true});await d.flush();assert.equal((await readFile(path.join(dir,'tutor-2026-10-26.jsonl'),'utf8')).length,before);
});

test('a complete metered call is diagnosable without logging billing secrets or model text',async t=>{
 const dir=await directory(t),d=createTutorDiagnostics({enabled:true,directory:dir});
 const billing=createBilling({enabled:true,endpoint:'https://billing.test',secret:'private-key-'.repeat(4),outbox:path.join(dir,'outbox'),diagnostics:d,
   fetchImpl:async(url,init)=>url==='https://billing.test'?Response.json(JSON.parse(init.body).action==='reserve'?{operation:'12345678-1234-1234-1234-123456789012'}:{ok:true}):Response.json({output_text:'private-reply',usage:{input_tokens:100,output_tokens:20}})});
 await d.run({trace_id:'call-trace'},()=>billing.run('private-session',()=>billing.fetch('https://api.openai.com/v1/responses',{body:JSON.stringify({model:'gpt-5.4',input:'private-question'})})));
 await d.flush();const raw=await readFile(path.join(dir,(await readdir(dir)).find(name=>name.endsWith('.jsonl'))),'utf8');
 const events=raw.trim().split('\n').map(JSON.parse);
 for(const name of ['billing.reserve.request','billing.reserved','provider.start','provider.headers','provider.json.completed','billing.settle.request','billing.settle.ack'])assert(events.some(e=>e.event===name));
 assert(events.every(e=>e.trace_id==='call-trace'));assert(!raw.includes('private-'));assert.equal(events.find(e=>e.event==='billing.settle.request').output_tokens,20);
});

test('an unwritable diagnostics destination cannot interrupt billing',async t=>{
 const dir=await directory(t),file=path.join(dir,'file');await writeFile(file,'occupied');
 const d=createTutorDiagnostics({enabled:true,directory:file});d.log('test.event',{ok:true});await d.flush();
 assert.equal(await readFile(file,'utf8'),'occupied');
});
