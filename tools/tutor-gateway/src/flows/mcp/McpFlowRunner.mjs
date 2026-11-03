import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createGrammarMcpServer } from './GrammarMcpServer.mjs';
import { McpFlowError, normalizeTavily, readToolData } from './TavilyResults.mjs';

export { McpFlowError } from './TavilyResults.mjs';
export const TAVILY_MCP_URL = 'https://mcp.tavily.com/mcp/';
const SERVICES = ['web_search', 'grammar_search', 'grammar_table'];

function input(config, event) {
  if (!config || typeof config !== 'object' || Array.isArray(config)
    || Object.keys(config).some(key => !['service', 'query', 'tableKey', 'limit'].includes(key))
    || !SERVICES.includes(config.service) || !Number.isInteger(config.limit) || config.limit < 1 || config.limit > 8
    || typeof config.query !== 'string' || typeof config.tableKey !== 'string') {
    throw new McpFlowError('mcp_invalid_config', 'Некорректные настройки MCP-блока.');
  }
  const query = config.query.trim() || (typeof event?.transcript === 'string' ? event.transcript.trim() : '');
  if (config.service !== 'grammar_table' && (!query || query.length > 1000)) {
    throw new McpFlowError('mcp_invalid_query', 'Нужен поисковый запрос до 1000 символов.');
  }
  if (config.service === 'grammar_table' && !/^[a-zA-Z0-9_-]{1,80}$/.test(config.tableKey)) {
    throw new McpFlowError('mcp_invalid_table', 'Нужен ключ таблицы из реестра приложения.');
  }
  return { ...config, query };
}

function deadline(signal, timeoutMs) {
  const controller = new AbortController();
  const abort = () => controller.abort(new McpFlowError('mcp_aborted', 'MCP-запрос отменён.'));
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new McpFlowError('mcp_timeout', 'MCP-запрос превысил время ожидания.')), timeoutMs);
  return { controller, signal: controller.signal, dispose: () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); } };
}

function wait(promise, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function boundedResponse(response, scope) {
  if (!response.body) return response;
  const reader = response.body.getReader();
  let size = 0;
  return new Response(new ReadableStream({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) { controller.close(); return; }
        size += chunk.value.byteLength;
        if (size > 262144) {
          const error = new McpFlowError('mcp_response_too_large', 'Ответ MCP превышает допустимый размер.');
          scope.controller.abort(error);
          controller.error(error);
          await reader.cancel().catch(() => {});
          return;
        }
        controller.enqueue(chunk.value);
      } catch { controller.error(new McpFlowError('mcp_transport_failed', 'Ошибка чтения MCP-ответа.')); }
    },
    cancel: reason => reader.cancel(reason),
  }), { status: response.status, statusText: response.statusText, headers: response.headers });
}

function pinnedFetch(fetchImpl, scope) {
  return async (url, init = {}) => {
    if (String(url) !== TAVILY_MCP_URL) throw new McpFlowError('mcp_endpoint_blocked', 'Недопустимый адрес MCP-сервера.');
    // A cancelled run cannot issue another operation. A single bounded DELETE
    // is still allowed to release that run's remote session and cancel handlers.
    const terminating = init.method === 'DELETE';
    if (!terminating) { scope.signal.throwIfAborted(); init.signal?.throwIfAborted(); }
    const signals = terminating ? [AbortSignal.timeout(1000)] : [scope.signal, init.signal].filter(Boolean);
    const response = await fetchImpl(url, { ...init, redirect: 'error', signal: AbortSignal.any(signals) });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new McpFlowError('mcp_redirect_blocked', 'Перенаправления MCP-сервера запрещены.');
    }
    return boundedResponse(response, scope);
  };
}

