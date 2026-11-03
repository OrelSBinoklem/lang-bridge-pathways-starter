import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('./tutorPcmPlayer.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { TutorPcmPlayer } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function buffer(length = 2400, sampleRate = 24000, value = 0.25) {
  const data = new Float32Array(length).fill(value);
  return { length, sampleRate, numberOfChannels: 1, getChannelData: () => data };
}

function harness(initialState = 'running', callbacks = {}) {
  const timers = new Map();
  const contexts = [];
  const errors = [];
  const first = [];
  let timerId = 0;
  const makeContext = () => {
    const context = {
      state: initialState, currentTime: 0, sampleRate: 24000, destination: {}, sources: [], resumeCalls: 0,
      resume() { this.resumeCalls++; this.state = 'running'; this.onstatechange?.(); return Promise.resolve(); },
      close() { this.state = 'closed'; return Promise.resolve(); },
      createBuffer: (_channels, length, rate) => buffer(length, rate, 0),
      decodeAudioData: async () => buffer(),
      createBufferSource() {
        const node = {
          buffer: null, when: null, stopped: false, disconnected: false, ended: false,
          connect() {}, disconnect() { this.disconnected = true; }, stop() { this.stopped = true; },
          start(when) { this.when = when; },
        };
        this.sources.push(node);
        return node;
      },
    };
    contexts.push(context);
    return context;
  };
  const player = new TutorPcmPlayer({
    ...callbacks,
    createContext: makeContext,
    onFirstPlayback: (id, metadata) => first.push({ id, metadata, time: contexts.at(-1).currentTime }),
    onError: message => errors.push(message),
    setTimer: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimer: id => timers.delete(id),
  });
  const tick = (seconds = 0.02) => {
    const context = contexts.at(-1);
    context.currentTime += seconds;
    for (const node of context.sources) {
      if (!node.ended && !node.stopped && node.when + node.buffer.length / node.buffer.sampleRate <= context.currentTime) {
        node.ended = true;
        node.onended?.();
      }
    }
    const pending = [...timers.values()];
    timers.clear();
    for (const callback of pending) callback();
  };
  return { player, errors, first, contexts, timers, tick, get context() { return contexts.at(-1); } };
}

const start = (streamId = 's0', segmentIndex = 0, playbackId = 'p1') => ({
  type: 'tts.stream.start', streamId, playbackId, sampleRate: 24000, channels: 1, format: 'pcm_s16le', metadata: { segmentIndex },
});
const chunk = (samples = 4800, sequence = 0, streamId = 's0', playbackId = 'p1', value = 8192) => {
  const bytes = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(value, i * 2);
  return { type: 'tts.stream.chunk', streamId, playbackId, sequence, audio: bytes.toString('base64') };
};
const end = (streamId = 's0', playbackId = 'p1') => ({ type: 'tts.stream.end', streamId, playbackId, ok: true });
async function ready() {
  const h = harness();
  h.player.begin('p1');
  await h.player.unlock();
  return h;
}

test('plays after prefill before stream.end, bounded scheduling, first callback follows audio clock', async () => {
  const h = await ready();
  h.player.handle(start());
  h.player.handle(chunk(2400));
  assert.equal(h.context.sources.length, 0);
  h.player.handle(chunk(7200, 1));
  assert.ok(h.context.sources.length > 0);
  assert.equal(h.first.length, 0);
  for (const node of h.context.sources) assert.ok(node.when + node.buffer.length / 24000 <= 1.00001);
  h.tick();
  assert.equal(h.first.length, 1);
  assert.ok(h.first[0].time >= h.context.sources[0].when);
  h.player.handle(end());
  for (let i = 0; i < 20; i++) h.tick();
  assert.equal(h.first.length, 1);
  assert.deepEqual(h.errors, []);
});

test('a 350ms main-thread stall does not put gaps into already buffered speech', async () => {
  const h = await ready();
  h.player.handle(start());
  h.player.handle(chunk(24000 * 2));
  h.player.handle(end());
  h.tick(.35);
  for (let i = 0; i < 90; i++) h.tick();
  const nodes = h.context.sources;
  assert.equal(nodes.reduce((sum, node) => sum + node.buffer.length, 0), 48000);
  for (let i = 1; i < nodes.length; i++) {
    const gap = nodes[i].when - (nodes[i - 1].when + nodes[i - 1].buffer.length / 24000);
    assert.ok(Math.abs(gap) < 1e-8, `Audible scheduling gap: ${gap}`);
  }
  assert.deepEqual(h.errors, []);
});

