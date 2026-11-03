import { canonicalJson, journalInputMessages } from './journal.mjs';

export const defaultContextInputs = () => ['Инструкции', 'Резюме', 'Параметры', 'Переписка', 'Интернет', 'Таблицы', 'Дополнительно', 'Дополнительно 2'].map((label, i) => ({ id: `in${i + 1}`, label, key: ['instructions', 'summary', 'parameters', 'dialogue', 'web', 'tables', 'extra', 'extra2'][i] }));

/** Explicit local/editor upgrade; saved historical versions remain immutable. */
export function upgradeVisualAssembly(input) {
  const graph = structuredClone(input);
  for (const node of graph.nodes.filter(n => n.type === 'context' && !n.data.inputs)) {
    const legacyOrder = node.data.order || [], assigned = new Map();
    let next = 1;
    for (const id of legacyOrder.filter(id => id !== '$request')) if (next <= 8) assigned.set(id, `in${next++}`);
    for (const edge of graph.edges.filter(e => e.target === node.id)) {
      if (!assigned.has(edge.source)) assigned.set(edge.source, `in${Math.min(next++, 8)}`);
      // The condition/compact wire is the same journal carried through either branch.
      const source = graph.nodes.find(n => n.id === edge.source);
      if (['condition', 'compact'].includes(source?.type)) {
        const streamId = graph.nodes.find(n => n.type === 'source' && n.data.source === 'message_stream')?.id;
        if (assigned.has(streamId)) assigned.set(edge.source, assigned.get(streamId));
      }
      edge.targetHandle = assigned.get(edge.source);
    }
    const inputs = defaultContextInputs();
    for (const [id, portId] of assigned) {
      const source = graph.nodes.find(n => n.id === id), port = inputs.find(p => p.id === portId);
      if (!source || !port || !['source', 'prompt'].includes(source.type)) continue;
      if (source.type === 'prompt') { port.label = 'Инструкции'; port.key = 'instructions'; }
      else {
        port.key = source.data.source;
        port.label = ({ context_summary: 'Резюме', parameter_state: 'Параметры', message_stream: 'Переписка' })[source.data.source] || source.data.source;
      }
    }
    // Avoid key collisions when the old order assigned a source to a default slot.
    const seen = new Set(); for (const port of inputs) { if (seen.has(port.key)) port.key = `input${port.id.slice(2)}`; seen.add(port.key); }
    node.data = { mode: 'object', inputs, order: [...inputs.map(p => p.id), '$request'] };
  }
  if (!graph.nodes.some(n => n.type === 'serialize')) {
    const model = graph.nodes.find(n => n.type === 'model'), edge = graph.edges.find(e => e.target === model?.id);
    if (edge && graph.nodes.find(n => n.id === edge.source)?.type === 'context') {
      let id = 'serialize'; while (graph.nodes.some(n => n.id === id)) id += '_1';
      const modelX = model.position.x;
      graph.nodes.push({ id, type: 'serialize', position: { x: modelX + 150, y: model.position.y }, data: { format: 'messages' } });
      edge.target = id; edge.targetHandle = 'in';
      graph.edges.push({ id: `${id}_model`, source: id, target: model.id, sourceHandle: 'out', targetHandle: 'in' });
      for (const n of graph.nodes) if (n.id !== id && n.position.x >= modelX) n.position.x += 600;
    }
  }
  return graph;
}

const sourceValue = blocks => {
  if (blocks.length === 1) { const b = blocks[0]; return b.kind === 'prompt' ? b.text : b.value; }
  return Object.fromEntries(blocks.map(b => [b.kind === 'prompt' ? b.id : b.source || b.id, b.kind === 'prompt' ? b.text : b.value]));
};
export function bundleValue(entries, mode) {
  const object = Object.fromEntries(entries.filter(e => e.connected).map(e => [e.key, e.value]));
  if (mode === 'json') return canonicalJson(object);
  if (mode === 'text') return entries.filter(e => e.connected).map(e => `${e.label}\n${typeof e.value === 'string' ? e.value : canonicalJson(e.value)}`).join('\n\n');
  return object;
}
export function assembleContext(node, linkedInputs, event) {
  const ports = node.data.inputs || defaultContextInputs();
  const ids = [...(node.data.order || ports.map(p => p.id))];
  for (const p of ports) if (!ids.includes(p.id)) ids.splice(Math.max(0, ids.indexOf('$request')), 0, p.id);
  if (!ids.includes('$request')) ids.push('$request');
  const entries = [], blocks = new Map(), parts = {}, instructions = [];
  for (const id of ids) {
    if (id === '$request') {
      entries.push({ port: id, key: 'current_request', label: 'Текущий запрос', connected: true, value: { transcript: String(event.transcript || ''), toolResult: event.toolResult || null } });
      blocks.set('$request', { id: '$request', kind: 'request' }); continue;
    }
    const port = ports.find(p => p.id === id); if (!port) continue;
    const wires = linkedInputs.filter(x => x.edge.targetHandle === id);
    if (wires.length > 1) throw new Error(`${node.id}: во вход ${port.label} одновременно пришло несколько значений. Используйте отдельную сборку.`);
    const value = wires[0]?.value;
    const inputBlocks = value?.blocks || [];
    for (const b of inputBlocks) if (b.kind !== 'request') blocks.set(b.id, b);
    Object.assign(parts, value?.parts || {}); instructions.push(...(value?.instructions || []));
    entries.push({ port: id, key: port.key, label: port.label, connected: !!value, sourceId: wires[0]?.edge.source || null,
      value: value ? value.bundle ? value.bundle.value : sourceValue(inputBlocks) : null,
      ...(value?.bundle ? { child: value.bundle } : {}), blocks: inputBlocks.filter(b => b.kind !== 'request') });
  }
  const mode = node.data.mode || 'object';
  return { parts, instructions, blocks: [...blocks.values()], transcript: String(event.transcript || ''), toolResult: event.toolResult || null,
    bundle: { kind: 'context_bundle', mode, entries, value: bundleValue(entries, mode) } };
}

