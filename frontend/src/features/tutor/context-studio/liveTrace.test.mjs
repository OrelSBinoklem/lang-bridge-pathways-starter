import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(file, imports = {}) {
  const result = { exports: {} };
  new Function('require', 'exports', ts.transpileModule(readFileSync(new URL(`./${file}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => { if (!Object.hasOwn(imports, name)) throw Error(name); return imports[name]; }, result.exports);
  return result.exports;
}
const { traceAt, replayInput, requestDiff } = load('liveTraceTypes');
test('historical cursor exposes only events at the selected instant; test copy uses actual captured sources without altering archive', () => {
  const events = [{ nodeId: 'a', status: 'running' }, { nodeId: 'a', type: 'source', status: 'completed', outputPreview: '{"parts":{"parameter_state":{"completed":true}}}' }, { nodeId: 'b', status: 'running' }];
  assert.equal(traceAt(events, 1).length, 1); assert.equal(traceAt(events, -4).length, 0); assert.equal(traceAt(events, 99).length, 3);
  const record = { graph: {}, event: { transcript: 'x' }, sources: { parameter_state: { completed: false } }, events };
  const before = JSON.stringify(record), copy = replayInput(record);
  assert.deepEqual(copy.sources.parameter_state, { completed: true }); assert.equal(JSON.stringify(record), before);
  assert.equal(replayInput({ ...record, graph: null }), null);
  assert.equal(replayInput({ ...record, botId: 'examiner' }), null);
});

test('request comparison detects actual changed fields, bounds huge differences and tolerates text fragments', () => {
  const value = requestDiff('{"model":"a","input":["same","old"]}', '{"model":"a","input":["same","new"]}');
  assert.deepEqual(value.changes.map(change => change.path), ['request.input.1']); assert.equal(value.limited, false);
  const large = requestDiff(JSON.stringify(Array(500).fill('a')), JSON.stringify(Array(500).fill('b')));
  assert.equal(large.changes.length, 100); assert.equal(large.limited, true);
  assert.equal(requestDiff('old text', 'new text').changes.length, 1);
});

test('live monitor freezes the selected snapshot despite in-flight data and unsolicited events; cleanup closes its socket', async () => {
  const previousSocket = globalThis.WebSocket;
  const sockets = [], sent = [], slots = [], cleanup = []; let index = 0;
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(value) { const i = index++; return slots[i] ??= { current: value }; },
    useCallback(callback, dependencies) { const i = index++; if (!slots[i] || dependencies.some((value, j) => value !== slots[i].deps[j])) slots[i] = { deps: dependencies, callback }; return slots[i].callback; },
    useEffect(effect, deps) { const i = index++; if (!slots[i]) { slots[i] = deps; cleanup.push(effect()); } },
  };
  class Socket {
    static OPEN = 1; readyState = 1; constructor() { sockets.push(this); }
    send(text) { sent.push(JSON.parse(text)); }
    close() { this.closed = true; }
    receive(message) { this.onmessage({ data: JSON.stringify(message) }); }
  }
  globalThis.WebSocket = Socket;
  try {
    const { useLiveTrace } = load('useLiveTrace', { react, '@/lib/client-api': { clientApi: async () => ({ ticket: 'fixture' }) }, '../tutor-config': { resolveTutorWsUrl: () => 'ws://fixture' } });
    const Render = () => { index = 0; return useLiveTrace(10, null); };
    let ui = Render(); await Promise.resolve(); const ws = sockets[0]; ws.onopen(); ws.receive({ type: 'session.ready' });
    const answer = (message, data) => ws.receive({ type: 'debug.monitor.result', id: message.id, data });
    const history = { recording: true, runs: [{ id: 'r1' }] }, record = { id: 'r1', events: [{ nodeId: 'a', type: 'source', status: 'completed' }] };
    answer(sent.at(-1), history); await Promise.resolve(); answer(sent.at(-1), record); await Promise.resolve();
    ui = Render(); assert.equal(ui.record.id, 'r1'); assert.equal(ui.frame, 1);
    const refresh = ui.refresh(); answer(sent.at(-1), history); await Promise.resolve();
    const pendingDetail = sent.at(-1); ui.freeze(); answer(pendingDetail, { ...record, events: [...record.events, { nodeId: 'b' }] }); await refresh;
    ui = Render(); assert.equal(ui.record.events.length, 1); assert.equal(ui.following, false);
    const count = sent.length;
    for (let i = 0; i < 100; i++) ws.receive({ type: 'debug.monitor.changed', userId: 10 });
    ui = Render(); assert.equal(sent.length, count); assert.equal(ui.record.events.length, 1); assert.equal(ui.pending, 100);
    ui.step(0); ui = Render(); assert.equal(ui.frame, 0);
    // Inspecting and scrubbing send no model call or command.
    assert(sent.every(message => ['session.authenticate', 'debug.monitor'].includes(message.type)));
    ui.reset(); ui = Render(); assert.equal(ui.record, null); assert.equal(ui.history, null);
  } finally { for (const fn of cleanup) fn?.(); globalThis.WebSocket = previousSocket; assert(sockets.every(socket => socket.closed)); }
});
