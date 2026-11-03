import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolLoopController } from './ToolLoopController.mjs';

function fixture(options = {}) {
  let time = 1_700_000_000_000;
  const jobs = new Map(), events = [];
  const clock = { now: () => time, setTimeout: (callback, ms) => { const token = {}; jobs.set(token, { at: time + ms, callback }); return token; }, clearTimeout: token => jobs.delete(token) };
  const loop = new ToolLoopController({ maxSteps: 6, onEvent: event => events.push(event), clock, ...options });
  return { loop, events, jobs, advance(ms, fire = true) { time += ms; if (fire) for (const [key, job] of jobs) if (job.at <= time) { jobs.delete(key); job.callback(); } } };
}
const command = { name: 'memory.search_history', params: { query: 'Latvian' } };

test('normal final answer remains one model call and zero tools; cleanup is idempotent', () => {
  const { loop, jobs, events } = fixture();
  assert.deepEqual(loop.beforeModel(0), { ok: true }); loop.recordUsage({ usage: { input_tokens: 500 } });
  const observation = loop.finish('completed');
  assert.equal(observation.iterations, 1); assert.equal(observation.commands, 0);
  assert.equal(observation.cost.status, 'unavailable'); assert.equal(observation.cost.actualUsd, null);
  assert.equal(loop.finish('different'), observation); assert.equal(jobs.size, 0); assert.equal(loop.signal.aborted, false);
  assert.deepEqual(loop.beforeModel(1), { ok: false, reason: 'completed' });
  for (const event of events) {
    assert.equal(event.type, 'tool_loop'); assert.equal(event.nodeId, '@tools'); assert.equal(new Date(event.at).toISOString(), event.at);
    assert(['running', 'completed', 'skipped', 'failed'].includes(event.status));
  }
});

test('exact existing semantics: six model iterations, five tools, final command denied', () => {
  const { loop } = fixture();
  for (let index = 0; index < 6; index++) {
    assert.equal(loop.beforeModel(index).ok, true);
    if (index < 5) {
      assert.equal(loop.beforeCommand(command).ok, true);
      loop.afterCommand(command, { ok: true, value: index });
    }
  }
  assert.deepEqual(loop.beforeCommand(command), { ok: false, reason: 'max_steps' });
  const result = loop.finish('completed'); assert.equal(result.iterations, 6); assert.equal(result.commands, 5);
});

test('maxSteps one permits final model answer and no tools; excess model calls are denied', () => {
  const { loop } = fixture({ maxSteps: 1 });
  assert.equal(loop.beforeModel(0).ok, true); assert.equal(loop.beforeCommand(command).reason, 'max_steps');
  const other = fixture({ maxSteps: 1 }).loop; other.beforeModel(0);
  assert.equal(other.beforeModel(1).reason, 'max_steps');
});

test('same semantic query and evidence stop before a third execution; UUIDs are ignored', () => {
  const { loop, events } = fixture();
  for (let index = 0; index < 2; index++) {
    loop.beforeModel(index); assert.equal(loop.beforeCommand(command).ok, true);
    loop.afterCommand(command, { type: 'command.result', commandId: `uuid-${index}`, ok: true, command: command.name, action: { hits: [] }, metadata: { time: index } });
  }
  loop.beforeModel(2); assert.equal(loop.beforeCommand(command).reason, 'no_progress');
  assert.equal(events.filter(row => row.phase === 'command').length, 2);
  assert.equal(events.at(-1).reason, 'no_progress');
});

