import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const frontend = fileURLToPath(new URL('../../../../../', import.meta.url));
const root = fileURLToPath(new URL('../../../../../../', import.meta.url));
const cache = new Map();
const auth = { token: 'fixture-token', admin: true, calls: 0, error: undefined };
class ApiError extends Error { constructor(status) { super('Fixture'); this.status = status; } }
function load(url) {
  const path = fileURLToPath(url);
  if (cache.has(path)) return cache.get(path);
  const compiled = { exports: {} };
  const js = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'exports', js)(name => {
    if (name === '@/lib/auth') return { getAuthToken: async () => auth.token };
    if (name === '@/lib/api') return { ApiError, apiFetch: async (endpoint, options) => {
      auth.calls++; assert.equal(endpoint, '/user'); assert.equal(options.token, auth.token);
      if (auth.error) throw auth.error;
      return { user: { id: 1, is_admin: auth.admin } };
    } };
    if (name === './sourceViewer') return load(new URL('./sourceViewer.ts', url));
    if (name.endsWith('.json')) return JSON.parse(readFileSync(new URL(name, url), 'utf8'));
    return require(name);
  }, compiled.exports);
  cache.set(path, compiled.exports);
  return compiled.exports;
}
const viewer = load(new URL('./sourceViewer.ts', import.meta.url));
const route = load(new URL('./route.ts', import.meta.url));
const { HandlerSourceLinks } = load(new URL('../../../../features/tutor/context-studio/HandlerSourceLinks.tsx', import.meta.url));

test('new source route, viewer and links pass strict TypeScript checking', () => {
  const configPath = new URL('../../../../../tsconfig.json', import.meta.url);
  const config = ts.readConfigFile(fileURLToPath(configPath), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, frontend);
  const files = ['./route.ts', './sourceViewer.ts', '../../../../features/tutor/context-studio/HandlerSourceLinks.tsx'].map(file => fileURLToPath(new URL(file, import.meta.url)));
  const program = ts.createProgram(files, { ...parsed.options, noEmit: true, incremental: false });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => frontend, getCanonicalFileName: x => x, getNewLine: () => '\n' }));
});

test('only exact whitelist ids resolve; filesystem inputs cannot select sources', async () => {
  for (const id of ['../server.mjs', '../../.env', 'file:///etc/passwd', 'https://example.org', 'structured-command/../../server.mjs', 'toString', '__proto__']) {
    assert.equal(viewer.findSourceHandler(id), undefined);
    await assert.rejects(viewer.handlerSourceDocument(id, root), /Unknown handler/);
  }
  const html = await viewer.handlerSourceDocument('memory-search-history', root);
  assert.match(html, /TypeScript · обработчик/); assert.match(html, /TypeScript · контракт/);
  assert.match(html, /dispatchRegisteredCommand/); assert.match(html, /POST \/tutor\/memory\/search-history/);
  assert(!html.includes('<script')); assert.match(html, /&lt;T&gt;/); // Generic TS is escaped.
  assert(!html.includes('contenteditable'));
});

test('unauthenticated and regular users never get source content; errors also have no-store', async () => {
  const request = new Request('http://localhost/tutor/context-studio/source?handler=structured-command');
  auth.calls = 0; auth.token = undefined;
  let response = await route.GET(request); assert.equal(response.status, 401); assert.equal(auth.calls, 0);
  assert.match(response.headers.get('cache-control'), /private, no-store/); assert(!((await response.text()).includes('dispatchRegisteredCommand')));
  auth.token = 'fixture-token'; auth.admin = false;
  response = await route.GET(request); assert.equal(response.status, 404); assert.match(response.headers.get('cache-control'), /no-store/);
  assert(!((await response.text()).includes('dispatchRegisteredCommand')));
  auth.admin = true; auth.error = new ApiError(401);
  response = await route.GET(request); assert.equal(response.status, 401); assert.match(response.headers.get('cache-control'), /no-store/);
  auth.error = undefined;
});

test('authenticated admin can see allowlisted code, with HTML escaping and security headers', async () => {
  const cwd = process.cwd();
  try {
    process.chdir(frontend);
    const response = await route.GET(new Request('http://localhost/tutor/context-studio/source?handler=mcp-web-search&path=../../.env'));
    assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private, no-store/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
    const text = await response.text(); assert.match(text, /runRegisteredMcp/); assert.match(text, /McpFlowRunner.mjs/); assert.match(text, /&lt;T&gt;/);
    assert(!text.includes('fixture-token'));
    for (const query of ['handler=../../.env', 'handler=structured-command&handler=mcp-web-search', 'file=server.mjs', 'handler=toString']) {
      const denied = await route.GET(new Request(`http://localhost/tutor/context-studio/source?${query}`));
      assert.equal(denied.status, 404); assert.match(denied.headers.get('cache-control'), /no-store/);
    }
  } finally { process.chdir(cwd); }
});

test('authorization outage and missing deployed sources fail closed with private responses', async () => {
  const cwd = process.cwd(), originalError = console.error, diagnostics = [];
  console.error = (...args) => diagnostics.push(args);
  try {
    auth.error = new ApiError(502);
    let response = await route.GET(new Request('http://localhost/tutor/context-studio/source?handler=structured-command'));
    assert.equal(response.status, 503); assert.match(response.headers.get('cache-control'), /private, no-store/);
    auth.error = undefined;
    process.chdir(root); // Deliberately wrong deployment cwd: resources are absent.
    response = await route.GET(new Request('http://localhost/tutor/context-studio/source?handler=structured-command'));
    assert.equal(response.status, 503); assert.match(response.headers.get('cache-control'), /private, no-store/);
    assert(!((await response.text()).includes(root)));
    assert.equal(diagnostics.length, 2); assert.equal(diagnostics[1][1].handler, 'structured-command');
    assert(!JSON.stringify(diagnostics).includes('fixture-token'));
  } finally { auth.error = undefined; console.error = originalError; process.chdir(cwd); }
});

test('links use shared metadata, choose memory-specific ids and suppress unknown handlers', () => {
  for (const [props, id] of [
    [{ handler: 'memory.search_history' }, 'memory-search-history'], [{ handler: 'memory.notes.search' }, 'memory-notes-search'],
    [{ handler: 'history.get_around_message' }, 'history-around-message'], [{ handler: 'navigate' }, 'structured-command'],
    [{ service: 'grammar_search' }, 'mcp-grammar-search'], [{ service: 'grammar_table' }, 'mcp-grammar-table'],
    [{ service: 'web_search' }, 'mcp-web-search'], [{ handler: 'mcp-web-search' }, 'mcp-web-search'],
  ]) {
    const html = renderToStaticMarkup(HandlerSourceLinks(props));
    assert(html.includes(`handler=${id}`)); assert.match(html, /rel="noopener noreferrer"/);
  }
  assert.equal(HandlerSourceLinks({ handler: '../../.env', service: 'unknown' }), null);
  assert.equal(HandlerSourceLinks({}), null);
});
