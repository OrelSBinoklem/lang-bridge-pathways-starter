import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('./weekBookState.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {WeekBookTurn,WEEK_BOOK_DAYS,selectWeekBookDay,subscribeWeekBook}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const tick=(book,day,n)=>{for(let i=0;i<n;i++)book.step(1/60,day);};

test('all seven days describe distinct places and the book never turns automatically',()=>{
  assert.equal(WEEK_BOOK_DAYS.length,7);assert.equal(new Set(WEEK_BOOK_DAYS.map(d=>d.place)).size,7);
  const book=new WeekBookTurn();tick(book,0,3600);
  assert.equal(book.current,0);assert.equal(book.turning,false);assert.equal(book.rise(0),1);
});
test('figures fold before any sheet turns and rise only after the incoming sheet is flat',()=>{
  const book=new WeekBookTurn();tick(book,4,12);
  assert.ok(book.rise(0)<.1);assert.equal(book.angle(0),0);assert.equal(book.rise(4),0);
  tick(book,4,30);assert.ok(book.angle(0)>0&&book.angle(0)<Math.PI);
  assert.equal(book.rise(0),0);assert.equal(book.rise(4),0);
  tick(book,4,29);assert.equal(book.angle(0),Math.PI);assert.ok(book.rise(4)>0);
  tick(book,4,40);assert.equal(book.current,4);assert.equal(book.rise(4),1);
});
test('backward turns restore the correct sheet stack; rapid requests finish cleanly at the last chosen day',()=>{
  const book=new WeekBookTurn(5);tick(book,1,25);tick(book,6,130);
  tick(book,2,250);assert.equal(book.current,2);assert.equal(book.turning,false);
  for(let i=0;i<7;i++)assert.equal(book.angle(i),i<2?Math.PI:0);
  assert.ok(book.height(1)>book.height(0),'the latest turned sheet is on top of the left stack');
  assert.ok(book.height(2)>book.height(3),'the current day is on top of the right stack');
});
test('reduced motion selects the final unfolded scene immediately, with no half-turned page',()=>{
  const book=new WeekBookTurn();book.step(0,6,true);
  assert.equal(book.current,6);assert.equal(book.rise(6),1);assert.equal(book.turning,false);
  assert.equal(book.angle(5),Math.PI);assert.equal(book.angle(6),0);
});
test('selection stays in the activation store, notifies once and rejects invalid days',()=>{
  const params={weekBookDay:0};let updates=0;const stop=subscribeWeekBook(params,()=>updates++);
  assert.equal(selectWeekBookDay(params,3),true);selectWeekBookDay(params,3);
  for(const value of [-1,7,1.5,NaN])assert.equal(selectWeekBookDay(params,value),false);
  assert.equal(params.weekBookDay,3);assert.equal(updates,1);stop();selectWeekBookDay(params,6);assert.equal(updates,1);
});
