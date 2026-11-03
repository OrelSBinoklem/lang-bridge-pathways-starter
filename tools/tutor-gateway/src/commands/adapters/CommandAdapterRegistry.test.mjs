import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CommandAdapterRegistry, dispatchRegisteredCommand, runRegisteredMcp, commandHandlers, AdapterScopeError } from './CommandAdapterRegistry.mjs';
import { dispatchStructuredCommand, assertStrictCommandResult } from '../dispatcher.mjs';
import { commandRegistry } from '../registry.mjs';
import { createMcpFlowRunner } from '../../flows/mcp/McpFlowRunner.mjs';

test('typecheck and reproducible generated runtime/declarations are required', () => {
  execFileSync(process.execPath, [fileURLToPath(new URL('../../../scripts/build-command-adapters.mjs', import.meta.url)), '--check'], { stdio: 'pipe' });
});

test('shared metadata matches actual dispatcher commands and has only allowlisted source ids', () => {
  assert.deepEqual(commandHandlers.find(row => row.id === 'structured-command').commands.toSorted(), commandRegistry.map(row => row.command).toSorted());
  assert.equal(new Set(commandHandlers.map(row => row.id)).size, commandHandlers.length);
  for (const row of commandHandlers) {
    assert.match(row.id, /^[a-z-]+$/);
    for (const file of [row.sourceFile, row.contractFile]) assert.match(file, /^tools\/tutor-gateway\/src\/commands\/adapters\/[A-Za-z]+\.ts$/);
  }
});

test('dispatch function returns the exact injected result and forwards untouched params/metadata', () => {
  const params = { message_id: '12', before: '2', after: 3, ignored: 'dispatcher owns normalization' };
  const metadata = { input: 'test', requested_by_model: true };
  const original = dispatchStructuredCommand('history.get_around_message', params, metadata);
  let calls = 0;
  const result = dispatchRegisteredCommand('history.get_around_message', params, { metadata }, { dispatch(name, values, meta) {
    calls++; assert.equal(name, original.command); assert.equal(values, params); assert.equal(meta, metadata); return original;
  } });
  assert.equal(calls, 1); assert.equal(result, original); assertStrictCommandResult(result);
});

test('real dispatcher preserves authenticated UI memory routes and validation errors', () => {
  const registry = new CommandAdapterRegistry({ dispatch: dispatchStructuredCommand, run: async () => { throw Error('not called'); } });
  for (const [name, params, method, endpoint] of [
    ['memory.search_history', { query: 'learning' }, 'POST', '/tutor/memory/search-history'],
    ['memory.notes.search', { query: 'voice', category: 'voice' }, 'POST', '/tutor/memory/notes/search'],
    ['history.get_around_message', { message_id: '12', before: '2' }, 'GET', '/tutor/memory/history-around/12?before=2&after=5'],
  ]) {
    const result = registry.execute({ name, params });
    assertStrictCommandResult(result); assert.equal(result.ok, true); assert.equal(result.executor, 'ui');
    assert.equal(result.action.type, 'client_api'); assert.equal(result.action.endpoint, endpoint); assert.equal(result.action.method, method);
  }
  for (const [name, params, code] of [
    ['memory.search_history', {}, 'missing_param'], ['memory.notes.search', { query: 'x', category: 'invalid' }, 'invalid_param'],
    ['history.get_around_message', { message_id: -1 }, 'invalid_param'], ['unknown', {}, 'command_not_found'],
  ]) {
    const result = registry.execute({ name, params });
    assertStrictCommandResult(result); assert.equal(result.ok, false); assert.equal(result.errors[0].code, code);
  }
});

test('caller scope and abort are enforced before dispatch; contexts are independent', () => {
  let calls = 0;
  const deps = { dispatch: (...args) => { calls++; return dispatchStructuredCommand(...args); }, run: async () => null };
  const registry = new CommandAdapterRegistry(deps);
  assert.throws(() => registry.execute({ name: 'memory.notes.search' }, { scope: { allowedCommands: [] } }), AdapterScopeError);
  const controller = new AbortController(); controller.abort();
  assert.throws(() => registry.execute({ name: 'commands.list' }, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 0);
  assert.equal(registry.execute({ name: 'commands.list' }, { scope: { allowedCommands: ['commands.list'] } }).ok, true);
  assert.equal(registry.execute({ name: 'routes.list' }).ok, true);
  assert.equal(calls, 2);
});

test('MCP adapter delegates once with the same config, context, result and error', async () => {
  const config = { service: 'web_search', query: 'Latvian', tableKey: '', limit: 2 };
  const context = { event: { transcript: 'hello' }, scope: { allowedServices: ['web_search'] } };
  const expected = { service: 'web_search', provider: 'fixture', results: [] };
  let calls = 0;
  const run = async (a, b) => { calls++; assert.equal(a, config); assert.equal(b, context); return expected; };
  assert.equal(await runRegisteredMcp(config, context, { run }), expected); assert.equal(calls, 1);
  const error = Error('original failure');
  await assert.rejects(runRegisteredMcp(config, context, { run: async () => { throw error; } }), value => value === error);
  assert.throws(() => runRegisteredMcp(config, { scope: { allowedServices: [] } }, { run }), AdapterScopeError);
  assert.equal(calls, 1);
});

test('generated registry runs the existing real local grammar MCP provider without network', async () => {
  const registry = new CommandAdapterRegistry({ dispatch: dispatchStructuredCommand, run: createMcpFlowRunner({ env: {} }) });
  const result = await registry.runMcp({ service: 'grammar_search', query: 'pronoun', tableKey: '', limit: 2 });
  assert.equal(result.service, 'grammar_search'); assert.equal(result.provider, 'lbpw_grammar'); assert(Array.isArray(result.results));
  await assert.rejects(registry.runMcp({ service: 'grammar_search', query: 'x', tableKey: '', limit: 99 }), error => error.code === 'mcp_invalid_config');
  await assert.rejects(registry.runMcp({ service: 'web_search', query: 'x', tableKey: '', limit: 1 }), error => error.code === 'mcp_key_missing');
});
