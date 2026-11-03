import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('./progressiveProgram.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createProgressiveProgram}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
function fixture({parallel=true,linked=true}={}) {
  const calls=[];let complete=false;
  const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,LINK_STATUS:3,
    getExtension:()=>parallel?{COMPLETION_STATUS_KHR:4}:null,createShader:()=>({}),createProgram:()=>({}),
    shaderSource(){},compileShader(){calls.push('compile');},attachShader(){},linkProgram(){calls.push('link');},
    getProgramParameter(_,key){calls.push(key===4?'poll':'status');return key===4?complete:linked;},
    getUniformLocation(_,name){calls.push('uniform');return {name};},isContextLost:()=>false,
    getProgramInfoLog:()=> 'bad program',getShaderInfoLog:()=> 'bad shader',
    deleteShader(){calls.push('deleteShader');},deleteProgram(){calls.push('deleteProgram');},
  };
  return {gl,calls,complete:()=>{complete=true;}};
}
test('parallel startup never waits for compilation or uniform locations',()=>{
  const f=fixture(),program=createProgressiveProgram(f.gl,'vertex','fragment','test');
  assert.deepEqual(f.calls,['compile','compile','link']);
  assert.equal(program.ready(),false);assert(!f.calls.includes('status'));assert(!f.calls.includes('uniform'));
  f.complete();assert.equal(program.ready(),true);assert.equal(program.ready(),true);
  assert.equal(f.calls.filter(c=>c==='status').length,1);
  assert.equal(program.u('uLP'),program.u('uLP'));assert.equal(f.calls.filter(c=>c==='uniform').length,1);
  program.dispose();program.dispose();assert.equal(f.calls.filter(c=>c==='deleteShader').length,2);assert.equal(f.calls.filter(c=>c==='deleteProgram').length,1);
});
test('browsers without the extension still validate at first use',()=>{
  const f=fixture({parallel:false}),program=createProgressiveProgram(f.gl,'v','f','test');
  assert(!f.calls.includes('status'));assert.equal(program.ready(),true);program.dispose();
});
test('compile errors are diagnosed once, not silently hidden or polled forever',()=>{
  const f=fixture({linked:false}),program=createProgressiveProgram(f.gl,'v','f','test'),errors=[];
  const original=console.error;console.error=(...args)=>errors.push(args);
  try{f.complete();assert.equal(program.ready(),false);assert.equal(program.failed(),true);assert.equal(program.ready(),false);assert.equal(errors.length,1);}
  finally{console.error=original;program.dispose();}
});
test('pending compilation can be disposed without querying its status',()=>{
  const f=fixture(),program=createProgressiveProgram(f.gl,'v','f','test');program.dispose();
  assert(!f.calls.includes('status'));assert.equal(program.ready(),false);
});
