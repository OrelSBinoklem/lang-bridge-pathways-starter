import { StateGraph, StateSchema, ReducedValue, START, END } from '@langchain/langgraph';
import { z } from 'zod';
import { FlowExecutionSession, validateGraph } from '../../../../../resources/tutor-flow/graph.mjs';

const record = () => z.record(z.string(), z.unknown()).default(() => ({}));
const merged = () => new ReducedValue(record(), { reducer: (current, update) => ({ ...current, ...update }) });
const stateSchema = new StateSchema({
  nodeResults: merged(), resolved: merged(),
  trace: new ReducedValue(z.array(z.unknown()).default(() => []), { reducer: (current, update) => [...current, ...update] }),
});

/** Saved cards become real StateGraph nodes. Sessions belong to one invocation. */
export function compileTutorGraph(definition, { session, checkpointer, interruptBefore } = {}) {
  const graph = validateGraph(definition);
  if (!(session instanceof FlowExecutionSession)) throw new Error('Для исполнения LangGraph нужна изолированная сессия разговора.');
  const builder = new StateGraph(stateSchema);
  for (const node of graph.nodes) {
    builder.addNode(node.id, async (_state, config) => {
      config.signal?.throwIfAborted(); session.signal?.throwIfAborted();
      const result = await session.runNode(node.id);
      return { nodeResults: { [node.id]: result }, ...(node.type === 'compact' ? { resolved: { ...session.resolved } } : {}),
        trace: session.trace.filter(event => event.nodeId === node.id) };
    }, { retryPolicy: { maxAttempts: 1 }, cachePolicy: false,
      metadata: { tutor_node_type: node.type, tutor_node_id: node.id } });
  }
  for (const node of graph.nodes) {
    const parents = [...new Set(graph.edges.filter(edge => edge.target === node.id).map(edge => edge.source))];
    // Merges await every parent, including cheap skipped-branch markers. Shared
    // strategies alone select which branch's data reaches the downstream node.
    builder.addEdge(parents.length ? parents : START, node.id);
    if (!graph.edges.some(edge => edge.source === node.id)) builder.addEdge(node.id, END);
  }
  return builder.compile({ checkpointer, interruptBefore });
}