/** Node-level MCP calls only. `incoming` deliberately never leaves this process. */
export function createMcpFlowRunner({ env = process.env, deps = {} } = {}) {
  const timeoutMs = deps.timeoutMs ?? 15000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new TypeError('Invalid MCP timeout');
  return async function runMcp(config, { event, signal } = {}) {
    const data = input(config, event);
    const scope = deadline(signal, timeoutMs);
    let client, transport, server, result, failed;
    try {
      scope.signal.throwIfAborted();
      client = new Client({ name: 'lbpw-flow', version: '1.0.0' }, { capabilities: {} });
      const options = { signal: scope.signal, timeout: timeoutMs, maxTotalTimeout: timeoutMs, resetTimeoutOnProgress: false };
      if (data.service === 'web_search') {
        const key = typeof env.TAVILY_API_KEY === 'string' ? env.TAVILY_API_KEY.trim() : '';
        if (!key) throw new McpFlowError('mcp_key_missing', 'Для веб-поиска нужен TAVILY_API_KEY. Внешний поиск не выполнялся.');
        if (key.length > 512 || /[\r\n\0]/.test(key)) throw new McpFlowError('mcp_key_invalid', 'Некорректная настройка TAVILY_API_KEY.');
        transport = new StreamableHTTPClientTransport(new URL(TAVILY_MCP_URL), {
          requestInit: { headers: { Authorization: `Bearer ${key}` }, redirect: 'error' },
          fetch: pinnedFetch(deps.fetch ?? globalThis.fetch, scope),
          reconnectionOptions: { maxRetries: 0, initialReconnectionDelay: 0, maxReconnectionDelay: 0, reconnectionDelayGrowFactor: 1 },
        });
        await wait(client.connect(transport, options), scope.signal);
        const { tools } = await wait(client.listTools({}, options), scope.signal);
        const tool = tools.find(item => item.name === 'tavily-search') ?? tools.find(item => item.name === 'tavily_search');
        if (!tool) throw new McpFlowError('mcp_tool_unavailable', 'Tavily MCP не объявил поддерживаемый инструмент поиска.');
        const minimum = tool.inputSchema?.properties?.max_results?.minimum ?? 1;
        if (!Number.isInteger(minimum) || minimum < 1 || minimum > 8) throw new McpFlowError('mcp_tool_schema', 'Неподдерживаемый лимит Tavily MCP.');
        const reply = await wait(client.callTool({ name: tool.name, arguments: { query: data.query,
          max_results: Math.max(minimum, data.limit), search_depth: 'basic', include_images: false, include_raw_content: false } }, undefined, options), scope.signal);
        result = normalizeTavily(reply, { ...data, key, tool: tool.name });
      } else {
        server = (deps.createGrammarServer ?? createGrammarMcpServer)();
        const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
        transport = clientSide;
        await wait(server.connect(serverSide), scope.signal);
        await wait(client.connect(transport, options), scope.signal);
        const args = data.service === 'grammar_table' ? { tableKey: data.tableKey } : { query: data.query, limit: data.limit };
        const reply = await wait(client.callTool({ name: data.service, arguments: args }, undefined, options), scope.signal);
        result = readToolData(reply);
      }
      scope.signal.throwIfAborted();
    } catch (error) {
      failed = scope.signal.aborted ? scope.signal.reason : error instanceof McpFlowError ? error
        : new McpFlowError('mcp_transport_failed', 'MCP-запрос не завершён. Проверьте доступ и настройки сервиса.');
    } finally {
      // No client, server, request state or credentials are reused across runs/users.
      scope.dispose();
      if (data.service === 'web_search' && transport?.sessionId) {
        try { await wait(transport.terminateSession(), AbortSignal.timeout(1000)); }
        catch { if (!failed) failed = new McpFlowError('mcp_close_failed', 'Не удалось закрыть MCP-сессию.'); }
      }
      const closed = await Promise.allSettled([client?.close(), server?.close()]);
      scope.controller.abort();
      if (!failed && closed.some(item => item.status === 'rejected')) failed = new McpFlowError('mcp_close_failed', 'Не удалось закрыть MCP-соединение.');
    }
    if (failed) throw failed;
    return result;
  };
}
