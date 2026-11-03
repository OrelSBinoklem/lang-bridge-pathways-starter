import type { TraceEvent } from './flowEditor';

export type MessageRecord = { id?: string | number; role: 'user' | 'assistant' | 'tool' | 'system'; text: string; metadata?: Record<string, unknown>; createdAt?: string };
export type TestSources = Record<string, unknown>;
export function parseSources(text: string): { sources: TestSources; error?: string } {
  if (text.length > 150000) return { sources: {}, error: 'Тестовые источники превышают 150 000 символов. Содержимое не обрезано; уменьшите размер перед запуском.' };
  try {
    const sources: unknown = JSON.parse(text);
    if (!sources || typeof sources !== 'object' || Array.isArray(sources)) throw Error('Источники должны быть JSON-объектом.');
    return { sources: sources as TestSources };
  } catch (cause) { return { sources: {}, error: cause instanceof Error ? cause.message : 'Некорректный JSON' }; }
}
export function readMessageStream(value: unknown): { records: MessageRecord[]; errors: string[] } {
  if (value == null) return { records: [], errors: [] };
  if (!Array.isArray(value)) return { records: [], errors: ['message_stream должен быть массивом записей.'] };
  const records: MessageRecord[] = [], errors: string[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object' || !['user', 'assistant', 'tool', 'system'].includes(item.role) || typeof item.text !== 'string') errors.push(`Запись ${index + 1}: нужны role и текст text.`);
    else records.push(item as MessageRecord);
  });
  return { records, errors };
}
export function stateChanges(record: MessageRecord): { path: string; value: unknown }[] {
  if (record.role !== 'system' || record.metadata?.kind !== 'state_delta' || !Array.isArray(record.metadata.changes)) return [];
  return record.metadata.changes.filter((change): change is { path: string; value: unknown } => Boolean(change) && typeof change === 'object' && typeof change.path === 'string' && Object.hasOwn(change, 'value'));
}
export function previewObject(value: unknown): Record<string, unknown> | null {
  try { const item = typeof value === 'string' ? JSON.parse(value) : value; return item && typeof item === 'object' && !Array.isArray(item) ? item : null; } catch { return null; }
}
/** Read a reported count only; never substitute a count computed from edited test inputs. */
export function observedMessageCount(events: TraceEvent[]): number | null {
  for (const event of [...events].reverse()) if (event.status === 'completed') {
    if (typeof event.observed === 'number' && Number.isFinite(event.observed)) return event.observed;
    if (typeof event.observed === 'string' && /^\d+$/.test(event.observed)) return Number(event.observed);
    const value = previewObject(event.outputPreview);
    for (const key of ['observed', 'userMessageCount', 'user_message_count', 'count']) if (typeof value?.[key] === 'number') return value[key] as number;
  }
  return null;
}
export function createTimelineExample(userCount = 3): TestSources {
  const message_stream: MessageRecord[] = [];
  for (let i = 1; i <= userCount; i++) {
    message_stream.push({ id: `example-user-${i}`, role: 'user', text: i === userCount ? 'Я закончил задание. Что дальше?' : `Учебная реплика ${i}: тренирую знакомство по-латышски.` });
    if (i < userCount) {
      message_stream.push({ id: `example-assistant-${i}`, role: 'assistant', text: `Ответ ${i}: продолжим упражнение, назови себя по-латышски.` });
      if (i === 2) message_stream.push({ id: 'example-state-task', role: 'system', text: 'Ученик завершил учебное задание.', metadata: { kind: 'state_delta', event_version: 1, changes: [{ path: 'task.completed', value: true }] } });
    }
  }
  return { parameter_state: { page: '/course', task: { topic: 'Знакомство', text: 'Labdien! Mani sauc Anna. Kā tevi sauc?', instructions: 'Поздоровайся и представься по-латышски.', lessonBlockId: 'example-introduction', format: 'speaking', completed: false }, notes: [{ text: 'Учебный пример, уровень A1' }], progress: { completed: 0 }, voice: { enabled: true } }, message_stream };
}
