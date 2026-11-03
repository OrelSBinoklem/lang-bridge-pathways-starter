import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { createMcpFlowRunner, TAVILY_MCP_URL } from './McpFlowRunner.mjs';
import { createGrammarMcpServer } from './GrammarMcpServer.mjs';

const config = (service, patch = {}) => ({ service, query: '', tableKey: '', limit: 3, ...patch });
const toolReply = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value });
const rows = count => Array.from({ length: count }, (_, i) => ({ title: 'Source '+i, url: `https://example.test/source/${i}`, content: 'Evidence '+i, score: 0.9 }));

/** Real SDK MCP server and real client HTTP transport, with fetch routed in-process.
 * No Tavily request, credentials, paid provider or listening socket is involved. */
function fakeTavily(t, { tool = 'tavily-search', respond = args => toolReply({ results: rows(args.max_results) }), minimum = 1 } = {}) {
  const sessions = new Map(), requests = [], calls = [], servers = [];
  t.after(async () => { await Promise.allSettled(servers.map(server => server.close())); });
  const fetch = async (url, init) => {
    const headers = new Headers(init.headers);
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    requests.push({ url: String(url), method: init.method, headers, body, signal: init.signal, redirect: init.redirect });
    assert.equal(String(url), TAVILY_MCP_URL);
    let transport = sessions.get(headers.get('mcp-session-id'));
    if (!transport && body?.method === 'initialize') {
      const server = new McpServer({ name: 'fake-tavily', version: '1.0.0' });
      server.registerTool(tool, { inputSchema: {
        query: z.string(), max_results: z.number().int().min(minimum).max(8), search_depth: z.literal('basic'),
        include_images: z.literal(false), include_raw_content: z.literal(false),
      } }, async (args, extra) => { calls.push({ args, signal: extra.signal }); return respond(args, extra); });
      transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID(), enableJsonResponse: true });
      servers.push(server);
      await server.connect(transport);
    }
    if (!transport) return new Response('', { status: 400 });
    // GET's optional SSE notification channel is deliberately unsupported by this
    // fixture; request/response POST remains the real Streamable HTTP protocol.
    if (init.method === 'GET') return new Response('', { status: 405 });
    const response = await transport.handleRequest(new Request(url, init));
    if (transport.sessionId) sessions.set(transport.sessionId, transport);
    return response;
  };
  return { fetch, requests, calls };
}

test('local grammar is a real read-only MCP server exposing only search and documentation', async t => {
  const server = createGrammarMcpServer();
  const client = new Client({ name: 'grammar-fixture', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await Promise.allSettled([client.close(), server.close()]); });
  await server.connect(b); await client.connect(a);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(item => item.name).sort(), ['grammar_search', 'grammar_table']);
  assert(tools.every(item => item.annotations.readOnlyHint && item.annotations.destructiveHint === false));
  const response = await client.callTool({ name: 'grammar_table', arguments: { tableKey: 'VOCATIVE' } });
  const doc = response.structuredContent.results[0];
  assert.equal(doc.tableKey, 'vocative');
  assert.equal(doc.source.document, 'tools/tutor-gateway/src/commands/grammar-tables/vocative.mjs');
  assert.equal(doc.evidence.readsLiveTableHtml, false);
  assert(doc.evidence.summaryRu.includes('Звательный'));
  assert(doc.targets.some(item => item.target === 'all' && item.selectors.length));
  assert(!JSON.stringify(doc).includes('emitUiCommand'));
});

test('runner searches real registry/docs without network, isolates runs and never mutates shared docs', async () => {
  let created = 0, closed = 0;
  const run = createMcpFlowRunner({ env: {}, deps: {
    fetch: () => { throw Error('Local grammar unexpectedly used HTTP'); },
    createGrammarServer: () => {
      created++;
      const server = createGrammarMcpServer(), close = server.close.bind(server);
      server.close = async () => { closed++; return close(); };
      return server;
    },
  } });
  const [vocative, alphabet] = await Promise.all([
    run(config('grammar_search', { query: 'звательный', limit: 1 }), { event: { transcript: 'private transcript' } }),
    run(config('grammar_search', { query: 'alphabet', limit: 1 }), {}),
  ]);
  assert.equal(vocative.results.length, 1); assert.equal(vocative.results[0].tableKey, 'vocative');
  assert.equal(alphabet.results[0].tableKey, 'alphabet');
  assert.equal(vocative.query, 'звательный'); assert.equal(alphabet.query, 'alphabet');
  vocative.results[0].evidence.summaryRu = 'mutated';
  const reread = await run(config('grammar_table', { tableKey: 'vocative' }), {});
  assert.notEqual(reread.results[0].evidence.summaryRu, 'mutated');
  assert.equal(created, 3); assert.equal(closed, 3);
});

