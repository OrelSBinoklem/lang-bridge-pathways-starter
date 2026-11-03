import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { defaultFlow, validateGraph } from '../../../../../resources/tutor-flow/graph.mjs';
import * as contract from '../../../../../resources/tutor-flow/transcription-contract.mjs';

const js = ts.transpileModule(fs.readFileSync(new URL('./runtimePipeline.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
const output = {};
const inspection = {};
new Function('exports', ts.transpileModule(fs.readFileSync(new URL('./promptInspection.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText)(inspection);
new Function('require', 'exports', js)(name => { if (name === './promptInspection') return inspection; assert(name.endsWith('transcription-contract.mjs')); return contract; }, output);
const { runtimePipeline, runtimeData, runtimeId } = output;
const card = (view, id) => runtimeData(view.cards.find(node => node.id === runtimeId(id)));
const tariff = (dual = false) => ({ id: 'standard', name: 'Простой', config: { transcriptionModel: 'gpt-transcribe', primaryTranscriptionLanguage: 'lv', secondaryTranscriptionModel: 'gpt-4o-transcribe', secondaryTranscriptionLanguage: 'ru', dualTranscriptionEnabled: dual } });

test('existing stages show both tariff modes while the real saved graph and its provider path stay immutable', () => {
  const graph = defaultFlow(), before = JSON.stringify(graph);
  for (const dual of [false, true]) {
    const view = runtimePipeline(graph, { tariff: tariff(dual) });
    assert.equal(view.cards.length, 16);
    assert.equal(card(view, 'secondary').disabled, !dual);
    assert.equal(card(view, 'primary').fields.find(([label]) => label === 'Модель')[1], 'gpt-transcribe');
    assert(card(view, 'primary').fields.some(([, value]) => value.includes('lv')));
    assert(card(view, 'secondary').fields.some(([, value]) => value.includes('ru')));
    assert.deepEqual(view.graph.nodes.filter(node => !node.id.startsWith('@runtime.')), graph.nodes);
    // Only the displayed tools→reply wire is expanded into the existing loop;
    // the saved/executed input graph remains untouched.
    assert.deepEqual(view.graph.edges.filter(edge => !edge.id.startsWith('@runtime.')), graph.edges.filter(edge => edge.target !== 'model' && !(edge.source === 'tools' && edge.target === 'reply')));
    assert.equal(JSON.stringify(graph), before);
    assert.deepEqual(validateGraph(graph), graph);
    assert.deepEqual(card(view, 'rules').rules, contract.TRANSCRIPTION_CONTEXT_RULES);
    assert(card(view, 'merge').note.includes('без дополнительного вызова'));
  }
});

test('full prefix cards use gateway inspection without pretending it was sent, and do not leak into old cursors', () => {
  const sections = inspection.PROMPT_SECTIONS.map(section => ({ ...section, role: 'developer', text: `Complete ${section.id}`, characters: 100 }));
  const manifest = { sections, model: 'fixture-model' };
  const view = runtimePipeline(defaultFlow(), { tariff: tariff(), promptManifest: manifest });
  assert.deepEqual(card(view, 'prompt_base').rules, ['Complete base']);
  assert.equal(card(view, 'prompt_base').status, 'Предпросмотр шлюза');
  assert.equal(card(view, 'request').request, undefined);
  assert.equal(view.runtimeEvents.length, 0);
  const old = runtimePipeline(defaultFlow(), { historical: true, promptManifest: manifest });
  assert.equal(card(old, 'prompt_base').rules, undefined);
});

test('request card follows the last complete iteration, preserving roles and cache settings, and marks free previews', () => {
  const body = { model: 'fixture-model', input: [
    { role: 'developer', content: 'All rules' }, { role: 'developer', content: 'Available routes, stable route guide:\nROUTES' },
    { role: 'developer', content: 'Лимит итераций ответа с командами: 6.' }, { role: 'developer', content: 'Conversation is an append-only journal. FORMAT' },
    { role: 'developer', content: 'Graph instruction' }, { role: 'user', content: 'Actual learner turn' },
  ], prompt_cache_key: 'fixture', max_output_tokens: 700 };
  const event = { nodeId: 'model', type: 'model_request', status: 'running', at: 1, inputPreview: JSON.stringify(body) };
  let view = runtimePipeline(defaultFlow(), { historical: true, events: [event] });
  assert.deepEqual(card(view, 'request').request, body);
  assert.deepEqual(card(view, 'prompt_base').rules, ['All rules']);
  const truncated = { ...event, at: 2, inputPreview: '{truncated…' };
  view = runtimePipeline(defaultFlow(), { historical: true, events: [event, truncated] });
  assert.equal(card(view, 'request').request, undefined, 'an incomplete later iteration cannot borrow the older request');
  view = runtimePipeline(defaultFlow(), { selectedRun: true, events: [{ ...event, type: 'model_request_preview', status: 'completed' }] });
  assert(card(view, 'request').status.includes('без модели'));
});

test('the accumulation card counts user rows only and exposes its actual DB and gateway owners', () => {
  const stream = [...Array.from({ length: 20 }, () => [{ role: 'user', text: 'u' }, { role: 'assistant', text: 'a' }]).flat(), { role: 'system', text: 'change', metadata: { kind: 'state_delta' } }, { role: 'user', text: 'current' }];
  const view = runtimePipeline(defaultFlow(), { tariff: tariff(), sources: { message_stream: stream } });
  const journal = card(view, 'journal');
  assert(journal.fields.some(([key, value]) => key === 'Реплик ученика' && value === '21'));
  assert.equal(journal.stream, stream);
  assert(journal.note.includes('tutor_messages')); assert(journal.note.includes('builder.messages'));
  assert.equal(view.runtimeEvents.length, 0, 'a fixture is not an observed execution');
});

test('historical cards use captured settings and keep cursor isolation, with no invented old transcript data', () => {
  const graph = defaultFlow(), candidates = [{ id: 'primary', model: 'actual-primary', language: 'lv', ok: true, text: 'A' }, { id: 'secondary', model: 'actual-secondary', language: 'ru', ok: true, text: 'B' }];
  const sources = { runtime_pipeline: { sourceType: 'user.audio', recognition: { transcriptionModel: 'actual-primary', primaryTranscriptionLanguage: 'lv', secondaryTranscriptionModel: 'actual-secondary', secondaryTranscriptionLanguage: 'ru', dualTranscriptionEnabled: true }, transcriptionRules: contract.TRANSCRIPTION_CONTEXT_RULES }, message_stream: [{ role: 'user', text: 'must not appear before its source event' }] };
  const first = runtimePipeline(graph, { historical: true, sources, tariff: tariff(false), events: [] });
  assert.equal(card(first, 'secondary').disabled, false);
  assert.equal(card(first, 'journal').stream, undefined);
  assert.equal(first.runtimeEvents.length, 0);
  const event = { nodeId: '@recognition', type: 'recognition', status: 'completed', at: 1, outputPreview: JSON.stringify({ candidates, strategy: { mode: 'dual' } }) };
  const next = runtimePipeline(graph, { historical: true, sources, tariff: tariff(false), events: [event] });
  const merge = next.runtimeEvents.find(event => event.nodeId === runtimeId('merge'));
  assert.deepEqual(JSON.parse(merge.outputPreview).candidates, candidates);
  assert.equal(card(next, 'primary').fields[0][1], 'actual-primary');
  assert.equal(card(next, 'journal').stream, undefined);
  const old = runtimePipeline(graph, { historical: true, tariff: tariff(true), events: [] });
  assert(card(old, 'settings').subtitle.includes('не сохранены'));
  assert.equal(card(old, 'primary').fields[0][1], 'Не указано');
});

test('the journal follows compaction only once its real event enters the historical cursor', () => {
  const graph = defaultFlow(), before = Array.from({ length: 21 }, () => ({ role: 'user', text: 'u' })), after = before.slice(-6);
  const event = (nodeId, type, stream) => ({ nodeId, type, status: 'completed', at: 1, outputPreview: JSON.stringify({ parts: { message_stream: stream } }) });
  const initial = event('source_2', 'source', before), compacted = event('compact', 'compact', after);
  const count = view => card(view, 'journal').fields.find(([key]) => key === 'Реплик ученика')[1];
  assert.equal(count(runtimePipeline(graph, { historical: true, events: [initial] })), '21');
  assert.equal(count(runtimePipeline(graph, { historical: true, events: [initial, compacted] })), '6');
  assert.equal(count(runtimePipeline(graph, { historical: true, events: [{ nodeId: 'count_gate', type: 'condition', observed: 21, status: 'completed', at: 1, outputPreview: '{truncated…' }] })), '21');
});

test('browser recognition uses the existing text route and never presents a second paid pass as enabled', () => {
  const view = runtimePipeline(defaultFlow(), { tariff: { id: 'economy', name: 'Эконом', config: { transcriptionModel: 'browser-speech', dualTranscriptionEnabled: true } } });
  assert.equal(card(view, 'secondary').disabled, true);
  assert(card(view, 'text').subtitle.includes('браузерного'));
  assert.equal(card(view, 'primary').code, 'frontend/src/features/tutor/browserSpeech.ts');
});

test('tool loop cards preserve the actual last tool result and stop branch at the historical cursor', () => {
  const result = { hits: [{ text: 'selected excursion' }] };
  const events = [{ nodeId: 'tools', type: 'tool_loop', phase: 'feedback', status: 'completed', iteration: 1, at: 1, outputPreview: result }];
  let view = runtimePipeline(defaultFlow(), { events, historical: true });
  assert.deepEqual(view.runtimeEvents.filter(event => event.nodeId === runtimeId('loop_result')).at(-1).outputPreview, result);
  assert.equal(view.runtimeEvents.filter(event => event.nodeId === runtimeId('loop_decision')).at(-1).branch, true);
  events.push({ nodeId: 'tools', type: 'tool_loop', phase: 'finish', status: 'completed', iteration: 2, at: 2, reason: 'completed', outputPreview: { commands: 1 } });
  view = runtimePipeline(defaultFlow(), { events, historical: true });
  assert.deepEqual(view.runtimeEvents.filter(event => event.nodeId === runtimeId('loop_result')).at(-1).outputPreview, result);
  assert.equal(view.runtimeEvents.filter(event => event.nodeId === runtimeId('loop_decision')).at(-1).branch, false);
});
