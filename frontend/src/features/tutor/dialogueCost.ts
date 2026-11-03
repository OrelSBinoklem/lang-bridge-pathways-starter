export type DialogueCostInput = {
  dialogueActs: number;
  callsPerAct: number;
  fixedContextTokens: number;
  initialHistoryTokens: number;
  userTokensPerAct: number;
  outputTokensPerCall: number;
  reasoningTokensPerCall: number;
  toolTokensPerCall: number;
  cacheHitPercent: number;
  historyTokenLimit: number;
};

export type DialogueRate = { input: number; cachedInput: number; output: number; cacheWrite?: number };

export type DialogueMemoryInput = {
  retainedHistoryActs: number;
  summaryBatchActs: number;
  summaryTokensPerRun: number;
  summaryReasoningTokensPerRun: number;
};
type MemoryOptions = DialogueMemoryInput & { enabled: boolean };

const bounded = (value: number, max = 1_000_000) => Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : 0;

// A synthetic hourly scenario, not provider usage or financial settlement.
// Each act adds one user message; additional model calls add tool results.
// Hidden reasoning is charged as output but is not replayed as visible history here.
export function estimateDialogueCost(input: DialogueCostInput, model: string, rate?: DialogueRate, memory?: MemoryOptions) {
  const acts = Math.floor(bounded(input.dialogueActs, 1000));
  const callsPerAct = Math.max(1, bounded(input.callsPerAct, 20));
  const fixed = bounded(input.fixedContextTokens);
  const limit = bounded(input.historyTokenLimit);
  let history = bounded(input.initialHistoryTokens);
  const user = bounded(input.userTokensPerAct);
  const visible = bounded(input.outputTokensPerCall);
  const reasoning = bounded(input.reasoningTokensPerCall);
  const tool = bounded(input.toolTokensPerCall);
  const compress = memory?.enabled === true;
  const retainedActs = Math.floor(bounded(memory?.retainedHistoryActs ?? 5, 1000));
  const batchActs = Math.max(1, Math.floor(bounded(memory?.summaryBatchActs ?? 10, 1000)));
  const summarySize = Math.max(1, bounded(memory?.summaryTokensPerRun ?? 400));
  const summaryReasoning = bounded(memory?.summaryReasoningTokensPerRun ?? 0);
  // Initial raw history represents the retained acts at the beginning of the hour.
  const initialActs = history > 0 ? Math.max(1, retainedActs) : 0;
  const pendingActs = Array.from({ length: initialActs }, () => history / initialActs);
  let summaryTokens = 0, summaryChanged = false;
  const compressions: { beforeAct: number; sourceTokens: number; inputTokens: number; outputTokens: number; reasoningTokens: number }[] = [];
  const hit = bounded(input.cacheHitPercent, 100) / 100;
  const version = /^gpt-(\d+)(?:\.(\d+))?/.exec(model);
  const paidWrites = Boolean(version && (Number(version[1]) > 5 || (Number(version[1]) === 5 && Number(version[2]) >= 6)));
  // Older-model eligibility varies by request; 1024/128 is an explicit estimate.
  const block = paidWrites ? 1 : 128;
  const cacheable = (tokens: number) => tokens < 1024 ? 0 : Math.floor(tokens / block) * block;
  const writeRate = paidWrites && rate ? rate.cacheWrite ?? rate.input * 1.25 : null;
  const requests: { act: number; input: number; uncached: number; cached: number; writes: number }[] = [];
  let previousInput = 0, historyTrims = 0;
  let inputTokens = 0, uncachedTokens = 0, cachedTokens = 0, cacheWriteTokens = 0;

  for (let act = 0; act < acts; act++) {
    if (compress) while (pendingActs.length >= batchActs + retainedActs) {
      const sourceTokens = pendingActs.splice(0, batchActs).reduce((sum, tokens) => sum + tokens, 0);
      // Includes previous summary and an explicit ~200-token formatting/instruction allowance.
      const inputTokens = Math.ceil(sourceTokens + summaryTokens + 200);
      compressions.push({ beforeAct: act + 1, sourceTokens, inputTokens, outputTokens: summarySize, reasoningTokens: summaryReasoning });
      history = pendingActs.reduce((sum, tokens) => sum + tokens, 0);
      summaryTokens = summarySize;
      summaryChanged = true;
    }
    let actTokens = 0;
    const count = Math.round((act + 1) * callsPerAct) - Math.round(act * callsPerAct);
    for (let call = 0; call < count; call++) {
      const trimmed = !compress && limit > 0 && history > limit;
      if (trimmed) { history = limit; historyTrims++; }
      // Always charge the complete new message/tool result, even if it exceeds the old-history window.
      history += call === 0 ? user : tool;
      actTokens += (call === 0 ? user : tool) + visible;
      const total = fixed + history + summaryTokens;
      // A rolling-history change invalidates its old prefix; only fixed context survives.
      const reusable = requests.length === 0 ? 0 : trimmed || summaryChanged ? fixed : Math.min(previousInput, total);
      summaryChanged = false;
      const cached = cacheable(Math.floor(cacheable(reusable) * hit));
      const writes = paidWrites ? Math.max(0, cacheable(total) - cached) : 0;
      const uncached = total - cached - writes;
      requests.push({ act: act + 1, input: total, uncached, cached, writes });
      inputTokens += total; uncachedTokens += uncached; cachedTokens += cached; cacheWriteTokens += writes;
      previousInput = total;
      history += visible;
    }
    if (compress) pendingActs.push(actTokens);
  }
  const calls = requests.length;
  const visibleOutputTokens = visible * calls, reasoningTokens = reasoning * calls;
  const outputTokens = visibleOutputTokens + reasoningTokens;
  const peakInputTokens = requests.reduce((max, request) => Math.max(max, request.input), 0);
  const longContext = peakInputTokens > 272000 && (paidWrites || /^gpt-5\.(4|5)(?:-|$)/.test(model) && !model.includes('mini'));
  // Do not silently use the short-context rate when a long-context tariff is needed.
  const cost = rate && !longContext
    ? (uncachedTokens * rate.input + cachedTokens * rate.cachedInput + cacheWriteTokens * (writeRate ?? rate.input) + outputTokens * rate.output) / 1_000_000
    : null;
  const noCacheCost = rate && !longContext ? (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000 : null;
  const memoryVolume = {
    messageEmbeddingTokens: acts * (user + visible),
    compressionCalls: compressions.length,
    summaryInputTokens: compressions.reduce((sum, run) => sum + run.inputTokens, 0),
    summaryOutputTokens: compressions.reduce((sum, run) => sum + run.outputTokens, 0),
    summaryReasoningTokens: compressions.reduce((sum, run) => sum + run.reasoningTokens, 0),
    compressions,
  };
  return {
    acts, calls, inputTokens, uncachedTokens, cachedTokens, cacheWriteTokens,
    visibleOutputTokens, reasoningTokens, outputTokens, historyTrims,
    firstInputTokens: requests[0]?.input ?? 0,
    lastInputTokens: requests.at(-1)?.input ?? 0,
    averageInputTokens: calls ? inputTokens / calls : 0,
    peakInputTokens, writeRate, longContext, cost, noCacheCost, requests, memory: memoryVolume,
  };
}

export type DialogueCostEstimate = ReturnType<typeof estimateDialogueCost>;

export function priceDialogueMemory(dialogue: DialogueCostEstimate, summaryModel: string, summaryRate?: DialogueRate, embeddingInputRate?: number) {
  const tokens = dialogue.memory.messageEmbeddingTokens;
  const messageEmbeddings = tokens === 0 ? 0 : typeof embeddingInputRate === 'number' ? tokens * embeddingInputRate / 1_000_000 : null;
  const costs = dialogue.memory.compressions.map(run => estimateDialogueCost({
    dialogueActs: 1, callsPerAct: 1, fixedContextTokens: 0, initialHistoryTokens: 0,
    userTokensPerAct: run.inputTokens, outputTokensPerCall: run.outputTokens,
    reasoningTokensPerCall: run.reasoningTokens, toolTokensPerCall: 0,
    cacheHitPercent: 0, historyTokenLimit: 0,
  }, summaryModel, summaryRate).cost);
  const summary = costs.some(cost => cost == null) ? null : costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0);
  const parts = [dialogue.cost, messageEmbeddings, summary];
  const brainTotal = parts.some(cost => cost == null) ? null : parts.reduce<number>((sum, cost) => sum + (cost ?? 0), 0);
  return { messageEmbeddings, summary, brainTotal };
}
