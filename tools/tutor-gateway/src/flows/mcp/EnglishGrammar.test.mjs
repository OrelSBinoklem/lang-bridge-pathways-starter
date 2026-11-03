import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createGrammarMcpServer } from './GrammarMcpServer.mjs';

test('English tables are discoverable through the existing real MCP and point to the English page', async t => {
  const server = createGrammarMcpServer(), client = new Client({ name: 'english-grammar-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await Promise.allSettled([client.close(), server.close()]); });
  await server.connect(b); await client.connect(a);
  const search = await client.callTool({ name: 'grammar_search', arguments: { query: 'englishTimeViewpoints', limit: 3 } });
  const result = search.structuredContent.results[0];
  assert.equal(result.tableKey, 'englishTimeViewpoints'); assert.equal(result.language, 'en');
  assert.equal(result.href, '/grammar/english?level=b2#en-time-viewpoints');
  const details = await client.callTool({ name: 'grammar_table', arguments: { tableKey: result.tableKey } });
  assert(details.structuredContent.results[0].targets.some(item => item.target === 'role_auxiliary'));
  assert.equal(details.structuredContent.results[0].source.document, 'tools/tutor-gateway/src/commands/grammar-tables/englishTimeViewpoints.mjs');
  const forms = await client.callTool({ name: 'grammar_table', arguments: { tableKey: 'englishIrregularVerbs' } });
  assert(forms.structuredContent.results[0].targets.some(item => item.target === 'ref_row_take'));
  assert(forms.structuredContent.results[0].evidence.notesRu.some(note => note.includes('60 строк')));
  const latvian = await client.callTool({ name: 'grammar_table', arguments: { tableKey: 'vocative' } });
  assert.equal(latvian.structuredContent.results[0].tableKey, 'vocative');
  assert.equal(latvian.structuredContent.results[0].language, undefined, 'legacy metadata remains unchanged');
});
