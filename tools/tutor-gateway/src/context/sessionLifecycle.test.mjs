import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

test('real gateway restores a warm conversation through fresh authorization; no paid requests on reconnect', { timeout: 20000 }, async t => {
  const root = fileURLToPath(new URL('../../../../', import.meta.url));
  await mkdir(new URL('../../../../.tmp/master-sessions-20261101/', import.meta.url), { recursive: true });
  const directory = await mkdtemp(fileURLToPath(new URL('../../../../.tmp/master-sessions-20261101/run-', import.meta.url)));
  const reads = [], operations = [];
  let heldPreset;
  const db = { revision: 0, state: {}, messages: [1, 2, 3].map(id => ({ id, role: id % 2 ? 'user' : 'assistant', text: `private history ${id}` })) };
  const api = createServer(async (req, res) => {
    try {
      let body = ''; for await (const chunk of req) body += chunk;
      const data = JSON.parse(body); operations.push(data.action);
      const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
      if (data.action === 'authenticate') return reply(200, { session: data.ticket, user_id: data.ticket.startsWith('owner') ? 1 : 2, is_admin: true });
      if (data.action === 'context.load') {
        reads.push({ session: data.session, after: data.after_id });
        if (!data.session.startsWith('owner') || data.conversation_id !== 7) return reply(403, { message: 'forbidden' });
        const after = Math.max(data.after_id, db.state.summary_through_id || 0);
        return reply(200, { state: db.state, revision: db.revision, has_more: false, messages: db.messages.filter(row => row.id > after) });
      }
      if (data.action === 'presets') { heldPreset = res; return; }
      return reply(500, { message: 'Unexpected operation: paid calls are forbidden in this fixture.' });
    } catch { res.writeHead(500).end(); }
  });
  api.listen(0, '127.0.0.1'); await once(api, 'listening');
  t.after(() => new Promise(resolve => api.close(resolve)));
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['src/server.mjs'], { cwd: root + 'tools/tutor-gateway', windowsHide: true,
    env: { ...process.env, DOTENV_CONFIG_PATH: directory + '/not-present.env', TUTOR_GATEWAY_HOST: '127.0.0.1', TUTOR_GATEWAY_PORT: String(port),
      CREDITS_ENABLED: 'true', CREDITS_API_URL: `http://127.0.0.1:${api.address().port}`, CREDITS_GATEWAY_SECRET: 'fixture-secret-not-a-real-key-12345678',
      TUTOR_DIAGNOSTICS_ENABLED: 'false', TUTOR_TRACE_DIRECTORY: directory + '/traces', OPENAI_API_KEY: 'fixture-not-a-real-key' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit'); } });
  let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  for (let i = 0; i < 120 && !output.includes('listening'); i++) {
    assert.equal(child.exitCode, null, output); await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert(output.includes('listening'), output);
  const clients = [];
  t.after(() => { for (const ws of clients) ws.terminate(); });
  async function connect(ticket) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`); clients.push(ws);
    const messages = []; ws.on('message', data => messages.push(JSON.parse(data)));
    await once(ws, 'open'); ws.send(JSON.stringify({ type: 'session.authenticate', ticket }));
    const wait = async type => {
      for (let i = 0; i < 300; i++) {
        const index = messages.findIndex(row => row.type === type);
        if (index >= 0) return messages.splice(index, 1)[0];
        if (ws.readyState === WebSocket.CLOSED) throw Error('Socket closed: ' + JSON.stringify(messages));
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw Error('Missing event: ' + type + '\n' + output);
    };
    await wait('session.ready');
    ws.send(JSON.stringify({ type: 'client.event', event: 'conversation.changed', payload: { conversation_id: 7, pathname: '/course' } }));
    return { ws, wait, snapshot: async () => { ws.send(JSON.stringify({ type: 'debug.snapshot' })); return wait('debug.snapshot'); }, close: async () => { ws.close(); await once(ws, 'close'); } };
  }
  const a = await connect('owner-first'), readyA = await a.wait('conversation.ready');
  assert.equal(readyA.masterSession.resumed, false);
  assert(JSON.stringify(await a.snapshot()).includes('private history 1'));
  await a.close();
  db.messages.push({ id: 4, role: 'assistant', text: 'new canonical message' });
  const b = await connect('owner-reconnected'), readyB = await b.wait('conversation.ready');
  assert.equal(readyB.masterSession.id, readyA.masterSession.id);
  assert.equal(readyB.masterSession.resumed, true);
  assert.equal(reads.at(-1).after, 3);
  const debug = await b.snapshot();
  assert(JSON.stringify(debug).includes('private history 1'));
  assert(JSON.stringify(debug).includes('new canonical message'));
  assert.equal(debug.masterSession.id, readyB.masterSession.id);
  await b.close();
  db.revision++; db.state = { summary: 'updated checkpoint', summary_through_id: 2 };
  const c = await connect('owner-new-revision'); const readyC = await c.wait('conversation.ready');
  assert.equal(readyC.masterSession.resumed, false, 'invalidated cache is not reported as reused');
  assert.deepEqual(reads.slice(-2).map(row => row.after), [4, 0]);
  const updated = await c.snapshot();
  assert.equal(updated.contextSummary, 'updated checkpoint');
  assert(!JSON.stringify(updated.recentContext).includes('private history 1'));
  await c.close();
  const runningTab = await connect('owner-running'), secondTab = await connect('owner-second-tab');
  await runningTab.wait('conversation.ready'); await secondTab.wait('conversation.ready');
  runningTab.ws.send(JSON.stringify({ type: 'user.message', text: 'fixture request held before any provider', conversationId: 7 }));
  for (let i = 0; i < 100 && !heldPreset; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert(heldPreset, 'first foreground request acquired the conversation before reading config');
  secondTab.ws.send(JSON.stringify({ type: 'user.message', text: 'must not launch parallel paid work', conversationId: 7 }));
  const busy = await secondTab.wait('error'); assert.match(busy.message, /ещё выполняется/);
  assert.equal(operations.filter(action => action === 'presets').length, 1);
  heldPreset.writeHead(503, { 'Content-Type': 'application/json' }); heldPreset.end(JSON.stringify({ message: 'fixture stop before provider' }));
  await runningTab.wait('error'); await runningTab.close(); await secondTab.close();
  const denied = await connect('other-user'); const error = await denied.wait('error');
  assert.equal(error.type, 'error'); assert(!JSON.stringify(error).includes('private history'));
  assert.equal(reads.at(-1).after, 0);
  assert(operations.every(action => ['authenticate', 'context.load', 'presets'].includes(action)), JSON.stringify(operations));
});
