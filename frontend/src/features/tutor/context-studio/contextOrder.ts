import { CONTEXT_PORTS, type FlowGraph, type FlowNode } from './flowEditor';
import { connectionError, connectionSignature } from '../../../../../resources/tutor-flow/connections.mjs';

/** Walk incoming edges in their stored order, including upstream blocks carried through gates. */
export function connectedContextIds(graph: FlowGraph, contextId: string): string[] {
  const byId = new Map(graph.nodes.map(node => [node.id, node])), visited = new Set<string>(), ids: string[] = [];
  const visit = (id: string) => {
    if (visited.has(id)) return; visited.add(id);
    const node = byId.get(id);
    if (node && (['source', 'prompt', 'mcp', 'module'].includes(node.type) || node.type === 'context' && id !== contextId)) ids.push(id);
    for (const edge of graph.edges) if (edge.target === id) visit(edge.source);
  };
  visit(contextId);
  // Stable node-order fallback for any reachable block omitted by malformed/missing intermediate nodes.
  for (const node of graph.nodes) if (visited.has(node.id) && (['source', 'prompt', 'mcp', 'module'].includes(node.type) || node.type === 'context' && node.id !== contextId) && !ids.includes(node.id)) ids.push(node.id);
  return ids;
}
export function effectiveContextOrder(graph: FlowGraph, context: FlowNode): string[] {
  const connected = connectedContextIds(graph, context.id);
  const portOrder = usesContextPorts(context);
  const expected = portOrder ? CONTEXT_PORTS : connected, allowed = new Set([...(portOrder ? CONTEXT_PORTS : connected), '$request']);
  const configured = Array.isArray(context.data.order) ? context.data.order.filter((id): id is string => typeof id === 'string' && allowed.has(id)) : expected;
  const result = [...new Set(configured)];
  if (!result.includes('$request')) result.push('$request');
  const missing = expected.filter(id => !result.includes(id));
  result.splice(result.indexOf('$request'), 0, ...missing);
  return result;
}
export function usesContextPorts(node: FlowNode): boolean {
  return Array.isArray(node.data.inputs) || Array.isArray(node.data.order) && node.data.order.some(id => CONTEXT_PORTS.includes(String(id)));
}
/** Call only for topology changes: dragging and selection must never rewrite saved order. */
export function syncContextOrders(graph: FlowGraph): FlowGraph {
  return { ...graph, nodes: graph.nodes.map(node => node.type === 'context' && Array.isArray(node.data.order) ? { ...node, data: { ...node.data, order: effectiveContextOrder(graph, node) } } : node) };
}
export function moveContextBlock(order: string[], id: string, offset: -1 | 1): string[] {
  const index = order.indexOf(id), target = index + offset;
  if (index < 0 || target < 0 || target >= order.length) return order;
  const next = [...order]; [next[index], next[target]] = [next[target], next[index]]; return next;
}
export type Wire = { source: string | null; target: string | null; sourceHandle?: string | null; targetHandle?: string | null };
export function validFlowConnection(graph: FlowGraph, wire: Wire, reconnectingId?: string): boolean {
  const from = graph.nodes.find(node => node.id === wire.source), to = graph.nodes.find(node => node.id === wire.target);
  const fragment = graph.nodes.some(node => node.type === 'module_input');
  if (connectionError(from, to, wire, fragment) || !from || !to) return false;
  const visited = new Set<string>(), edges = graph.edges.filter(edge => edge.id !== reconnectingId);
  if (edges.some(edge => connectionSignature(edge) === connectionSignature(wire))) return false;
  const reaches = (id: string): boolean => { if (id === from.id) return true; if (visited.has(id)) return false; visited.add(id); return edges.filter(edge => edge.source === id).some(edge => reaches(edge.target)); };
  return !reaches(to.id);
}
