import { FlowExecutionSession } from '../../../../../resources/tutor-flow/graph.mjs';
import { compileTutorGraph } from './LangGraphCompiler.mjs';
import { ExecutionCheckpointStore, executionFingerprint } from './ExecutionCheckpointStore.mjs';
import { DurableGraphSaver } from './DurableGraphSaver.mjs';

/** Product policy while Studio is deferred. This process hosts the tutor only;
 * no invocation may turn on external SDK tracing through inherited environment.
 * The local onEvent/admin debug channel is independent and remains enabled. */
export class LocalFlowTracePolicy {
  enforce() {
    process.env.LANGSMITH_TRACING = 'false';
    process.env.LANGCHAIN_TRACING_V2 = 'false';
    delete process.env.LANGCHAIN_TRACING;
  }
}

export class NativeFlowAdapter { async execute(session) { return { ...await session.runAll(), engine: 'native' }; } }
export class LangGraphAdapter {
  constructor({ tracePolicy = new LocalFlowTracePolicy() } = {}) { this.tracePolicy = tracePolicy; }
  async execute(session, { lease, resume, pauseBefore } = {}) {
    this.tracePolicy.enforce();
    const graph = compileTutorGraph(session.graph, { session, checkpointer: lease ? new DurableGraphSaver(lease) : undefined,
      interruptBefore: pauseBefore ? [pauseBefore] : undefined });
    const config = { signal: session.signal,
      ...(lease ? { configurable: { thread_id: lease.record.id }, durability: 'sync' } : {}),
      recursionLimit: session.graph.nodes.length + 4, callbacks: [], runName: 'tutor-flow' };
    await graph.invoke(resume ? null : {}, config);
    if (lease) {
      const state = await graph.getState(config);
      if (state.next.length) return { paused: true, next: state.next, trace: session.trace, engine: 'langgraph' };
    }
    return { ...session.finish(), engine: 'langgraph' };
  }
}

/** Application facade + Adapter pattern: the bot never knows which scheduler runs its graph. */
export class FlowExecutionService {
  constructor({ native = new NativeFlowAdapter(), langgraph = new LangGraphAdapter(), checkpoints = new ExecutionCheckpointStore() } = {}) {
    this.adapters = new Map([['native', native], ['langgraph', langgraph]]); this.checkpoints = checkpoints;
  }
  async execute(graph, options = {}) {
    const { recovery, ...sessionOptions } = options;
    const session = new FlowExecutionSession(graph, sessionOptions), engine = session.graph.engine || 'native';
    if (!recovery) return this.adapters.get(engine).execute(session);
    if (engine !== 'langgraph') throw Error('Контрольные снимки доступны для движка LangGraph.');
    // Recovery must be tied to fixed input data, never closures over a changing
    // request/user. Production and Studio pass fully materialized JSON sources.
    const jsonSources = JSON.stringify(options.sources ?? {}, (_key, value) => {
      if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') throw Error('Для восстановления нужны готовые JSON-источники, а не функции.');
      return value;
    });
    if (recovery.pauseBefore && !session.graph.nodes.some(node => node.id === recovery.pauseBefore)) throw Error('Неизвестный узел остановки.');
    const fingerprint = executionFingerprint({ graph: session.graph, event: options.event, sources: JSON.parse(jsonSources), settings: recovery.settings });
    const lease = await this.checkpoints.acquire({ owner: recovery.owner, fingerprint, id: recovery.id, resume: recovery.resume });
    session.checkpoint = lease;
    let status = 'failed';
    try {
      const uncertain = lease.summary().uncertain;
      if (uncertain.length) throw Error(`Результат внешнего вызова неизвестен: ${uncertain.join(', ')}. Автоповтор запрещён; проверьте операции кредитов.`);
      session.restoreCompleted();
      if (recovery.resume) for (const saved of Object.values(lease.record.nodes)) if (saved.event) {
        const event = { ...saved.event, restored: true }; await options.onEvent?.(event); await options.onData?.(event);
      }
      const result = await this.adapters.get(engine).execute(session, { lease, resume: recovery.resume, pauseBefore: recovery.pauseBefore });
      status = result.paused ? 'paused' : 'completed';
      return { ...result, checkpoint: { ...lease.summary(), status, next: result.next || [] } };
    } finally {
      // Wait for parallel branches before releasing the single-run lease.
      await Promise.allSettled([...session.runs.values()]);
      try { await lease.close(status); }
      finally {
        const event = { nodeId: '@checkpoint', type: 'execution_checkpoint', status: status === 'failed' ? 'failed' : 'completed',
          at: new Date().toISOString(), outputPreview: JSON.stringify({ ...lease.summary(), status }) };
        await options.onEvent?.(event); await options.onData?.(event);
      }
    }
  }
  async close() { for (const adapter of this.adapters.values()) await adapter.close?.(); }
}
export const flowExecutionService = new FlowExecutionService();
