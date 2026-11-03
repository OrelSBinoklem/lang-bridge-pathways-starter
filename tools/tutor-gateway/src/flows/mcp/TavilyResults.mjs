const MAX_BYTES = 262144;

export class McpFlowError extends Error {
  constructor(code, message) { super(message); this.name = 'McpFlowError'; this.code = code; }
}

export function readToolData(reply) {
  if (Buffer.byteLength(JSON.stringify(reply ?? null)) > MAX_BYTES) {
    throw new McpFlowError('mcp_response_too_large', 'Ответ MCP превышает допустимый размер.');
  }
  if (reply?.isError) throw new McpFlowError('mcp_tool_failed', 'MCP-инструмент завершился ошибкой.');
  if (reply?.structuredContent && typeof reply.structuredContent === 'object' && !Array.isArray(reply.structuredContent)) {
    return reply.structuredContent;
  }
  const content = (reply?.content ?? []).filter(item => item.type === 'text' && typeof item.text === 'string').map(item => item.text).join('\n');
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* Official Tavily MCP also returns labelled plain text. */ }
  const results = [];
  // Tavily's official format-results.ts emits Title / ID / URL / Content blocks.
  for (const block of content.split(/\n(?=Title: )/u)) {
    const title = block.match(/(?:^|\n)Title: ([^\n]*)/u)?.[1];
    const url = block.match(/(?:^|\n)URL: ([^\n]*)/u)?.[1];
    if (!url) continue;
    const body = block.match(/(?:^|\n)Content: ([\s\S]*?)(?=\n(?:Raw Content|Favicon|Images):|$)/u)?.[1] ?? '';
    results.push({ title: title ?? '', url, content: body });
  }
  if (!results.length && !content.includes('Detailed Results:')) {
    throw new McpFlowError('mcp_invalid_result', 'MCP вернул неподдерживаемый формат результата.');
  }
  return { results };
}

export function normalizeTavily(reply, { query, limit, key, tool }) {
  const data = readToolData(reply);
  if (!Array.isArray(data.results)) throw new McpFlowError('mcp_invalid_result', 'MCP не вернул список источников.');
  const redact = value => String(value ?? '').replaceAll(key, '[redacted]');
  const results = [];
  for (const item of data.results) {
    if (!item || typeof item.url !== 'string' || item.url.length > 2048 || item.url.includes(key) || item.url.includes(encodeURIComponent(key))) continue;
    let url;
    try { url = new URL(item.url); } catch { continue; }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
      || [...url.searchParams.keys()].some(name => /^(api[_-]?key|tavilyApiKey|access_token|token|authorization)$/i.test(name))) continue;
    results.push({ title: redact(item.title).slice(0, 500), url: url.href,
      source: { kind: 'web', provider: 'tavily', tool }, evidence: { content: redact(item.content).slice(0, 4000) },
      ...(typeof item.score === 'number' && Number.isFinite(item.score) ? { score: item.score } : {}) });
    if (results.length === limit) break;
  }
  return { service: 'web_search', provider: 'tavily', query, results,
    // Tavily is charged to the provider account; the application's LLM ledger
    // does not reserve/settle this external expense. Never report it as free.
    metadata: { externalBilling: 'provider_account' },
    billing: { scope: 'external_provider', accounted: false } };
}