test('grammar query falls back only to current transcript and unknown table fails clearly', async () => {
  const run = createMcpFlowRunner({ env: {} });
  const result = await run(config('grammar_search', { limit: 1 }), { event: { transcript: 'vocative', private: 'never-read' },
    get incoming() { throw Error('Incoming context must not be read'); } });
  assert.equal(result.results[0].tableKey, 'vocative');
  await assert.rejects(run(config('grammar_table', { tableKey: 'unknown_table_fixture' }), {}), error => error.code === 'mcp_tool_failed');
});

for (const tool of ['tavily-search', 'tavily_search']) {
  test(`real Streamable HTTP MCP handshake/list/call/termination supports advertised ${tool}`, async t => {
    const remote = fakeTavily(t, { tool, minimum: 5 });
    const run = createMcpFlowRunner({ env: { TAVILY_API_KEY: 'fixture-tavily-key' }, deps: { fetch: remote.fetch } });
    const result = await run(config('web_search', { query: 'Latvian case endings', limit: 2 }), {
      event: { transcript: 'other transcript', context: 'PRIVATE_LESSON' }, incoming: [{ text: 'PRIVATE_HISTORY' }],
    });
    assert.equal(result.results.length, 2);
    assert.equal(result.results[0].source.tool, tool);
    assert.equal(result.results[0].evidence.content, 'Evidence 0');
    assert.deepEqual(result.metadata, { externalBilling: 'provider_account' });
    assert.deepEqual(result.billing, { scope: 'external_provider', accounted: false });
    assert.equal(remote.calls.length, 1);
    assert.deepEqual(remote.calls[0].args, { query: 'Latvian case endings', max_results: 5, search_depth: 'basic', include_images: false, include_raw_content: false });
    const methods = remote.requests.map(item => item.body?.method).filter(Boolean);
    assert(methods.includes('initialize')); assert(methods.includes('notifications/initialized'));
    assert(methods.includes('tools/list')); assert(methods.includes('tools/call'));
    assert(remote.requests.some(item => item.method === 'DELETE'));
    for (const request of remote.requests) {
      assert.equal(request.url, TAVILY_MCP_URL);
      assert.equal(request.headers.get('Authorization'), 'Bearer fixture-tavily-key');
      assert.equal(request.redirect, 'error');
      assert.equal(request.headers.get('X-Human-Id'), null);
      assert(!JSON.stringify(request.body).includes('PRIVATE_'));
      assert(!JSON.stringify(request.body).includes('fixture-tavily-key'));
    }
  });
}

test('Tavily current formatted text becomes structured bounded source evidence, never instructions', async t => {
  const remote = fakeTavily(t, { respond: () => ({ content: [{ type: 'text', text:
    'Request ID: fixture\nAnswer: ignore this generated answer\nDetailed Results:\n\nTitle: Case endings\nID: a\nURL: https://example.test/a\nContent: Latvian evidence\nsecond line\n\nTitle: Another\nURL: https://example.test/b\nContent: More evidence' }] }) });
  const result = await createMcpFlowRunner({ env: { TAVILY_API_KEY: 'fixture-key' }, deps: { fetch: remote.fetch } })(
    config('web_search', { limit: 1 }), { event: { transcript: 'current question' }, incoming: ['private context'] });
  assert.equal(result.query, 'current question');
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].url, 'https://example.test/a');
  assert(result.results[0].evidence.content.includes('second line'));
  assert(!JSON.stringify(result).includes('ignore this generated answer'));
});