/** Rebuild derived values after preset limits, so a basic preset cannot leak the full journal via JSON/text. */
export function refreshContextPacket(packet, parts = packet.parts) {
  const block = b => b.kind === 'source' && Object.hasOwn(parts, b.source) ? { ...b, value: parts[b.source] } : b;
  const rebuild = bundle => {
    const entries = bundle.entries.map(e => {
      if (!e.connected || e.port === '$request') return e;
      const blocks = (e.blocks || []).map(block), child = e.child && rebuild(e.child);
      return { ...e, blocks, ...(child ? { child } : {}), value: child ? child.value : sourceValue(blocks) };
    });
    return { ...bundle, entries, value: bundleValue(entries, bundle.mode) };
  };
  return { ...packet, parts, blocks: packet.blocks?.map(block), ...(packet.bundle ? { bundle: rebuild(packet.bundle) } : {}) };
}
export function serializeContext(packet, format) {
  if (format === 'messages') {
    if (!packet.bundle || packet.bundle.mode === 'object') return { format, value: packet.blocks || [] };
    return { format, value: [...(packet.blocks || []).filter(b => b.kind === 'prompt'),
      { id: 'assembled_payload', kind: 'data', format: packet.bundle.mode, value: packet.bundle.value }, { id: '$request', kind: 'request' }] };
  }
  const entries = packet.bundle?.entries.filter(e => e.connected) || (packet.blocks || []).map(b => ({ key: b.source || b.id, label: b.source || b.id, connected: true, value: b.kind === 'prompt' ? b.text : b.value }));
  return { format, value: format === 'json' ? canonicalJson(Object.fromEntries(entries.map(e => [e.key, e.value]))) : entries.map(e => `${e.label}\n${typeof e.value === 'string' ? e.value : canonicalJson(e.value)}`).join('\n\n') };
}
export function modelContextBlocks(input) {
  const packet = refreshContextPacket(input);
  if (!packet.serialization || packet.serialization.format === 'messages') return packet.bundle ? serializeContext(packet, 'messages').value : packet.blocks || null;
  const serialized = serializeContext(packet, packet.serialization.format);
  return [...(packet.blocks || []).filter(b => b.kind === 'prompt'), { id: 'assembled_payload', kind: 'data', value: serialized.value, format: serialized.format }, { id: '$request', kind: 'request' }];
}

/** Measure the context messages, not the packet's mirrored parts/blocks/bundle views.
 * This follows orderedPrompt's data envelopes; shared server rules and model cache markers
 * are not source context. Recheck after serialization, which can change the representation. */
export function modelContextByteLength(packet) {
  const user = content => ({ role: 'user', content });
  const request = { transcript: String(packet.transcript || ''), transcript_candidates: packet.parts.transcript_candidates || [],
    transcription_strategy: packet.transcriptionStrategy || null, toolResult: packet.toolResult || null };
  const messages = (modelContextBlocks(packet) || []).flatMap(block => {
    if (block.kind === 'prompt') return [{ role: 'developer', content: block.text }];
    if (block.kind === 'request') return [user(canonicalJson({ current_request: request }))];
    if (block.kind === 'source' && block.source === 'message_stream') return journalInputMessages(block.value || []);
    if (block.kind === 'source') return [user(canonicalJson({ context_block: { source: block.source, value: block.value ?? null } }))];
    if (block.kind === 'data') return [user(block.value)];
    return [];
  });
  return new TextEncoder().encode(JSON.stringify(messages)).length;
}
