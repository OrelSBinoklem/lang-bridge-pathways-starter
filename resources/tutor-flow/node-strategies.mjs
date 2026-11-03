import { compactionPrefix, foldParameters, userMessageCount } from './journal.mjs';
import { assembleContext, serializeContext, modelContextByteLength } from './assembly.mjs';

function fail(message) { throw new Error(message); }
function checkAssembledContextSize(packet) {
  if (packet.bundle && modelContextByteLength(packet) > 240000) fail('Контекст превышает 240 КБ. Уменьшите лимиты источников.');
}
function checkModulePacket(packet) {
  const safeKey = key => typeof key === 'string' && /^[a-zA-Z0-9_-]{1,512}$/.test(key) && !['__proto__', 'constructor', 'prototype', 'current_request'].includes(key);
  for (const key of Object.keys(packet.parts || {})) if (!safeKey(key)) fail('Небезопасный ключ данных модуля.');
  for (const block of packet.blocks || []) if (block.kind === 'source' && !safeKey(block.source)) fail('Небезопасный ключ блока модуля.');
  return packet;
}
function truncate(value, limit) {
  if (value == null) return value;
  if (typeof value === 'string') return value.slice(0, limit);
  if (Array.isArray(value)) {
    const out = []; let size = 2;
    for (const item of value.slice().reverse()) { const json = JSON.stringify(item); if (size + json.length > limit) break; out.unshift(item); size += json.length + 1; }
    return out;
  }
  if (typeof value === 'object') {
    if (JSON.stringify(value).length <= limit) return value;
    const entries = Object.entries(value), each = Math.max(1, Math.floor((limit - entries.length * 20) / Math.max(1, entries.length)));
    return Object.fromEntries(entries.map(([key, content]) => [key, truncate(content, each)]));
  }
  return value;
}
function carriedData(incoming) {
  const parts = {}, blocks = new Map();
  for (const item of incoming) { Object.assign(parts, item.parts || {}); for (const block of item.blocks || []) blocks.set(block.id, block); }
  return { parts, blocks: [...blocks.values()] };
}
export function orderContextBlocks(blocks, order) {
  const byId = new Map(blocks.map(block => [block.id, block])), configured = [...(order || blocks.map(block => block.id))];
  if (!configured.includes('$request')) configured.push('$request');
  configured.splice(configured.indexOf('$request'), 0, ...blocks.filter(block => !configured.includes(block.id)).map(block => block.id));
  return configured.flatMap(id => id === '$request' ? [{ id, kind: 'request' }] : byId.has(id) ? [byId.get(id)] : []);
}

