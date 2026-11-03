// Browser-safe contract shared by the canvas and the graph validator.
const pairs = {
  event: ['source', 'prompt', 'condition', 'compact', 'context', 'mcp'],
  source: ['context', 'condition', 'compact', 'mcp'], prompt: ['context'],
  condition: ['source', 'prompt', 'condition', 'compact', 'context', 'mcp'],
  compact: ['source', 'prompt', 'condition', 'context', 'mcp'],
  context: ['context', 'serialize', 'model'], serialize: ['model'],
  mcp: ['context', 'mcp'], model: ['tools'], tools: ['reply'], reply: ['speech'], speech: [],
};
const processing = ['source', 'prompt', 'condition', 'context', 'serialize', 'mcp', 'module'];

export function connectionTypesAllowed(from, to, fragment = false) {
  if (from === 'module_input' || from === 'module_output' || to === 'module_input' || to === 'module_output') {
    if (!fragment || from === 'module_output' || to === 'module_input') return false;
    if (to === 'module_output') return [...processing, 'module_input', 'model'].includes(from);
    if (from === 'module_input') return processing.includes(to);
  }
  if (to === 'module') return [...processing, 'event', 'compact'].includes(from);
  if (from === 'module') return [...processing, 'model'].includes(to);
  return pairs[from]?.includes(to) || false;
}

/** A local edge check; whole-graph reachability and cycle checks belong to the caller. */
export function connectionError(from, to, wire, fragment = false) {
  if (!from || !to || from.id === to.id || !connectionTypesAllowed(from.type, to.type, fragment)) return 'недопустимые типы узлов';
  if (from.type === 'source' && ['condition', 'compact'].includes(to.type)
      && (from.data.source !== 'message_stream' || to.type === 'condition' && to.data.field !== 'user_message_count')) return 'этому входу нужен источник потока сообщений';
  if (from.type === 'module' ? !from.data.definition?.outputs?.some(port => port.id === wire.sourceHandle)
      : from.type === 'condition' ? !['true', 'false'].includes(wire.sourceHandle)
      : wire.sourceHandle != null && wire.sourceHandle !== 'out') return 'неверный выход';
  if (to.type === 'module' ? !to.data.definition?.inputs?.some(port => port.id === wire.targetHandle)
      : to.type === 'context' && Array.isArray(to.data.inputs) ? !to.data.inputs.some(port => port.id === wire.targetHandle)
      : wire.targetHandle != null && wire.targetHandle !== 'in') return 'неверный вход';
  return null;
}

export function connectionSignature(wire) {
  return `${wire.source}:${wire.sourceHandle || 'out'}:${wire.target}:${wire.targetHandle || 'in'}`;
}
