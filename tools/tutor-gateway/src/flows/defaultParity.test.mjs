import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultFlow } from '../../../../resources/tutor-flow/graph.mjs';
import { FlowExecutionService } from './runtime/FlowExecutionService.mjs';
import { respondToTutorTurn } from '../agent/tutorAgent.mjs';

test('PHP default snapshot matches the JavaScript template and both branches preserve speech and tool evidence', async () => {
  const graph = defaultFlow();
  assert.deepEqual(JSON.parse(readFileSync(new URL('../../../../resources/tutor-flow/default.json', import.meta.url))), graph);
  const transcripts = [{ id: 'primary', text: 'Es lasu.', ok: true }, { id: 'secondary', text: 'Es lasu!', ok: true }];
  const tools = [{ command: 'grammar.table.get_structure', result: { tableKey: 'verb-present', evidence: 'REAL_TABLE_EVIDENCE' } }];
  for (const turns of [1, 21]) {
    const stream = Array.from({ length: turns }, () => ({ role: 'user', text: 'question' }));
    const packets = [];
    await new FlowExecutionService().execute(graph, { event: { type: 'user.audio', transcript: 'Es lasu.' },
      sources: { message_stream: stream, transcript_candidates: transcripts, recent_tool_interactions: tools },
      runCompact: async () => ({ message_stream: stream.slice(-5), context_summary: 'Earlier dialogue', parameter_state: {} }),
      runModel: async packet => { packets.push(packet); return { ok: true, reply: 'Sveiki!' }; },
    });
    assert.equal(packets.length, 1);
    assert.deepEqual(packets[0].parts.transcript_candidates, transcripts);
    assert.deepEqual(packets[0].parts.recent_tool_interactions, tools);
  }
});

test('the real tutor adapter sends connected transcript alternatives and tool results to the provider', async t => {
  const key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'fixture-only';
  t.after(() => { if (key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = key; });
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return Response.json({ status: 'completed', output_text: JSON.stringify({ reply: 'Sveiki!', command: null }) });
  });
  const result = await respondToTutorTurn({ transcript: 'Es lasu.', flow: { version_id: 1, graph: defaultFlow() },
    flowEvent: 'user.audio', config: { tutorModel: 'gpt-4.1-mini', reasoningEnabled: false, contextMode: 'full' },
    messageStream: [{ role: 'user', text: 'Es lasu.' }],
    transcriptCandidates: [{ id: 'primary', text: 'PRIMARY_EVIDENCE' }, { id: 'secondary', text: 'SECONDARY_EVIDENCE' }],
    recentToolInteractions: [{ command: 'grammar.table.get_structure', result: 'TABLE_EVIDENCE' }],
  });
  assert.equal(result.ok, true);
  assert.equal(requests.length, 1);
  const input = JSON.stringify(requests[0].input);
  for (const marker of ['PRIMARY_EVIDENCE', 'SECONDARY_EVIDENCE', 'TABLE_EVIDENCE']) assert(input.includes(marker), marker);
});
