import { validateGraph, topological } from './graph.mjs';
import { defaultNodeStrategies } from './node-strategies.mjs';

function preview(value, limit = 6000) {
  const ordered = value?.bundle ? { ...(value.serialization ? { serialization: value.serialization } : {}), bundle: value.bundle, parts: value.parts, blocks: value.blocks } : value;
  const text = typeof ordered === 'string' ? ordered : JSON.stringify(ordered ?? null);
  return text.length > limit ? text.slice(0, limit) + '…' : text;
}

/** One invocation, one isolated state. Both schedulers use exactly these node strategies. */
export class FlowExecutionSession {
  constructor(input, { event, sources = {}, runModel = null, runCompact = null, runMcp = null, onEvent = null, onData = null, signal, registry = defaultNodeStrategies, checkpoint = null } = {}, fragment = null) {
    this.graph = fragment ? { nodes: fragment.definition.nodes, edges: fragment.definition.edges } : validateGraph(input);
    this.fragment = fragment;
    this.nodeId = id => fragment ? `${fragment.prefix}__${id}` : id;
    this.modulePath = fragment?.modulePath || [];
    this.event = event; this.sources = sources; this.runModel = runModel; this.runCompact = runCompact; this.onEvent = onEvent; this.signal = signal; this.registry = registry;
    this.runMcp = runMcp;
    this.onData = onData;
    this.checkpoint = checkpoint;
    this.values = new Map(); this.runs = new Map(); this.settled = new Set(); this.trace = []; this.resolved = {}; this.answer = null; this.packet = null; this.failure = null;
    this.readSource = async key => {
      const value = Object.hasOwn(this.resolved, key) ? this.resolved[key] : typeof this.sources[key] === 'function' ? await this.sources[key]() : this.sources[key];
      return fragment && value !== undefined ? structuredClone(value) : value;
    };
    this.edgeValue = edge => {
      let value = this.values.get(edge.source);
      if (this.graph.nodes.find(n => n.id === edge.source)?.type === 'module') value = Object.hasOwn(value?.outputs || {}, edge.sourceHandle) ? value.outputs[edge.sourceHandle] : null;
      else if (value?.branch != null && String(value.branch) !== edge.sourceHandle) return null;
      return value;
    };
    this.activeInputs = node => this.graph.edges.filter(edge => edge.target === node.id).flatMap(edge => {
      const value = this.edgeValue(edge);
      return value ? [{ edge, value }] : [];
    });
  }
  restoreCompleted() {
    for (const id of topological(this.graph)) {
      const saved = this.checkpoint?.node(this.nodeId(id));
      if (!saved || !['completed', 'skipped'].includes(saved.status)) continue;
      this.values.set(id, structuredClone(saved.result)); this.settled.add(id);
      if (saved.patch?.resolved) Object.assign(this.resolved, structuredClone(saved.patch.resolved));
      if (saved.patch?.packet) this.packet = structuredClone(saved.patch.packet);
      if (saved.patch?.answer) this.answer = structuredClone(saved.patch.answer);
      if (saved.event) this.trace.push({ ...saved.event, restored: true });
      this.runs.set(id, Promise.resolve({ status: saved.status, result: structuredClone(saved.result) }));
    }
  }
  async emit(value, full = {}) { this.trace.push(value); await this.onEvent?.(value); await this.onData?.({ ...value, ...full }); }
  runNode(id) {
    if (this.failure) return Promise.reject(this.failure);
    if (this.runs.has(id)) return this.runs.get(id);
    const node = this.graph.nodes.find(node => node.id === id);
    if (!node) return Promise.reject(new Error('Неизвестный узел исполнения.'));
    const edges = this.graph.edges.filter(edge => edge.target === id);
    if (edges.some(edge => !this.settled.has(edge.source))) return Promise.reject(new Error(`Узел ${id}: входящие узлы ещё не завершены.`));
    const pending = Promise.resolve().then(() => this.invoke(node, edges));
    this.runs.set(id, pending);
    return pending;
  }
  async invoke(node, edges) {
    const incoming = edges.map(edge => this.edgeValue(edge)).filter(Boolean);
    const started = Date.now(), base = { nodeId: this.nodeId(node.id), type: node.type };
    try {
      this.signal?.throwIfAborted();
      if (node.type === 'event' ? node.data.event !== this.event.type : node.type === 'module_input' ? !Object.hasOwn(this.fragment.inputs, node.data.port) : incoming.length === 0) {
        const event = { ...base, status: 'skipped', at: new Date().toISOString(), durationMs: 0 };
        await this.checkpoint?.complete(base.nodeId, { status: 'skipped', result: null, event });
        await this.emit(event);
        this.settled.add(node.id); return { status: 'skipped', result: null };
      }
      const observedInput = node.type === 'event' ? this.event : node.type === 'module_input' ? this.fragment.inputs[node.data.port] : node.type === 'module' ? Object.fromEntries(this.activeInputs(node).map(({ edge, value }) => [edge.targetHandle, value])) : incoming;
      await this.emit({ ...base, status: 'running', at: new Date().toISOString(), inputPreview: preview(observedInput) },
        this.onData ? { inputPreview: preview(observedInput, Infinity) } : {});
      this.signal?.throwIfAborted();
      await this.checkpoint?.start(base.nodeId, node.type);
      this.signal?.throwIfAborted();
      const result = await this.registry.execute(node, this, incoming);
      const event = { ...base, status: 'completed', at: new Date().toISOString(), durationMs: Date.now() - started, outputPreview: preview(result),
        ...(node.type === 'condition' ? { observed: result.observed, branch: result.branch } : {}), ...(result?.metadata?.usage ? { usage: result.metadata.usage } : {}) },
        patch = { ...(node.type === 'compact' ? { resolved: this.resolved } : {}), ...(['context', 'model'].includes(node.type) ? { packet: this.packet } : {}), ...(node.type === 'reply' ? { answer: this.answer } : {}) };
      // Persist the returned result before cancellation/reporting: the provider may
      // already have charged it even if the socket disappeared in the meantime.
      await this.checkpoint?.complete(base.nodeId, { status: 'completed', result, patch, event });
      this.signal?.throwIfAborted();
      this.values.set(node.id, result); this.settled.add(node.id);
      await this.emit(event, this.onData ? { outputPreview: preview(result, Infinity) } : {});
      return { status: 'completed', result };
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error(String(caught));
      this.failure = error;
      // A callback failure must reject execution even if reporting that failure also fails.
      try { await this.emit({ ...base, status: 'failed', at: new Date().toISOString(), durationMs: Date.now() - started, error: error.message }); } catch { /* preserve the original failure */ }
      throw Object.assign(error, { flowTrace: this.trace });
    }
  }
  finish() {
    this.signal?.throwIfAborted();
    if (this.failure) throw this.failure;
    if (this.fragment) {
      if (this.settled.size !== this.graph.nodes.length) throw new Error('Модуль не завершён.');
      return { outputs: Object.fromEntries(this.graph.nodes.filter(n => n.type === 'module_output' && this.values.has(n.id)).map(n => [n.data.port, this.values.get(n.id)])) };
    }
    if (!this.answer || this.settled.size !== this.graph.nodes.length) throw new Error('Исполнитель не завершил схему. Ответ не опубликован.');
    return { answer: this.answer, packet: this.packet, trace: this.trace, speech: this.graph.nodes.find(node => node.type === 'speech').data.enabled };
  }
  async runAll() { for (const id of topological(this.graph)) await this.runNode(id); return this.finish(); }
  async executeModule(node) {
    const inputs = Object.create(null);
    for (const { edge, value } of this.activeInputs(node)) {
      if (Object.hasOwn(inputs, edge.targetHandle)) throw new Error(`${node.id}: во вход модуля пришло несколько значений.`);
      inputs[edge.targetHandle] = structuredClone(value);
    }
    const child = new FlowExecutionSession(null, {
      event: structuredClone(this.event), sources: this.readSourceProxy(), runModel: this.runModel, runMcp: this.runMcp, signal: this.signal, registry: this.registry,
      onEvent: value => { this.trace.push(value); return this.onEvent?.(value); }, onData: this.onData, checkpoint: this.checkpoint,
    }, { definition: node.data.definition, prefix: this.nodeId(node.id), modulePath: [...this.modulePath, node.id], inputs });
    child.restoreCompleted(); return child.runAll();
  }
  readSourceProxy() { return new Proxy(Object.create(null), { get: (_target, key) => () => this.readSource(key) }); }
}
