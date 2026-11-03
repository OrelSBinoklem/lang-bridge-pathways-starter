import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { buildJobs, boundedTourPreflight } from '../../../../tools/tour/generate-tour-voice.mjs';

const root = new URL('../../../../', import.meta.url);
const source = JSON.parse(await readFile(new URL('resources/tour/grammar-tour.json', root), 'utf8'));
const require = createRequire(new URL('../../../package.json', import.meta.url));
const ts = require('typescript');
const code = ts.transpileModule(await readFile(new URL('./grammarTourSteps.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;

function fixture() {
  const events = [], shows = [], attrs = new Map();
  const rect = () => ({ left: 40, top: 140, right: 440, bottom: 440, width: 400, height: 300 });
  const cells = Array.from({ length: 3 }, () => ({ getBoundingClientRect: rect }));
  const table = { querySelectorAll: () => cells, getBoundingClientRect: rect };
  const card = { isConnected: true, dataset: { id: 'example', tableKey: 'example-key' }, getBoundingClientRect: rect,
    querySelector: () => table, querySelectorAll: () => [table],
    setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key) };
  const exports = {};
  vm.runInNewContext(code, { exports, innerWidth: 1440, innerHeight: 900,
    document: { querySelectorAll: selector => selector === '[data-grammar-tour="card"]' ? [card] : [] },
    window: { dispatchEvent: event => events.push(event) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    require: name => {
      if (name.endsWith('grammar-tour.json')) return source;
      if (name.includes('characterRuntime')) return { showGrammarCharacter: value => shows.push(value) };
      if (name === './tourRunner') return { TOUR_LAYER: 100000 };
      throw Error(name);
    },
  });
  return { definition: exports.createGrammarTourDefinition(), events, shows, attrs, cells };
}

test('grammar demo reveals real cells without clearing the search and cleans up on exit', () => {
  const { definition, events, shows, attrs, cells } = fixture();
  definition.beforeStep({ key: 'progress' }, 'ru');
  assert(attrs.has('data-tour-show-practice'));
  definition.beforeStep({ key: 'octopus' }, 'ru');
  assert(!attrs.has('data-tour-show-practice'));
  assert.equal(events.find(event => event.type === 'grammar.table.reveal').detail.preserveQuery, true);
  assert.equal(shows.length, 1);
  assert.deepEqual([...shows[0].targets], cells);
  definition.cleanup();
  assert(events.some(event => event.type === 'tutor.character.clear'));
  assert.equal(events.at(-1).type, 'grammar.tour.preview');
  assert.equal(events.at(-1).detail.open, false);
  assert.equal(events.at(-1).detail.synchronous, false);
});

test('grammar voice batch is bounded, complete and matches both languages', async () => {
  const jobs = buildJobs(source.lines, 'Fenrir');
  assert.equal(jobs.length, 26);
  assert(boundedTourPreflight(jobs, 1).estimated_batch_usd < 1);
  const manifest = JSON.parse(await readFile(new URL(`frontend/public/audio/tour/${source.release}-fenrir/manifest.json`, root), 'utf8'));
  for (const job of jobs) {
    assert(job.text.length <= 160);
    const clip = manifest.clips[job.key];
    assert.equal(clip.text, job.text);
    assert.equal(clip.voice, 'Fenrir');
    assert(clip.seconds > 1 && clip.seconds < 30);
    const bytes = await readFile(new URL(`frontend/public${clip.url}`, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), clip.file_sha256);
  }
});
