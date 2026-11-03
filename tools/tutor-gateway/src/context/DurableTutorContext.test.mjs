import test from 'node:test';
import assert from 'node:assert/strict';
import { DurableTutorContext } from './DurableTutorContext.mjs';
import { TutorContextBuilder } from './TutorContextBuilder.mjs';

function fixture(count = 0) {
  const db = { messages: Array.from({ length: count }, (_, i) => ({ id: i + 1, role: i % 2 ? 'assistant' : 'user', text: `message ${i + 1}` })), state: {}, revision: 0, keys: new Map(), saves: 0 };
  const api = async (action, data) => {
    assert.equal(data.conversation_id, 7);
    if (action === 'load') {
      const messages = db.messages.filter(m => m.id > Math.max(data.after_id, db.state.summary_through_id || 0));
      return { state: structuredClone(db.state), revision: db.revision, messages: messages.slice(0, 100), has_more: messages.length > 100 };
    }
    if (action === 'message') {
      if (!db.keys.has(data.client_key)) {
        db.messages.push({ id: db.messages.length + 1, role: data.role, text: data.text });
        db.keys.set(data.client_key, db.messages.length);
      }
      return { message_id: db.keys.get(data.client_key) };
    }
    assert.equal(action, 'save');
    if (data.revision !== db.revision) throw new Error('conflict');
    db.state = structuredClone(data.state);
    db.saves++;
    return { revision: ++db.revision };
  };
  const create = () => {
    const builder = new TutorContextBuilder();
    return { builder, durable: new DurableTutorContext({ conversationId: 7, builder, api }) };
  };
  return { db, create, api };
}

test('reconnect restores full long messages, summary, task and tool outcomes but never executes a tool', async () => {
  const { db, create } = fixture();
  const a = create();
  await a.durable.load();
  await a.durable.append('user', 'x'.repeat(10000), 'a:user');
  await a.durable.append('assistant', 'answer', 'a:assistant');
  a.builder.setLessonContext({ topic: 'Task', text: 'Current exercise', format: 'speaking' });
  a.builder.addToolInteraction({ command: 'navigate', result: { ok: true, to: '/grammar' } });
  await a.durable.save();
  const b = create();
  await b.durable.load();
  assert.equal(b.builder.messages[0].text.length, 10000);
  assert.equal(b.builder.lessonContext.topic, 'Task');
  assert.equal(b.builder.toolInteractions[0].result.to, '/grammar');
  await b.durable.append('user', 'x'.repeat(10000), 'a:user');
  assert.equal(db.messages.length, 2);
  assert.equal(b.builder.messages.length, 2);
});

test('all historical pages are covered once by incremental summaries; archive remains intact', async () => {
  const { db, create } = fixture(245);
  const { durable, builder } = create();
  const covered = [];
  await durable.load({ compress: async () => {
    while (builder.messagesForCompression().length >= 20) {
      const messages = builder.messagesForCompression();
      covered.push(...messages.map(m => m.id));
      builder.applyCompressedSummary(`covered through ${messages.at(-1).id}`, { messagesCompressed: messages.length });
      await durable.save();
    }
  } });
  assert.deepEqual(covered, Array.from({ length: 220 }, (_, i) => i + 1));
  assert.equal(builder.messages.length, 25);
  assert.equal(db.state.summary_through_id, 220);
  assert.equal(db.messages.length, 245);
  const reconnected = create();
  await reconnected.durable.load();
  assert.equal(reconnected.builder.contextSummary, 'covered through 220');
  assert.deepEqual(reconnected.builder.messages.map(m => m.id), Array.from({ length: 25 }, (_, i) => i + 221));
});

test('opening a long conversation does not call a model or silently discard older messages', async () => {
  const { create, db } = fixture(300);
  const { durable, builder } = create();
  await durable.load({ initialOnly: true });
  assert.equal(durable.hasMore, true);
  assert.equal(builder.messages[0].id, 1);
  assert.equal(db.saves, 0);
});

test('concurrent sessions cannot overwrite a newer checkpoint', async () => {
  const { create } = fixture(2);
  const a = create(), b = create();
  await a.durable.load();
  await b.durable.load();
  await a.durable.save();
  await assert.rejects(b.durable.save(), /conflict/);
});

