import { existsSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getGrammarTableDoc, listGrammarTableDocs } from '../../commands/grammarTables.mjs';

const INDEX = 'tools/tutor-gateway/src/commands/grammarTablesIndex.json';
const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
const text = (value, max) => String(value ?? '').slice(0, max);

function describe(doc, targetLimit) {
  const entries = Object.entries(doc.highlightTargets ?? {});
  const file = `tools/tutor-gateway/src/commands/grammar-tables/${doc.tableKey}.mjs`;
  return {
    tableKey: doc.tableKey, tableId: doc.tableId, title: doc.title, level: doc.level,
    ...(doc.language ? { language: doc.language, href: doc.href } : {}),
    source: { kind: 'registered_grammar_documentation', index: INDEX,
      document: existsSync(new URL(`../../commands/grammar-tables/${doc.tableKey}.mjs`, import.meta.url)) ? file : null },
    evidence: { summaryRu: text(doc.summaryRu, 4000), notesRu: (doc.notesRu ?? []).slice(0, 16).map(note => text(note, 1500)),
      scope: 'documentation_and_registered_targets', readsLiveTableHtml: false },
    targets: entries.slice(0, targetLimit).map(([target, item]) => ({ target, labelRu: text(item.labelRu, 500),
      selectors: (item.selectors ?? []).slice(0, 32).map(selector => ({ selector: text(selector.selector, 1000) })) })),
    targetCount: entries.length, targetsTruncated: entries.length > targetLimit,
  };
}

function search(query, limit) {
  const phrase = normalize(query).trim();
  const words = phrase.split(/[^\p{L}\p{N}_-]+/u).filter(Boolean);
  const matches = listGrammarTableDocs().map(entry => {
    const doc = getGrammarTableDoc(entry.tableKey);
    const title = normalize(`${entry.tableKey} ${entry.title}`);
    const body = normalize([doc.summaryRu, ...(doc.notesRu ?? []), ...Object.values(doc.highlightTargets ?? {}).map(target => target.labelRu)].join(' '));
    const score = (normalize(entry.tableKey) === phrase ? 50 : 0) + (title.includes(phrase) ? 15 : 0)
      + words.reduce((total, word) => total + (title.includes(word) ? 5 : 0) + (body.includes(word) ? 1 : 0), 0);
    return { doc, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.doc.tableKey.localeCompare(b.doc.tableKey));
  return { service: 'grammar_search', provider: 'lbpw_grammar', query,
    results: matches.slice(0, limit).map(({ doc }) => describe(doc, 8)), hasMore: matches.length > limit };
}

const response = data => ({ structuredContent: data, content: [{ type: 'text', text: JSON.stringify(data) }] });
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

/** A new server per run: no learner history, mutable memory, UI command or LLM. */
export function createGrammarMcpServer() {
  const server = new McpServer({ name: 'lbpw-grammar', version: '1.0.0' });
  server.registerTool('grammar_search', {
    description: 'Search the application grammar index and registered table documentation, read only.',
    inputSchema: { query: z.string().trim().min(1).max(1000), limit: z.number().int().min(1).max(8) }, annotations,
  }, async ({ query, limit }, { signal }) => {
    signal.throwIfAborted();
    return response(search(query, limit));
  });
  server.registerTool('grammar_table', {
    description: 'Read a registered grammar table document and its named CSS targets. Does not execute UI actions.',
    inputSchema: { tableKey: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/) }, annotations,
  }, async ({ tableKey }, { signal }) => {
    signal.throwIfAborted();
    const doc = getGrammarTableDoc(tableKey);
    if (!doc) return { isError: true, content: [{ type: 'text', text: 'Грамматическая таблица отсутствует в реестре.' }] };
    return response({ service: 'grammar_table', provider: 'lbpw_grammar', results: [describe(doc, 128)] });
  });
  return server;
}
