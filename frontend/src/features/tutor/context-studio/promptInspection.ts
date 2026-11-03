import type { Config, TraceEvent } from './flowEditor';

export type PromptSection = { id: string; title: string; source: string; role: string; text: string; characters: number };
export type PromptManifest = { sections: PromptSection[]; responseFormat: unknown; note: string; preset: string; model: string; contextMode: string; capturedAt: string };
export const PROMPT_SECTIONS = [
  { id: 'base', title: 'Основные правила репетитора', source: 'tools/tutor-gateway/src/agent/TutorRulesBuilder.mjs' },
  { id: 'routes', title: 'Каталог страниц', source: 'tools/tutor-gateway/src/commands/routes.mjs' },
  { id: 'policy', title: 'Команды и лимит шагов', source: 'tools/tutor-gateway/src/agent/TutorPromptEnvelope.mjs' },
  { id: 'journal', title: 'Журнал и формат ответа', source: 'tools/tutor-gateway/src/context/orderedPrompt.mjs' },
] as const;

const object = (value: unknown): Config | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Config : undefined;
export function modelRequestAtCursor(events: TraceEvent[], modelNodeId: string) {
  for (const event of [...events].reverse()) {
    if (event.nodeId !== modelNodeId || !['model_request', 'model_request_preview', 'model'].includes(event.type) || event.inputPreview === undefined) continue;
    try {
      const request = object(typeof event.inputPreview === 'string' ? JSON.parse(event.inputPreview) : event.inputPreview);
      if (typeof request?.model === 'string' && Array.isArray(request.input)) return { request, event };
    } catch { /* A truncated historical fragment is never a complete request. */ }
    // A newer incomplete request must not be replaced with an older iteration.
    if (event.type === 'model_request' || event.type === 'model_request_preview') return { event };
  }
  return undefined;
}
export function messageText(message: unknown): string {
  const content = object(message)?.content;
  return typeof content === 'string' ? content : Array.isArray(content)
    ? content.map(part => typeof object(part)?.text === 'string' ? object(part)!.text : '').join('\n') : '';
}
export function capturedPromptSections(request: Config): PromptSection[] {
  const input = request.input as Config[];
  // These four messages precede the graph's own blocks in the current builder.
  // Old/incomplete layouts are shown only in the raw request, never relabelled by guesswork.
  if (input.length < 4 || input.slice(0, 4).some(message => message.role !== 'developer') ||
      !messageText(input[1]).startsWith('Available routes, stable route guide:') ||
      !messageText(input[2]).includes('Лимит итераций') || !messageText(input[3]).startsWith('Conversation is an append-only journal.')) return [];
  return PROMPT_SECTIONS.map((section, index) => ({ ...section, role: 'developer', text: messageText(input[index]), characters: messageText(input[index]).length }));
}
