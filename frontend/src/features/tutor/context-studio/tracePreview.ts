import type { FlowEdge, TraceEvent } from './flowEditor';

export type PreviewText = { text: string; truncated: boolean };
export type TracePreview = { status: TraceEvent['status'] | 'not-run' | 'unconfirmed'; note: string; input?: PreviewText; output?: PreviewText; error?: string; durationMs?: number; branch?: boolean };
export type HoverTarget = { kind: 'node' | 'edge'; id: string; x: number; y: number; handleId?: string; direction?: 'source' | 'target' };
export function boundedPreview(value: unknown, limit = 4000): PreviewText | undefined {
  if (value === undefined) return undefined;
  let text: string;
  try { text = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value); } catch { text = 'Нечитаемый фрагмент трассы'; }
  return { text: text.length > limit ? `${text.slice(0, limit)}…` : text, truncated: text.length > limit || text.endsWith('…') };
}
function readBranch(event?: TraceEvent): boolean | undefined {
  if (typeof event?.branch === 'boolean') return event.branch;
  try { const value = typeof event?.outputPreview === 'string' ? JSON.parse(event.outputPreview) : event?.outputPreview; return value && typeof value === 'object' && 'branch' in value && typeof value.branch === 'boolean' ? value.branch : undefined; } catch { return undefined; }
}
export function nodeTracePreview(nodeId: string, events: TraceEvent[], limit = 4000, port?: { handleId?: string; direction?: string }): TracePreview {
  const own = events.filter(event => event.nodeId === nodeId), latest = own.at(-1);
  if (!latest) return { status: 'not-run', note: 'Данных выбранного запуска нет. Запустите тест и выберите его в истории.' };
  if (latest.type === 'module' && port?.handleId) {
    const output = port.direction === 'source', payload = output ? latest.outputPreview : [...own].reverse().find(event => event.inputPreview !== undefined)?.inputPreview;
    let value: Record<string, unknown> | undefined;
    try { const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload; if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) value = (output ? (parsed as { outputs?: Record<string, unknown> }).outputs : parsed) as Record<string, unknown>; } catch { /* Keep a partial snapshot unconfirmed. */ }
    if (!value) return { status: latest.status === 'failed' ? 'failed' : 'unconfirmed', error: latest.error, note: 'В снимке нет полного значения выбранного порта модуля.' };
    if (!Object.hasOwn(value, port.handleId)) return { status: 'skipped', note: 'Этот порт модуля не получил данных на выбранной ветке.' };
    return { status: latest.status, note: `Фактический ${output ? 'выход' : 'вход'} ${port.handleId} модуля.`, [output ? 'output' : 'input']: boundedPreview(value[port.handleId], limit), error: latest.error, durationMs: latest.durationMs };
  }
  return { status: latest.status, note: latest.status === 'skipped' ? 'Узел пропущен исполнителем; вход и выход не создавались.' : 'Фактические фрагменты трассы выбранного теста.',
    ...(latest.status !== 'skipped' ? { input: boundedPreview([...own].reverse().find(event => event.inputPreview !== undefined)?.inputPreview, limit), output: latest.status === 'completed' ? boundedPreview(latest.outputPreview, limit) : undefined } : {}),
    error: latest.error, durationMs: latest.durationMs, branch: latest.status === 'completed' ? readBranch(latest) : undefined };
}
export function edgeTracePreview(edge: FlowEdge, events: TraceEvent[], limit = 4000): TracePreview {
  const latest = events.filter(event => event.nodeId === edge.source).at(-1);
  if (!latest) return { status: 'not-run', note: 'В выбранном тесте нет событий источника этой связи. Значения до запуска не подставляются.' };
  if (latest.status !== 'completed') return { status: latest.status, note: 'Источник не завершился: передача по связи не подтверждена.', error: latest.error };
  if (latest.type !== 'module' && (edge.sourceHandle === 'true' || edge.sourceHandle === 'false')) {
    const branch = readBranch(latest);
    if (branch === undefined) return { status: 'unconfirmed', note: 'Фрагмент выхода не позволяет определить ветку. Передача данных не подтверждена.' };
    if (String(branch) !== edge.sourceHandle) return { status: 'skipped', note: `Исполнитель выбрал ветку «${branch ? 'да' : 'нет'}»; эта связь пропущена.`, branch };
  }
  if (latest.type === 'module') {
    let outputs: Record<string, unknown> | undefined;
    try { const data = typeof latest.outputPreview === 'string' ? JSON.parse(latest.outputPreview) : latest.outputPreview; if (data && typeof data === 'object' && 'outputs' in data) outputs = data.outputs as Record<string, unknown>; } catch { /* A truncated snapshot cannot confirm a port's contents. */ }
    if (!outputs || typeof outputs !== 'object') return { status: 'unconfirmed', note: 'Выходы модуля не поместились в фрагмент трассы. Передача этого порта не подтверждена.' };
    if (!Object.hasOwn(outputs, edge.sourceHandle ?? '')) return { status: 'skipped', note: 'Этот выход модуля пропущен выбранной веткой.' };
    return { status: 'completed', note: `Фактические данные выхода ${edge.sourceHandle} модуля. Остальные выходы сюда не подставляются.`, output: boundedPreview(outputs[edge.sourceHandle!], limit), durationMs: latest.durationMs };
  }
  return { status: 'completed', note: 'Фактический выход источника для этой связи. Обработка целевым узлом показана в его трассе.', output: boundedPreview(latest.outputPreview, limit), branch: readBranch(latest), durationMs: latest.durationMs };
}
export function clampPreview(anchor: { x: number; y: number }, size: { width: number; height: number }, viewport: { width: number; height: number }) {
  const margin = 12, width = Math.min(size.width, Math.max(0, viewport.width - 2 * margin)), height = Math.min(size.height, Math.max(0, viewport.height - 2 * margin));
  const left = anchor.x + 14 + width <= viewport.width - margin ? anchor.x + 14 : anchor.x - width - 14;
  const top = anchor.y + 14 + height <= viewport.height - margin ? anchor.y + 14 : anchor.y - height - 14;
  return { left: Math.max(margin, Math.min(left, viewport.width - width - margin)), top: Math.max(margin, Math.min(top, viewport.height - height - margin)), width, maxHeight: Math.max(0, viewport.height - 2 * margin) };
}
