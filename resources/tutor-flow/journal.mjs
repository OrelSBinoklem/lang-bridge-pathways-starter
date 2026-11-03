// Declarative conversation data. State events are observations, never executable instructions
// and never writes to the application's canonical training/progress tables.
const ROOTS = ['page', 'task', 'notes', 'progress', 'voice'];
const TASK_FIELDS = ['topic', 'text', 'instructions', 'lessonBlockId', 'format', 'completed'];
const validPath = path => ROOTS.includes(path) || typeof path === 'string' && path.startsWith('task.') && TASK_FIELDS.includes(path.slice(5));
const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
export function canonical(value) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === 'object') return Object.fromEntries(Object.keys(value).filter(key => !unsafe.has(key) && value[key] !== undefined).sort().map(key => [key, canonical(value[key])]));
  throw new Error('Недопустимое значение в состоянии беседы.');
}
export const canonicalJson = value => JSON.stringify(canonical(value));
export function normalizedParameters(value = {}) {
  const result = {};
  for (const key of ROOTS) if (Object.hasOwn(value, key)) result[key] = canonical(value[key]);
  if (Array.isArray(result.notes)) result.notes = result.notes.map(note => {
    if (!note || typeof note !== 'object' || Array.isArray(note)) return note;
    const { last_seen_at: _seen, ...data } = note;
    return data;
  });
  return canonical(result);
}
export function parameterChanges(before, after) {
  const previous = normalizedParameters(before), next = normalizedParameters(after);
  return ROOTS.flatMap(path => {
    if (!Object.hasOwn(next, path) || canonicalJson(previous[path]) === canonicalJson(next[path])) return [];
    if (path === 'task' && previous.task && next.task && previous.task.lessonBlockId === next.task.lessonBlockId) {
      return TASK_FIELDS.filter(key => Object.hasOwn(next.task, key) && canonicalJson(previous.task[key]) !== canonicalJson(next.task[key])).map(key => ({ path: `task.${key}`, value: next.task[key] }));
    }
    return [{ path, value: next[path] }];
  });
}
export function isStateEvent(message) {
  return message?.role === 'system' && message.metadata?.kind === 'state_delta' && message.metadata.event_version === 1 && Array.isArray(message.metadata.changes)
    && message.metadata.changes.length > 0 && message.metadata.changes.length <= 16
    && message.metadata.changes.every(change => change && validPath(change.path) && Object.hasOwn(change, 'value'));
}
export function foldParameters(snapshot, messages = []) {
  const result = normalizedParameters(snapshot);
  for (const message of messages) if (isStateEvent(message)) for (const change of message.metadata.changes) {
    if (change.path.startsWith('task.')) result.task = { ...(result.task || {}), [change.path.slice(5)]: canonical(change.value) };
    else result[change.path] = canonical(change.value);
  }
  return normalizedParameters(result);
}
export function stateEvent(changes) {
  const metadata = { kind: 'state_delta', event_version: 1, changes: canonical(changes) };
  const event = { role: 'system', text: canonicalJson({ kind: 'state_delta', changes: metadata.changes }), metadata };
  if (!isStateEvent(event)) throw new Error('Некорректное изменение параметров беседы.');
  return event;
}
export function userMessageCount(messages = []) { return messages.filter(message => message.role === 'user').length; }

/** Keep the last N completed user/assistant turns, plus any current incomplete turn.
 * A cutoff is a contiguous persisted prefix, never a selection of individual rows. */
export function compactionPrefix(messages, { threshold = 20, keepPairs = 5, force = false, maxRecords = 60, maxBytes = 48000 } = {}) {
  if (!force && userMessageCount(messages) <= threshold) return [];
  const users = messages.flatMap((message, index) => message.role === 'user' ? [index] : []);
  const completed = users.filter((index, i) => messages.slice(index + 1, users[i + 1] ?? messages.length).some(message => message.role === 'assistant'));
  if (completed.length <= keepPairs) return [];
  const retainFrom = completed.at(-keepPairs);
  const boundaries = users.filter(index => index > 0 && index <= retainFrom);
  let end = 0;
  for (const boundary of boundaries) {
    const bytes = new TextEncoder().encode(canonicalJson(messages.slice(0, boundary))).length;
    if (boundary > maxRecords || bytes > maxBytes) break;
    end = boundary;
  }
  // One very long complete turn must be processed explicitly or fail, never disappear.
  if (!end) end = boundaries[0] || 0;
  return messages.slice(0, end);
}

/** Preserve stable message boundaries across calls. "System" observations use a user
 * data envelope: learner-controlled strings cannot become privileged API instructions. */
export function journalInputMessages(messages = []) {
  return messages.map(message => {
    if (isStateEvent(message)) return { role: 'user', content: canonicalJson({ context_event: { kind: 'state_delta', changes: message.metadata.changes } }) };
    if (message.role === 'assistant') return { role: 'assistant', content: String(message.text || '') };
    if (message.role === 'user') return { role: 'user', content: String(message.text || '') };
    return { role: 'user', content: canonicalJson({ context_event: { kind: message.role === 'tool' ? 'tool_result' : 'observation', text: String(message.text || '') } }) };
  });
}