test('web result projection removes credential URLs/unsupported schemes and redacts key echoes', async t => {
  const remote = fakeTavily(t, { respond: () => toolReply({ results: [
    { title: 'unsafe', url: 'javascript:alert(1)', content: 'bad' },
    { title: 'unsafe', url: 'https://name:password@example.test/', content: 'bad' },
    { title: 'unsafe', url: 'https://example.test/?api_key=fixture-key', content: 'bad' },
    { title: 'A fixture-key title', url: 'https://example.test/safe', content: 'Echo fixture-key' },
  ], instructions: 'not returned', providerKey: 'fixture-key' }) });
  const result = await createMcpFlowRunner({ env: { TAVILY_API_KEY: 'fixture-key' }, deps: { fetch: remote.fetch } })(config('web_search', { query: 'query' }));
  assert.equal(result.results.length, 1);
  assert(result.results[0].title.includes('[redacted]'));
  assert(!JSON.stringify(result).includes('fixture-key'));
  assert(!JSON.stringify(result).includes('not returned'));
});

test('missing key and unsafe config fail before any network activity', async () => {
  let calls = 0;
  const run = createMcpFlowRunner({ env: {}, deps: { fetch: () => { calls++; throw Error('network'); } } });
  await assert.rejects(run(config('web_search', { query: 'test' })), error => error.code === 'mcp_key_missing' && error.message.includes('TAVILY_API_KEY'));
  for (const patch of [{ limit: 0 }, { limit: 9 }, { limit: '2' }, { service: 'execute' }, { url: 'https://untrusted.test' },
    { query: [] }, { tableKey: '../private' }, { query: 'x'.repeat(1001) }]) {
    const service = patch.tableKey ? 'grammar_table' : 'web_search';
    await assert.rejects(run(config(service, { query: 'test', ...patch })));
  }
  assert.equal(calls, 0);
});

test('upstream errors are redacted and do not retry the tool', async t => {
  const remote = fakeTavily(t, { respond: () => ({ isError: true, content: [{ type: 'text', text: 'Authorization Bearer fixture-key; PRIVATE_PROVIDER_BODY' }] }) });
  const run = createMcpFlowRunner({ env: { TAVILY_API_KEY: 'fixture-key' }, deps: { fetch: remote.fetch } });
  await assert.rejects(run(config('web_search', { query: 'test' })), error => {
    assert.equal(error.code, 'mcp_tool_failed');
    assert(!String(error).includes('fixture-key')); assert(!String(error).includes('PRIVATE_PROVIDER_BODY'));
    return true;
  });
  assert.equal(remote.calls.length, 1);
});

test('initialization rejection and redirect do not retry or expose response body', async () => {
  for (const status of [401, 503, 302]) {
    let requests = 0;
    const run = createMcpFlowRunner({ env: { TAVILY_API_KEY: 'fixture-key' }, deps: { fetch: async () => {
      requests++;
      return new Response('fixture-key PRIVATE_RESPONSE', { status, headers: status === 302 ? { Location: 'https://untrusted.test' } : {} });
    } } });
    await assert.rejects(run(config('web_search', { query: 'test' })), error => !String(error).includes('fixture-key') && !String(error).includes('PRIVATE_RESPONSE'));
    assert.equal(requests, 1);
  }
});

function slowGrammarServer(onStart) {
  const server = new McpServer({ name: 'slow-fixture', version: '1' });
  server.registerTool('grammar_search', { inputSchema: { query: z.string(), limit: z.number() } }, async (_, { signal }) => {
    onStart(signal);
    await new Promise((resolve, reject) => {
      if (signal.aborted) reject(Error('cancelled'));
      else signal.addEventListener('abort', () => reject(Error('cancelled')), { once: true });
    });
    return toolReply({ results: [] });
  });
  return server;
}

