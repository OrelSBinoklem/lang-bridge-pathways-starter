import type { FlowGraph, TraceEvent } from './flowEditor';

export type LiveRunInfo = { id: string; userId: number; botId?: string; subject?: { type: string; id?: number }; conversationId: number | null; versionId: number | null; preset?: string; model?: string; startedAt: number; status: string; bytes: number; omitted: number; durationMs?: number; error?: string };
export type LiveRun = LiveRunInfo & { graph: FlowGraph | null; events: TraceEvent[]; event?: Record<string, unknown>; sources?: Record<string, unknown> };
export type LiveHistory = { recording: boolean; runs: LiveRunInfo[]; bytes: number; totalBytes: number; activeBytes: number; droppedRuns?: number; limits: { userBytes: number; totalBytes: number; activeBytes: number; runBytes: number; runsPerUser: number } };
export type DebugUsers = { users: { id: number; name: string; email: string }[]; conversations: { id: number; status: string; updated_at: string }[] };
export function traceAt(events: TraceEvent[], frame: number) { return events.slice(0, Math.max(0, Math.min(events.length, frame))); }
export function replayInput(run: LiveRun) {
  if (run.botId && run.botId !== 'tutor' || !run.graph || !run.event || !run.sources) return null;
  const sources = { ...run.sources };
  // Reuse captured values actually produced by source cards, including compaction.
  for (const event of run.events) if (event.type === 'source' && event.status === 'completed' && typeof event.outputPreview === 'string') {
    try { const value = JSON.parse(event.outputPreview); if (value.parts && typeof value.parts === 'object') for (const [key, part] of Object.entries(value.parts)) if (Object.hasOwn(sources, key)) sources[key] = part; } catch { /* Missing/limited fragments remain explicitly marked on the record. */ }
  }
  return { graph: run.graph, event: run.event, sources, preset: run.preset };
}
export const megabytes = (bytes = 0) => `${(bytes / 1048576).toFixed(2)} МБ`;

export function requestDiff(previous: string, current: string) {
  const changes: { path: string; before: string; after: string }[] = [];
  let visited = 0, limited = false;
  const text = (value: unknown) => { const json = JSON.stringify(value) ?? '∅'; return json.length > 600 ? `${json.slice(0, 600)}…` : json; };
  function walk(a: unknown, b: unknown, path: string) {
    if (++visited > 5000 || changes.length >= 100) { limited = true; return; }
    if (a === b) return;
    if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
      const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) { if (changes.length >= 100) { limited = true; break; } walk(left[key], right[key], `${path}.${key}`); }
    } else changes.push({ path, before: text(a), after: text(b) });
  }
  try { walk(JSON.parse(previous), JSON.parse(current), 'request'); }
  catch { walk(previous, current, 'request'); }
  return { changes, limited };
}