test('bounded repetition uses actual UI evidence and canonical params; changing evidence allows progress', () => {
  const { loop } = fixture({ maxRepeatedCommand: 3 });
  const a = { name: command.name, params: { query: 'x', limit: 2 } }, b = { name: command.name, params: { limit: 2, query: 'x' } };
  for (let i = 0; i < 3; i++) {
    loop.beforeModel(i); assert.equal(loop.beforeCommand(i % 2 ? b : a).ok, true);
    loop.afterCommand(a, { ok: true, commandId: `${i}`, clientToolResult: { hits: [] } });
  }
  loop.beforeModel(3); assert.equal(loop.beforeCommand(b).reason, 'no_progress');
  const other = fixture().loop;
  for (let i = 0; i < 5; i++) { other.beforeModel(i); assert(other.beforeCommand(a).ok); other.afterCommand(a, { clientToolResult: { value: i } }); }
  assert(other.beforeModel(5).ok); other.finish('completed');
});

test('errors are observations, with no retry of an irreversible client command', () => {
  const { loop, events } = fixture();
  const save = { name: 'lesson.block.complete', params: { block_id: 1 } };
  loop.beforeModel(0); loop.beforeCommand(save); loop.afterCommand(save, { ok: true, clientToolResult: { ok: false, error: 'timeout' } });
  assert.equal(events.find(row => row.phase === 'feedback').status, 'failed');
  assert.equal(loop.finish('tool_error').commands, 1);
});

test('actual browser ACK command IDs never disguise an unchanged memory search result', () => {
  const { loop } = fixture();
  for (let index = 0; index < 2; index++) {
    loop.beforeModel(index); assert(loop.beforeCommand(command).ok);
    loop.afterCommand(command, { ok: true, clientToolResult: { commandId: `random-${index}`, ok: true, action: { type: 'client_api', endpoint: '/tutor/memory/search-history' }, data: { hits: [] } } });
  }
  loop.beforeModel(2); assert.equal(loop.beforeCommand(command).reason, 'no_progress');
});

test('command and feedback events expose actual input params and complete result for the existing archive', () => {
  const { loop, events } = fixture({ nodeId: 'tools-main' });
  const input = { name: 'memory.notes.search', params: { query: 'preferred voice', category: 'voice', limit: 5 } };
  const output = { ok: true, commandId: 'tool-1', action: { type: 'client_api' }, clientToolResult: { ok: true, notes: [{ id: 12, text: 'Preference' }] } };
  loop.beforeModel(0); loop.beforeCommand(input); loop.afterCommand(input, output);
  const started = events.find(row => row.phase === 'command'), feedback = events.find(row => row.phase === 'feedback');
  assert.equal(started.nodeId, 'tools-main'); assert.deepEqual(started.inputPreview, input);
  assert.deepEqual(feedback.inputPreview, input); assert.deepEqual(feedback.outputPreview, output);
  loop.finish('completed');
});

test('injected clock aborts in-flight operation at timeout and removes its timer', () => {
  const { loop, advance, jobs } = fixture({ timeoutMs: 20 }); loop.beforeModel(0);
  let aborts = 0; loop.signal.addEventListener('abort', () => aborts++);
  advance(20); assert.equal(aborts, 1); assert(loop.signal.aborted); assert.equal(jobs.size, 0);
  assert.equal(loop.beforeCommand(command).reason, 'timeout');
});

test('elapsed deadline is also enforced before timer callback runs', () => {
  const { loop, advance } = fixture({ timeoutMs: 20 }); loop.beforeModel(0); advance(21, false);
  assert.equal(loop.beforeCommand(command).reason, 'timeout');
});

test('upstream abort propagates during tools; already aborted and successful cleanup work', () => {
  const { loop, jobs } = fixture(); const controller = new AbortController();
  loop.beforeModel(0, { signal: controller.signal }); loop.beforeCommand(command); controller.abort();
  assert(loop.signal.aborted); assert.equal(jobs.size, 0); assert.equal(loop.beforeModel(1).reason, 'aborted');
  loop.afterCommand(command, {}); assert.equal(loop.finish('completed').reason, 'aborted');
  const other = fixture().loop; assert.equal(other.beforeModel(0, { signal: controller.signal }).reason, 'aborted');
  const success = fixture().loop, upstream = new AbortController(); success.beforeModel(0, { signal: upstream.signal }); success.finish('completed'); upstream.abort(); assert.equal(success.signal.aborted, false);
});