test('buffered speech is scheduled in coalesced blocks instead of timer-sized fragments', async () => {
  const h = await ready();
  h.player.handle(start());
  h.player.handle(chunk(24000 * 2));
  h.player.handle(end());
  for (let i = 0; i < 120; i++) h.tick();
  assert.ok(h.context.sources.length < 30, `Too many audio boundaries: ${h.context.sources.length}`);
  assert.deepEqual(h.errors, []);
});

test('a packet arriving just before the queued end does not acquire an artificial 10ms gap', async () => {
  const h = await ready();
  h.player.handle(start());
  h.player.handle(chunk(9600));
  h.tick(.405);
  const previous = h.context.sources.at(-1);
  h.player.handle(chunk(9600, 1));
  h.player.handle(end());
  const following = h.context.sources[h.context.sources.indexOf(previous) + 1];
  assert.ok(Math.abs(following.when - (previous.when + previous.buffer.length / 24000)) < 1e-8);
  assert.deepEqual(h.errors, []);
});

test('native context uses PCM sample rate so device resampling stays continuous', async () => {
  const previous = globalThis.AudioContext;
  let options;
  globalThis.AudioContext = class {
    state = 'running';
    constructor(value) { options = value; }
    resume() { return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  };
  try {
    const errors = [];
    const player = new TutorPcmPlayer({ onFirstPlayback() {}, onError: message => errors.push(message) });
    await player.unlock();
    assert.equal(options.sampleRate, 24000);
    assert.equal(options.latencyHint, 'interactive');
    assert.deepEqual(errors, []);
    player.dispose();
  } finally { globalThis.AudioContext = previous; }
});

test('a real stream underrun refills before restarting, preserves samples and resets on a new turn', async () => {
  const h = await ready();
  h.player.handle(start());
  h.player.handle(chunk(9600));
  h.tick(.5);
  const before = h.context.sources.length;
  h.player.handle(chunk(4800, 1));
  assert.equal(h.context.sources.length, before, 'do not stutter on each newly arriving packet');
  h.player.handle(chunk(4800, 2));
  assert.equal(h.context.sources.length, before);
  h.player.handle(chunk(4800, 3));
  assert.ok(h.context.sources.length > before);
  h.player.handle(end());
  for (let i = 0; i < 60; i++) h.tick();
  assert.equal(h.context.sources.reduce((sum, node) => sum + node.buffer.length, 0), 24000);
  h.player.begin('p2');
  h.player.handle(start('new', 0, 'p2'));
  const after = h.context.sources.length;
  h.player.handle(chunk(9600, 0, 'new', 'p2'));
  assert.ok(h.context.sources.length > after, 'a new turn starts with the normal prefill');
  assert.deepEqual(h.errors, []);
});

test('end flushes a segment shorter than prefill, including a one-sample utterance', async () => {
  const h = await ready();
  h.player.handle(start());
  h.player.handle(chunk(1));
  assert.equal(h.context.sources.length, 0);
  h.player.handle(end());
  h.tick();
  assert.equal(h.first.length, 1);
  assert.equal(h.context.sources.length, 1);
});

test('interleaved segment arrivals play in segmentIndex order without overlaps', async () => {
  const h = await ready();
  h.player.handle(start('s1', 1));
  h.player.handle(chunk(4800, 0, 's1', 'p1', 16384));
  h.player.handle(end('s1'));
  assert.equal(h.context.sources.length, 0);
  h.player.handle(start());
  h.player.handle(chunk());
  h.player.handle(end());
  for (let i = 0; i < 30; i++) h.tick();
  const nodes = h.context.sources;
  assert.equal(nodes[0].buffer.getChannelData(0)[0], 0.25);
  assert.equal(nodes.at(-1).buffer.getChannelData(0)[0], 0.5);
  for (let i = 1; i < nodes.length; i++) {
    assert.ok(nodes[i].when + 1e-9 >= nodes[i - 1].when + nodes[i - 1].buffer.length / 24000);
  }
  assert.equal(nodes.reduce((sum, node) => sum + node.buffer.length, 0), 9600);
  assert.equal(h.first.length, 1);
});

test('sequential streams can arrive after the previous stream has fully drained', async () => {
  const h = await ready();
  for (let i = 0; i < 3; i++) {
    h.player.handle(start(`s${i}`, i));
    h.player.handle(chunk(2400, 0, `s${i}`));
    h.player.handle(end(`s${i}`));
    for (let j = 0; j < 10; j++) h.tick();
  }
  assert.equal(h.context.sources.reduce((sum, node) => sum + node.buffer.length, 0), 7200);
  assert.equal(h.first.length, 1);
  assert.equal(h.timers.size, 0);
});

test('stop drops stale streams and queued callbacks even after a new request starts', async () => {
  const h = await ready();
  h.player.handle(start());
  h.player.handle(chunk(9600));
  const callback = [...h.timers.values()][0];
  const ended = h.context.sources[0].onended;
  h.player.stop();
  assert.ok(h.context.sources.every(node => node.stopped && node.disconnected));
  assert.equal(h.timers.size, 0);
  h.player.begin('p2');
  callback();
  ended();
  const count = h.context.sources.length;
  h.player.handle(start());
  h.player.handle(chunk());
  h.player.handle(end());
  h.tick();
  assert.equal(h.context.sources.length, count);
  assert.equal(h.first.length, 0);
  assert.deepEqual(h.errors, []);
});

test('duplicates are dropped and gaps fail visibly without partial reordering', async () => {
  const h = await ready();
  h.player.handle(start());
  h.player.handle(chunk(100, 0));
  h.player.handle(chunk(100, 0));
  h.player.handle(chunk(100, 2));
  assert.equal(h.errors.length, 1);
  assert.equal(h.player.accepts('p1'), false);
  assert.equal(h.context.sources.length, 0);
});

test('odd PCM byte boundaries join correctly and a dangling final byte fails', async () => {
  const h = await ready();
  h.player.handle(start());
  h.player.handle({ ...chunk(0), audio: Buffer.from([0, 128, 255]).toString('base64') });
  h.player.handle({ ...chunk(0, 1), audio: Buffer.from([127]).toString('base64') });
  h.player.handle(end());
  assert.deepEqual([...h.context.sources[0].buffer.getChannelData(0)], [-1, 32767 / 32768]);
  h.player.begin('p1');
  h.player.handle(start());
  h.player.handle({ ...chunk(0), audio: 'AA==' });
  h.player.handle(end());
  assert.equal(h.errors.length, 1);
});

test('cancelled end stops all scheduled sources without reporting a failure', async () => {
  const h = await ready();
  h.player.handle(start());
  h.player.handle(chunk(9600));
  assert.ok(h.context.sources.length > 0);
  h.player.handle({ ...end(), ok: false, cancelled: true });
  assert.ok(h.context.sources.every(node => node.stopped));
  assert.deepEqual(h.errors, []);
});

test('provider error is visible and cancels all queued segments', async () => {
  const h = await ready();
  h.player.handle(start());
  h.player.handle(chunk(9600));
  assert.ok(h.context.sources.length > 0);
  h.player.handle({ ...end(), ok: false, error: { message: 'Provider unavailable' } });
  assert.deepEqual(h.errors, ['Provider unavailable']);
  assert.ok(h.context.sources.every(node => node.stopped));
});

test('unsupported format, unknown stream, invalid base64 and overflow fail explicitly', async () => {
  for (const bad of [
    { ...start(), channels: 2 },
    chunk(20, 0, 'missing'),
    { ...chunk(0), audio: 'not base64!' },
    chunk(24000 * 61),
  ]) {
    const h = await ready();
    if (bad.type !== 'tts.stream.start') h.player.handle(start());
    h.player.handle(bad);
    assert.equal(h.errors.length, 1);
    assert.equal(h.player.accepts('p1'), false);
  }
});

test('unlock calls resume immediately on the gesture, including suspended contexts', async () => {
  const h = harness('suspended');
  h.player.begin('p1');
  const pending = h.player.unlock();
  assert.equal(h.context.resumeCalls, 1);
  await pending;
  h.player.handle(start());
  h.player.handle(chunk(9600));
  assert.ok(h.context.sources.length > 0);
  assert.deepEqual(h.errors, []);
});

test('fast 180-second generation plus queued segments fits, total PCM remains bounded at 300 seconds', async () => {
  const h = await ready();
  h.player.handle(start());
  for (let sequence = 0; sequence < 6; sequence++) h.player.handle(chunk(24000 * 30, sequence));
  h.player.handle(end());
  assert.deepEqual(h.errors, []);
  h.player.handle(start('s1', 1));
  for (let sequence = 0; sequence < 4; sequence++) h.player.handle(chunk(24000 * 30, sequence, 's1'));
  assert.deepEqual(h.errors, []);
  h.player.handle(chunk(24000, 4, 's1'));
  assert.equal(h.errors.length, 1);
  assert.ok(h.context.sources.every(node => node.stopped));
});

test('autoplay denial is visible; rejected resume from a cancelled turn is ignored', async () => {
  const h = await ready();
  h.context.resume = () => Promise.reject(new Error('NotAllowedError'));
  await h.player.unlock();
  assert.equal(h.errors.length, 1);
  h.player.begin('p2');
  let reject;
  h.context.resume = () => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; });
  const pending = h.player.unlock();
  h.player.begin('p3');
  reject(new Error('NotAllowedError'));
  await pending;
  assert.equal(h.errors.length, 1);
  assert.equal(h.player.accepts('p3'), true);
});