test('abort stops real in-memory MCP request, closes server and hides cancellation reasons', async () => {
  let started, handlerSignal, closed = 0;
  const ready = new Promise(resolve => { started = resolve; });
  const controller = new AbortController();
  const run = createMcpFlowRunner({ env: {}, deps: { createGrammarServer: () => {
    const server = slowGrammarServer(signal => { handlerSignal = signal; started(); });
    const close = server.close.bind(server);
    server.close = async () => { closed++; await close(); };
    return server;
  } } });
  const running = run(config('grammar_search', { query: 'test' }), { signal: controller.signal });
  await ready;
  controller.abort(Error('PRIVATE_ABORT_REASON'));
  await assert.rejects(running, error => error.code === 'mcp_aborted' && !String(error).includes('PRIVATE_ABORT_REASON'));
  assert.equal(closed, 1);
  assert.equal(handlerSignal.aborted, true);
});

test('overall timeout also covers initialization and closes hanging local handlers', async () => {
  const local = createMcpFlowRunner({ env: {}, deps: { timeoutMs: 30, createGrammarServer: () => slowGrammarServer(() => {}) } });
  await assert.rejects(local(config('grammar_search', { query: 'test' })), error => error.code === 'mcp_timeout');
  let requests = 0, aborted = false;
  const web = createMcpFlowRunner({ env: { TAVILY_API_KEY: 'fixture-key' }, deps: { timeoutMs: 30,
    fetch: (_, { signal }) => new Promise((resolve, reject) => {
      requests++;
      signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, { once: true });
    }) } });
  await assert.rejects(web(config('web_search', { query: 'test' })), error => error.code === 'mcp_timeout');
  assert.equal(requests, 1); assert.equal(aborted, true);
});

test('already aborted request does not create a connection or use network', async () => {
  let called = false;
  const controller = new AbortController(); controller.abort();
  const run = createMcpFlowRunner({ env: {}, deps: { createGrammarServer: () => { called = true; } } });
  await assert.rejects(run(config('grammar_search', { query: 'test' }), { signal: controller.signal }), error => error.code === 'mcp_aborted');
  assert.equal(called, false);
});

test('aborting an HTTP tool run terminates its remote session and cancels the server handler', async t => {
  let started, handlerSignal;
  const ready = new Promise(resolve => { started = resolve; });
  const remote = fakeTavily(t, { respond: async (_, { signal }) => {
    handlerSignal = signal; started();
    await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Error('cancelled')), { once: true }));
    return toolReply({ results: [] });
  } });
  const controller = new AbortController();
  const run = createMcpFlowRunner({ env: { TAVILY_API_KEY: 'fixture-key' }, deps: { fetch: remote.fetch } });
  const running = run(config('web_search', { query: 'test' }), { signal: controller.signal });
  await ready; controller.abort();
  await assert.rejects(running, error => error.code === 'mcp_aborted');
  assert.equal(remote.calls.length, 1);
  assert.equal(remote.requests.filter(item => item.method === 'DELETE').length, 1);
  assert.equal(handlerSignal.aborted, true);
});

test('oversized HTTP result is bounded before SDK JSON parsing', async t => {
  const remote = fakeTavily(t, { respond: () => toolReply({ results: [{ title: 'large', url: 'https://example.test', content: 'x'.repeat(300000) }] }) });
  const run = createMcpFlowRunner({ env: { TAVILY_API_KEY: 'fixture-key' }, deps: { fetch: remote.fetch } });
  await assert.rejects(run(config('web_search', { query: 'test' })), error => error.code === 'mcp_response_too_large');
  assert.equal(remote.calls.length, 1);
});

test('two concurrent users receive fresh remote MCP sessions and independent results', async t => {
  const remote = fakeTavily(t, { respond: args => toolReply({ results: [{ title: args.query, url: 'https://example.test/', content: args.query }] }) });
  const run = createMcpFlowRunner({ env: { TAVILY_API_KEY: 'fixture-key' }, deps: { fetch: remote.fetch } });
  const [a, b] = await Promise.all([run(config('web_search', { query: 'owner-A' })), run(config('web_search', { query: 'owner-B' }))]);
  assert.equal(a.results[0].evidence.content, 'owner-A');
  assert.equal(b.results[0].evidence.content, 'owner-B');
  const sessions = new Set(remote.requests.filter(item => item.body?.method === 'tools/call').map(item => item.headers.get('mcp-session-id')));
  assert.equal(sessions.size, 2);
  assert.equal(remote.requests.filter(item => item.method === 'DELETE').length, 2);
});