test('warm restore authorizes in DB and appends only new messages without rewriting the journal', async () => {
  const { db, api, create } = fixture(20), first = create();
  await first.durable.load();
  const resume = first.durable.resumeSnapshot();
  await first.durable.append('user', 'new after cursor', 'new');
  const reads = [], builder = new TutorContextBuilder();
  builder.setCurrentPage('/new-page');
  const durable = new DurableTutorContext({ conversationId: 7, builder, api: (action, data) => { if (action === 'load') reads.push(data.after_id); return api(action, data); } });
  await durable.load({ resume, initialOnly: true });
  assert.deepEqual(reads, [20]);
  assert.deepEqual(builder.messages.map(row => row.id), Array.from({ length: 21 }, (_, i) => i + 1));
  assert.equal(builder.currentPage, '/new-page'); assert.equal(db.saves, 0);
  assert.equal(first.builder.messages[0].text, builder.messages[0].text);
  builder.messages[0].text = 'isolated'; assert.notEqual(resume.messages[0].text, 'isolated');
});

test('checkpoint changes discard cached messages and fetch the new authoritative prefix', async () => {
  const { db, api, create } = fixture(30), first = create();
  await first.durable.load();
  const resume = first.durable.resumeSnapshot();
  db.revision++; db.state = { summary: 'canonical summary', summary_through_id: 20 };
  const reads = [], builder = new TutorContextBuilder();
  const durable = new DurableTutorContext({ conversationId: 7, builder, api: (action, data) => { if (action === 'load') reads.push(data.after_id); return api(action, data); } });
  await durable.load({ resume, initialOnly: true });
  assert.deepEqual(reads, [30, 0]); assert.equal(builder.contextSummary, 'canonical summary');
  assert.deepEqual(builder.messages.map(row => row.id), Array.from({ length: 10 }, (_, i) => 21 + i));
});

test('an unauthorized warm resume exposes no cached messages and performs no writes', async () => {
  const { create } = fixture(2), first = create(); await first.durable.load();
  const builder = new TutorContextBuilder(), calls = [];
  const denied = new DurableTutorContext({ conversationId: 7, builder, api: async action => { calls.push(action); throw Error('forbidden'); } });
  await assert.rejects(denied.load({ resume: first.durable.resumeSnapshot() }), /forbidden/);
  assert.deepEqual(builder.messages, []); assert.deepEqual(calls, ['load']);
});

test('a failed checkpoint save cannot cache a journal whose compacted prefix exists only in RAM', async () => {
  const { api, db } = fixture(30), builder = new TutorContextBuilder();
  const durable = new DurableTutorContext({ conversationId: 7, builder, api: async (action, data) => {
    if (action === 'save') throw Error('write unavailable'); return api(action, data);
  } });
  await durable.load();
  builder.summaryThroughId = 20; builder.contextSummary = 'not saved'; builder.messages = builder.messages.filter(row => row.id > 20);
  await assert.rejects(durable.save(), /write unavailable/);
  assert.equal(durable.resumeSnapshot(), null); assert.equal(db.messages.length, 30);
  await durable.load();
  assert.equal(builder.messages.length, 30); assert.equal(builder.contextSummary, '');
  assert(durable.resumeSnapshot());
});

test('failed summary never advances the durable cutoff; cancellation stops historical hydration', async () => {
  const { create, db } = fixture(250);
  const { durable, builder } = create();
  await assert.rejects(durable.load({ compress: async () => { throw new Error('provider down'); } }), /provider down/);
  assert.equal(db.state.summary_through_id, undefined);
  assert.equal(db.messages.length, 250);
  assert.equal(builder.messages[0].id, 1);
  await durable.load({ isActive: () => false });
  assert.equal(builder.messages.length, 0);
});

test('durable context does not let a longer stale browser history replace restored server messages', async () => {
  const { create } = fixture(2);
  const { durable, builder } = create();
  await durable.load();
  assert.equal(builder.build({ clientRecentContext: ['wrong', 'wrong', 'wrong'] }).recentContextSource, 'gateway');
});

test('an explicit cleared lesson stays cleared after reloading an old checkpoint', async () => {
  const { create, db } = fixture();
  db.state = { lesson_context: { topic: 'Finished task', text: 'Old lesson' } };
  const { durable, builder } = create();
  await durable.load();
  assert.equal(builder.lessonContext.topic, 'Finished task');
  builder.setLessonContext(null);
  await durable.load();
  assert.equal(builder.lessonContext, null);
});
