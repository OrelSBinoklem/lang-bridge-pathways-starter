import type { Command } from '../commands/adapters/contracts.mjs';

export type LoopDecision = { ok: boolean; reason?: string };
export type LoopClock = {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};
export type ToolLoopEvent = {
  type: 'tool_loop'; nodeId: string; at: string;
  status: 'running' | 'completed' | 'skipped' | 'failed'; iteration: number;
  phase: 'model' | 'command' | 'feedback' | 'usage' | 'finish';
  inputPreview?: unknown; outputPreview?: unknown; reason?: string;
};
export type LoopOptions = {
  maxSteps: number; timeoutMs?: number; maxRepeatedCommand?: number; maxCostUsd?: number;
  nodeId?: string; onEvent?: (event: ToolLoopEvent) => void; clock?: LoopClock;
};
export type LoopObservation = {
  reason: string; iterations: number; commands: number; elapsedMs: number;
  costKnown: boolean;
  cost: { status: 'unavailable' | 'available' | 'partial'; actualUsd: number | null; reportedCalls: number; unreportedCalls: number };
};
const systemClock: LoopClock = {
  now: () => Date.now(), setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
function integer(value: number, min: number, max: number, field: string) {
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`${field} must be ${min}..${max}`);
  return value;
}
function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
/** Cost must already have been reported in USD by the executing operation.
 * Never estimates tokens, credits, provider prices or missing usage. */
function actualCost(value: unknown): number | undefined {
  const row = object(value), metadata = object(row?.metadata), usage = object(row?.usage);
  const cost = row?.cost ?? row?.costUsd ?? metadata?.cost ?? metadata?.costUsd ?? usage?.cost ?? usage?.costUsd;
  const item = object(cost);
  if (row?.estimated === true || item?.estimated === true) return undefined;
  const usd = typeof cost === 'number' ? cost : item?.usd ?? item?.totalUsd ?? item?.total_usd;
  return typeof usd === 'number' && Number.isFinite(usd) && usd >= 0 ? usd : undefined;
}
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    const row = object(item);
    return row ? Object.fromEntries(Object.keys(row).sort().map(key => [key, row[key]])) : item;
  }) ?? 'undefined';
}
function resultKey(value: unknown): string {
  const row = object(value);
  // UUID/timing/usage changes are not new evidence. Keep the actual UI reply.
  const client = object(row?.clientToolResult);
  const evidence = client ? Object.fromEntries(Object.entries(client).filter(([key]) => !['commandId', 'requestId', 'durationMs', 'latencyMs', 'usage', 'metadata'].includes(key))) : row?.clientToolResult;
  return stable(row && 'clientToolResult' in row ? evidence : row?.type === 'command.result'
    ? { ok: row.ok, command: row.command, action: row.action, message: row.message, errors: row.errors }
    : value);
}

/** One instance per turn. This helper never calls a model, executes a command,
 * retries a failed operation or mutates the existing tool-result contract. */
export class ToolLoopController {
  readonly signal: AbortSignal;
  private readonly controller = new AbortController();
  private readonly clock: LoopClock;
  private readonly startedAt: number;
  private readonly timeoutMs: number;
  private readonly maxRepeatedCommand: number;
  private readonly timer: unknown;
  private readonly unlink: (() => void)[] = [];
  private iterations = 0;
  private commands = 0;
  private pending?: string;
  private commandInIteration = false;
  private previousCommand?: string;
  private previousResult?: string;
  private repeated = 0;
  private totalCost = 0;
  private reportedCalls = 0;
  private unreportedCalls = 0;
  private observation?: LoopObservation;

  constructor(private readonly options: LoopOptions) {
    integer(options.maxSteps, 1, 6, 'maxSteps');
    this.timeoutMs = integer(options.timeoutMs ?? 120000, 1, 300000, 'timeoutMs');
    this.maxRepeatedCommand = integer(options.maxRepeatedCommand ?? 2, 2, 3, 'maxRepeatedCommand');
    if (options.maxCostUsd !== undefined && (!Number.isFinite(options.maxCostUsd) || options.maxCostUsd < 0)) throw new RangeError('maxCostUsd must be a nonnegative finite USD amount');
    this.clock = options.clock ?? systemClock;
    this.startedAt = this.clock.now();
    this.signal = this.controller.signal;
    this.timer = this.clock.setTimeout(() => this.stop('timeout'), this.timeoutMs);
  }

  /** Zero-based, sequential model index. Pass the returned controller.signal to
   * both the model and any pending tools; merely checking guards cannot cancel I/O. */
  beforeModel(index: number, { signal }: { signal?: AbortSignal } = {}): LoopDecision {
    if (signal && signal !== this.signal && !this.observation) {
      const abort = () => this.stop('aborted');
      if (signal.aborted) abort();
      else { signal.addEventListener('abort', abort, { once: true }); this.unlink.push(() => signal.removeEventListener('abort', abort)); }
    }
    const guard = this.guard();
    if (!guard.ok) return guard;
    if (!Number.isInteger(index) || index !== this.iterations || this.pending) return this.stop('invalid_model_sequence');
    if (index >= this.options.maxSteps) return this.stop('max_steps');
    this.iterations++;
    this.commandInIteration = false;
    this.emit('model', 'running');
    return { ok: true };
  }

