import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const code = ts.transpileModule(await readFile(new URL('./AvatarAudioProbe.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { AvatarAudioProbe } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(t, { tracksReady = true, supported = true, captureFails = false } = {}) {
  const warnings = [], seen = [], connections = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(message);
  t.after(() => { console.warn = originalWarn; });
  let stops = 0, closes = 0, captures = 0, resumes = 0;
  const track = { stop: () => { stops++; } };
  let tracks = tracksReady ? [track] : [];
  const stream = new EventTarget();
  stream.getTracks = stream.getAudioTracks = () => tracks;
  const source = { connect: destination => connections.push(destination), disconnect: () => {} };
  const analyser = { disconnect: () => {} };
  const context = new EventTarget();
  context.state = 'suspended';
  context.resume = () => { resumes++; context.state = 'running'; return Promise.resolve(); };
  context.close = () => { closes++; context.state = 'closed'; return Promise.resolve(); };
  context.createAnalyser = () => analyser;
  context.createMediaStreamSource = captured => { assert.equal(captured, stream); return source; };
  context.createMediaElementSource = () => { assert.fail('native playback must never be rerouted'); };
  const element = {
    src: 'data:audio/mpeg;base64,example',
    play: () => assert.fail('probe must not start playback'),
    pause: () => assert.fail('probe must not pause playback'),
  };
  for (const property of ['muted', 'volume', 'crossOrigin', 'srcObject']) {
    Object.defineProperty(element, property, { set: () => assert.fail(`probe must not change ${property}`) });
  }
  if (supported) element.captureStream = () => {
    captures++;
    if (captureFails) throw new Error('capture is blocked');
    return stream;
  };
  const probe = new AvatarAudioProbe({ createContext: () => context, onAnalyser: value => seen.push(value) });
  t.after(() => probe.dispose());
  return {
    probe, element, context, analyser, connections, seen, warnings,
    counts: () => ({ stops, closes, captures, resumes }),
    addTrack: () => { tracks = [track]; stream.dispatchEvent(new Event('addtrack')); },
  };
}

test('unlocks synchronously in the click and analyses captured playback without rerouting or duplicating sound', async t => {
  const h = setup(t);
  h.probe.unlock();
  assert.equal(h.counts().resumes, 1);
  h.probe.attach(h.element);
  await flush();
  assert.equal(h.counts().captures, 1);
  assert.deepEqual(h.connections, [h.analyser]);
  assert.equal(h.seen.at(-1), h.analyser);
  h.probe.detach();
  assert.equal(h.seen.at(-1), null);
  assert.equal(h.counts().stops, 1);
  h.probe.dispose(); h.probe.dispose();
  assert.equal(h.counts().closes, 1);
});

test('missing captureStream and capture failures leave native playback untouched and emit a diagnostic', async t => {
  for (const options of [{ supported: false }, { captureFails: true }]) {
    const h = setup(t, options);
    h.probe.unlock();
    h.probe.attach(h.element);
    await flush();
    assert.equal(h.connections.length, 0);
    assert.equal(h.seen.at(-1), null);
    assert.equal(h.warnings.length, 1);
    assert.ok(!h.warnings[0].includes(h.element.src));
    h.probe.dispose();
  }
});

test('remote audio is not captured and its CORS settings are never changed', async t => {
  const h = setup(t);
  h.element.src = 'https://example.com/private-audio.mp3';
  h.probe.unlock(); h.probe.attach(h.element);
  await flush();
  assert.equal(h.counts().captures, 0);
  assert.equal(h.connections.length, 0);
});

test('late captured tracks are connected, but no new analysis starts after disposal', async t => {
  const h = setup(t, { tracksReady: false });
  h.probe.unlock(); h.probe.attach(h.element);
  await flush();
  assert.equal(h.connections.length, 0);
  h.addTrack();
  assert.equal(h.seen.at(-1), h.analyser);
  h.probe.dispose();
  const callbacks = h.seen.length;
  h.addTrack(); h.probe.unlock(); h.probe.attach(h.element);
  assert.equal(h.seen.length, callbacks);
  assert.equal(h.connections.length, 1);
});

test('a suspended analysis context only clears lip sync and can resume its existing graph', async t => {
  const h = setup(t);
  h.probe.unlock(); h.probe.attach(h.element);
  await flush();
  h.context.state = 'suspended'; h.context.dispatchEvent(new Event('statechange'));
  assert.equal(h.seen.at(-1), null);
  h.context.state = 'running'; h.context.dispatchEvent(new Event('statechange'));
  assert.equal(h.seen.at(-1), h.analyser);
  assert.equal(h.connections.length, 1);
});

test('blocked or pending resume never delays native playback or creates resources after disposal', async t => {
  const h = setup(t);
  let complete;
  h.context.resume = () => new Promise(resolve => { complete = resolve; });
  h.probe.unlock(); h.probe.attach(h.element);
  h.probe.dispose(); complete();
  await flush();
  assert.equal(h.counts().captures, 0);
  assert.equal(h.connections.length, 0);
  const blocked = setup(t);
  blocked.context.resume = () => Promise.reject(new Error('not allowed'));
  blocked.probe.unlock(); blocked.probe.attach(blocked.element);
  await flush();
  assert.equal(blocked.counts().captures, 0);
  assert.equal(blocked.warnings.length, 1);
});