class EventNode { execute(_node, context) { return { trigger: true, event: context.event }; } }
class SourceNode {
  async execute(node, context) {
    const value = await context.readSource(node.data.source) ?? (node.data.source === 'message_stream' ? [] : node.data.source === 'parameter_state' ? {} : null);
    const exact = ['message_stream', 'parameter_state'].includes(node.data.source);
    if (exact && JSON.stringify(value ?? null).length > node.data.limitChars) fail(`${node.id}: источник превышает лимит. Уменьшите переписку через блок сжатия; история не удалена.`);
    const output = exact ? value : truncate(value, node.data.limitChars);
    return { parts: { [node.data.source]: output }, blocks: [{ id: context.nodeId(node.id), kind: 'source', source: node.data.source, value: output }] };
  }
}
class PromptNode { execute(node, context) { return { instructions: [node.data.text], blocks: [{ id: context.nodeId(node.id), kind: 'prompt', text: node.data.text }] }; } }
class ConditionNode {
  async execute(node, context, incoming) {
    const data = carriedData(incoming);
    if (Object.hasOwn(data.parts, 'message_stream') && !Array.isArray(data.parts.message_stream)) fail('На вход условия нужен массив сообщений.');
    const observed = node.data.field === 'user_message_count'
      ? Object.hasOwn(data.parts, 'message_stream') ? userMessageCount(data.parts.message_stream) : Number(await context.readSource('user_message_count') ?? userMessageCount(await context.readSource('message_stream') || []))
      : String(context.event[node.data.field] ?? await context.readSource(node.data.field) ?? '');
    return { trigger: true, observed, branch: node.data.operator === 'gt' ? observed > Number(node.data.value) : node.data.operator === 'equals' ? observed === node.data.value : observed.toLocaleLowerCase().includes(node.data.value.toLocaleLowerCase()), ...data };
  }
}
class CompactNode {
  async execute(node, context, incoming) {
    const data = carriedData(incoming);
    if (Object.hasOwn(data.parts, 'message_stream') && !Array.isArray(data.parts.message_stream)) fail('На вход сжатия нужен массив сообщений.');
    let result;
    if (context.runCompact) Object.assign(context.resolved, await context.runCompact(node.data, data, { signal: context.signal }));
    else if (context.runModel) fail('Исполнитель сжатия недоступен. Переписка не менялась.');
    else {
      let stream = [...(data.parts.message_stream ?? await context.readSource('message_stream') ?? [])], snapshot = data.parts.parameter_state ?? await context.readSource('parameter_state') ?? {}, records = 0;
      for (;;) {
        const prefix = compactionPrefix(stream, { keepPairs: node.data.keepPairs, force: true }); if (!prefix.length) break;
        snapshot = foldParameters(snapshot, prefix); records += prefix.length; stream = stream.slice(prefix.length);
      }
      Object.assign(context.resolved, { parameter_state: snapshot, message_stream: stream, context_summary: records ? '[Проверка без модели: здесь будет резюме старых реплик.]' : await context.readSource('context_summary'), user_message_count: userMessageCount(stream) });
      result = { trigger: true, dryRun: true, records, retainedUserMessages: userMessageCount(stream) };
    }
    result ||= { trigger: true, records: context.resolved.compaction?.records || 0, retainedUserMessages: await context.readSource('user_message_count'),
      ...(context.resolved.compaction?.usage ? { metadata: { usage: context.resolved.compaction.usage } } : {}) };
    for (const key of Object.keys(data.parts)) if (Object.hasOwn(context.resolved, key)) data.parts[key] = context.resolved[key];
    data.blocks = data.blocks.map(block => block.kind === 'source' && Object.hasOwn(data.parts, block.source) ? { ...block, value: data.parts[block.source] } : block);
    return Object.assign(result, data);
  }
}
class ContextNode {
  execute(node, context, incoming) {
    if (node.data.inputs) {
      const packet = assembleContext(node, context.activeInputs(node), context.event);
      checkAssembledContextSize(packet);
      context.packet = packet; return packet;
    }
    const data = carriedData(incoming), instructions = incoming.flatMap(item => item.instructions || []).filter(Boolean);
    const order = node.data.order?.flatMap(id => {
      if (id === '$request') return [id];
      const blocks = context.activeInputs(node).filter(({ edge }) => edge.source === id).flatMap(({ value }) => (value.blocks || []).map(b => b.id));
      return blocks.length ? blocks : [context.nodeId(id)];
    });
    const packet = { parts: data.parts, instructions, ...(order ? { blocks: orderContextBlocks(data.blocks, order) } : {}), transcript: String(context.event.transcript || ''), toolResult: context.event.toolResult || null };
    const measured = packet.blocks ? { blocks: packet.blocks, transcript: packet.transcript, toolResult: packet.toolResult } : packet;
    if (new TextEncoder().encode(JSON.stringify(measured)).length > 120000) fail('Контекст превышает 120 КБ. Уменьшите лимиты источников.');
    context.packet = packet; return packet;
  }
}
class ModelNode {
  async execute(node, context, incoming) {
    const packet = incoming[0];
    if (!packet?.parts) fail('Нет собранного контекста.');
    checkAssembledContextSize(packet);
    context.packet = packet;
    const result = context.runModel ? await context.runModel(packet, node.data, { signal: context.signal, nodeId: context.nodeId(node.id), modulePath: [...context.modulePath], localNodeId: node.id }) : { ok: true, reply: 'Проверка потока без вызова модели.', command: null, metadata: { dryRun: true } };
    if (!result?.ok) fail(result?.reply || 'Модель не завершила запрос.');
    return result;
  }
}
class SerializeNode {
  execute(node, _context, incoming) {
    if (!incoming[0]?.parts) fail('Сериализатору нужен объект контекста.');
    const packet = { ...incoming[0], serialization: serializeContext(incoming[0], node.data.format) };
    checkAssembledContextSize(packet);
    return packet;
  }
}
class McpNode {
  async execute(node, context, incoming) {
    let value;
    if (context.runMcp) value = await context.runMcp(node.data, { event: context.event, incoming, signal: context.signal });
    else if (context.runModel) fail('MCP-исполнитель недоступен.');
    else value = { dryRun: true, service: node.data.service, query: node.data.query || context.event.transcript, note: 'Проверка проводки: внешний инструмент не вызывался.' };
    const source = `mcp_${context.nodeId(node.id)}`;
    return { parts: { [source]: value }, blocks: [{ id: context.nodeId(node.id), kind: 'source', source, value }] };
  }
}
class ToolsNode { execute(node, _context, incoming) { return { ...incoming[0], flowTools: node.data }; } }
class ReplyNode { execute(_node, context, incoming) { context.answer = incoming[0]; return context.answer; } }
class SpeechNode { execute(node, context) { return { enabled: node.data.enabled, text: context.answer?.reply || '' }; } }
class ModuleNode { execute(node, context) { return context.executeModule(node); } }
class ModuleInputNode {
  execute(node, context) {
    const packet = structuredClone(context.fragment.inputs[node.data.port]);
    checkModulePacket(packet);
    delete packet.branch;
    return packet;
  }
}
class ModuleOutputNode {
  execute(node, context) {
    const incoming = context.activeInputs(node).map(({ edge, value }) => {
      // Model fields never masquerade as instructions or an assembled packet.
      const source = `${context.fragment.prefix}__${node.data.port}`;
      const fromModel = context.graph.nodes.find(n => n.id === edge.source)?.type === 'model';
      // Provider usage, cache metrics, raw payload and speech segments belong to
      // the trace, not to the next robot's context.
      const data = fromModel ? { ok: value.ok !== false, reply: String(value.reply ?? ''), command: structuredClone(value.command ?? null) } : structuredClone(value);
      const packet = !fromModel && (value.blocks || value.parts) ? structuredClone(value)
        : { parts: { [source]: data }, blocks: [{ id: context.nodeId(node.id), kind: 'source', source, value: structuredClone(data) }] };
      // Check before merging: Object.assign must never see a prototype setter key.
      return checkModulePacket(packet);
    });
    if (incoming.length > 1) fail(`${node.id}: в выход модуля пришло несколько значений. Используйте сборку контекста.`);
    const packet = incoming.length === 1 ? incoming[0] : { ...carriedData(incoming), instructions: incoming.flatMap(p => p.instructions || []) };
    // Branch handles belong to the condition node, never the surrounding module.
    delete packet.branch; delete packet.trigger; delete packet.event;
    return packet;
  }
}

/** Strategy registry: node semantics are independent of the editor and scheduler. */
export class NodeStrategyRegistry {
  constructor(strategies) { this.strategies = new Map(Object.entries(strategies)); }
  execute(node, context, incoming) {
    const strategy = this.strategies.get(node.type);
    if (!strategy) fail(`Нет исполнителя узла ${node.type}.`);
    return strategy.execute(node, context, incoming);
  }
}
export const defaultNodeStrategies = new NodeStrategyRegistry({ event: new EventNode(), source: new SourceNode(), prompt: new PromptNode(), condition: new ConditionNode(), compact: new CompactNode(), context: new ContextNode(), serialize: new SerializeNode(), mcp: new McpNode(), model: new ModelNode(), tools: new ToolsNode(), reply: new ReplyNode(), speech: new SpeechNode(), module: new ModuleNode(), module_input: new ModuleInputNode(), module_output: new ModuleOutputNode() });