test('actual reported USD stops the next request; threshold can be crossed by the last paid call', () => {
  const { loop } = fixture({ maxCostUsd: 0.1 }); loop.beforeModel(0);
  loop.recordCost(0.03); assert.equal(loop.costKnown, true); assert.equal(loop.beforeCommand(command).ok, true);
  loop.afterCommand(command, { ok: true }); loop.beforeModel(1); loop.recordCost(0.08);
  assert.equal(loop.signal.aborted, false);
  assert.equal(loop.beforeCommand(command).reason, 'max_cost');
  const observation = loop.finish('completed'); assert.equal(observation.cost.status, 'available'); assert.equal(observation.costKnown, true);
  assert.equal(observation.cost.reportedCalls, 2); assert.equal(observation.cost.unreportedCalls, 0);
  assert(Math.abs(observation.cost.actualUsd - 0.11) < 1e-10);
});

test('unknown paid costs fail closed only when configured; free tools do not imply unknown paid cost', () => {
  const { loop } = fixture({ maxCostUsd: 0.1 }); loop.beforeModel(0); loop.recordCost(null);
  assert.equal(loop.costKnown, false); assert.equal(loop.signal.aborted, false);
  assert.equal(loop.beforeCommand(command).reason, 'cost_unavailable');
  const missing = fixture().loop; missing.beforeModel(0); missing.recordCost(0.03); missing.recordCost(null); missing.recordCost(0.02);
  assert(missing.beforeCommand(command).ok); missing.afterCommand(command, {});
  const observation = missing.finish('completed'); assert.equal(observation.cost.status, 'partial'); assert.equal(observation.costKnown, false); assert.equal(observation.cost.actualUsd, 0.05);
  const free = fixture({ maxCostUsd: 1 }).loop; free.beforeModel(0); free.beforeCommand(command); free.afterCommand(command, {});
  assert(free.beforeModel(1).ok); free.finish('completed');
});

test('metadata fallback accepts actual reported costs only; missing/estimated/invalid costs are unknown', () => {
  for (const usage of [{ input_tokens: 10_000_000 }, { cost: -1 }, { cost: { usd: 0.01, estimated: true } }]) {
    const { loop } = fixture({ maxCostUsd: 0.1 }); loop.beforeModel(0); loop.recordUsage(usage);
    assert.equal(loop.beforeCommand(command).reason, 'cost_unavailable');
  }
  const { loop } = fixture(); loop.beforeModel(0); loop.recordUsage({ metadata: { cost: { totalUsd: 0.01 } } });
  assert.equal(loop.costKnown, true); assert.equal(loop.finish('completed').cost.actualUsd, 0.01);
  const invalid = fixture().loop;
  for (const value of [-1, NaN, Infinity, undefined]) assert.throws(() => invalid.recordCost(value), RangeError);
  invalid.finish('completed');
});

test('invalid settings are errors rather than silent clamps; invalid sequencing does not execute', () => {
  for (const options of [{ maxSteps: 0 }, { maxSteps: 7 }, { maxSteps: 2.5 }, { timeoutMs: 0 }, { timeoutMs: 300001 }, { maxRepeatedCommand: 1 }, { maxRepeatedCommand: 4 }, { maxCostUsd: -1 }, { maxCostUsd: NaN }]) assert.throws(() => fixture(options), RangeError);
  assert.equal(fixture().loop.beforeModel(1).reason, 'invalid_model_sequence');
  const { loop } = fixture(); loop.beforeModel(0); loop.beforeCommand(command);
  assert.throws(() => loop.afterCommand({ name: 'navigate' }, {}), /match/);
  assert.equal(loop.beforeModel(1).reason, 'invalid_model_sequence');
  const zero = fixture({ maxCostUsd: 0 }).loop; assert.equal(zero.beforeModel(0).reason, 'max_cost');
});