  beforeCommand(command: Command): LoopDecision {
    const guard = this.guard();
    if (!guard.ok) return guard;
    if (!command || typeof command.name !== 'string' || !command.name || !this.iterations || this.pending || this.commandInIteration) return this.stop('invalid_command_sequence');
    // The last model iteration is reserved for its final answer, as in server.mjs.
    if (this.iterations >= this.options.maxSteps || this.commands >= this.options.maxSteps - 1) return this.stop('max_steps');
    const key = stable({ name: command.name, params: command.params ?? {} });
    if (key === this.previousCommand && this.repeated >= this.maxRepeatedCommand) return this.stop('no_progress');
    this.pending = key;
    this.commandInIteration = true;
    this.commands++;
    this.emit('command', 'running', command);
    return { ok: true };
  }

  afterCommand(command: Command, result: unknown): void {
    if (this.observation) return;
    const key = stable({ name: command.name, params: command.params ?? {} });
    if (!this.pending || key !== this.pending) throw new Error('afterCommand must match the pending command');
    const evidence = resultKey(result);
    this.repeated = key === this.previousCommand && evidence === this.previousResult ? this.repeated + 1 : 1;
    this.previousCommand = key;
    this.previousResult = evidence;
    this.pending = undefined;
    const row = object(result), client = object(row?.clientToolResult);
    const failed = row?.ok === false || client?.ok === false;
    this.emit('feedback', failed ? 'failed' : 'completed', command, result);
  }

  /** True only after a reported cost and with no unknown paid settlements. */
  get costKnown(): boolean { return this.reportedCalls > 0 && this.unreportedCalls === 0; }

  /** Record one paid settlement from the caller's billing observer. null means
   * that paid call's actual cost is unavailable. Check thresholds on the NEXT
   * request; the last paid request may cross a soft threshold. Do not also call
   * recordUsage for the same settlement. Free tools need no cost observation. */
  recordCost(costUsd: number | null): void {
    if (this.observation) return;
    if (costUsd !== null && (!Number.isFinite(costUsd) || costUsd < 0)) throw new RangeError('Actual cost must be nonnegative finite USD or null');
    if (costUsd === null) this.unreportedCalls++;
    else { this.reportedCalls++; this.totalCost += costUsd; }
    this.emit('usage', 'completed', undefined, { ...this.cost(), costKnown: this.costKnown });
  }

  /** Optional metadata fallback when there is no billing observer. Call exactly
   * once per paid operation. No actual cost => explicitly unavailable; no token
   * estimates. afterCommand deliberately does not infer a paid settlement. */
  recordUsage(usage: unknown): void {
    this.recordCost(actualCost(usage) ?? null);
  }

  finish(reason: string): LoopObservation {
    if (this.observation) return this.observation;
    this.clock.clearTimeout(this.timer);
    this.unlink.splice(0).forEach(dispose => dispose());
    this.observation = { reason, iterations: this.iterations, commands: this.commands,
      elapsedMs: Math.max(0, this.clock.now() - this.startedAt), costKnown: this.costKnown, cost: this.cost() };
    this.emit('finish', ['completed', 'success', 'no_command'].includes(reason) ? 'completed' : 'failed', undefined, this.observation, reason);
    return this.observation;
  }

  private cost(): LoopObservation['cost'] {
    return { status: !this.reportedCalls ? 'unavailable' : this.unreportedCalls ? 'partial' : 'available',
      actualUsd: this.reportedCalls ? this.totalCost : null, reportedCalls: this.reportedCalls, unreportedCalls: this.unreportedCalls };
  }
  private guard(): LoopDecision {
    if (this.observation) return { ok: false, reason: this.observation.reason };
    if (this.clock.now() - this.startedAt >= this.timeoutMs) return this.stop('timeout');
    if (this.options.maxCostUsd !== undefined) {
      if (this.unreportedCalls) return this.stop('cost_unavailable');
      if (this.totalCost >= this.options.maxCostUsd) return this.stop('max_cost');
    }
    return { ok: true };
  }
  private stop(reason: string): LoopDecision {
    if (!this.observation) {
      this.controller.abort(new Error(`Tool loop stopped: ${reason}`));
      this.finish(reason);
    }
    return { ok: false, reason: this.observation?.reason ?? reason };
  }
  private emit(phase: ToolLoopEvent['phase'], status: ToolLoopEvent['status'], inputPreview?: unknown, outputPreview?: unknown, reason?: string) {
    this.options.onEvent?.({ type: 'tool_loop', nodeId: this.options.nodeId ?? '@tools', at: new Date(this.clock.now()).toISOString(),
      status, iteration: this.iterations, phase, ...(inputPreview === undefined ? {} : { inputPreview }),
      ...(outputPreview === undefined ? {} : { outputPreview }), ...(reason ? { reason } : {}) });
  }
}