test('no gesture, closed context and mid-play suspension do not silently queue audio', async () => {
  const missing = harness();
  missing.player.begin('p1');
  missing.player.handle(start());
  assert.equal(missing.errors.length, 1);
  for (const state of ['closed', 'suspended']) {
    const h = await ready();
    h.player.handle(start());
    h.player.handle(chunk(9600));
    h.context.state = state;
    h.context.onstatechange();
    assert.equal(h.errors.length, 1);
    assert.ok(h.context.sources.every(node => node.stopped));
    h.player.begin('p2');
    await h.player.unlock();
    assert.equal(h.context.state, 'running');
    assert.equal(h.contexts.length, state === 'closed' ? 2 : 1);
  }
});

test('legacy decodes keep arrival order even when promises resolve backwards', async () => {
  const h = await ready();
  const resolves = [];
  h.context.decodeAudioData = () => new Promise(resolve => resolves.push(resolve));
  const one = h.player.playLegacy({ playbackId: 'p1', audio: 'AA==' });
  const two = h.player.playLegacy({ playbackId: 'p1', audio: 'AA==' });
  resolves[1](buffer(2400, 24000, 0.5));
  await two;
  assert.equal(h.context.sources.length, 0);
  resolves[0](buffer());
  await one;
  for (let i = 0; i < 20; i++) h.tick();
  assert.equal(h.context.sources[0].buffer.getChannelData(0)[0], 0.25);
  assert.equal(h.context.sources.at(-1).buffer.getChannelData(0)[0], 0.5);
});

test('late legacy decode success or failure cannot affect a newer playback', async () => {
  for (const fails of [false, true]) {
    const h = await ready();
    let resolve, reject;
    h.context.decodeAudioData = () => new Promise((yes, no) => { resolve = yes; reject = no; });
    const pending = h.player.playLegacy({ playbackId: 'p1', audio: 'AA==' });
    h.player.begin('p2');
    if (fails) reject(new Error('decode failed')); else resolve(buffer());
    await pending;
    assert.equal(h.context.sources.length, 0);
    assert.equal(h.player.accepts('p2'), true);
    assert.deepEqual(h.errors, []);
  }
});

test('dispose stops playback, releases the context and removes timers', async () => {
  const h = await ready();
  h.player.handle(start());
  h.player.handle(chunk(9600));
  h.player.dispose();
  assert.equal(h.context.state, 'closed');
  assert.equal(h.context.onstatechange, null);
  assert.equal(h.timers.size, 0);
  assert.ok(h.context.sources.every(node => node.stopped && node.disconnected));
});

test('avatar speaking state follows actual playback and resets on natural end or cancellation', async () => {
  const states = [];
  const h = harness('running', { onPlaybackState: state => states.push(state) });
  h.player.begin('p1'); await h.player.unlock();
  h.player.handle(start()); h.player.handle(chunk(12000)); h.player.handle(end());
  assert.deepEqual(states, []);
  h.tick(0.02);
  assert.deepEqual(states, [true]);
  h.tick(1);
  assert.deepEqual(states, [true, false]);
  h.player.stop();
  assert.deepEqual(states, [true, false]);
});
