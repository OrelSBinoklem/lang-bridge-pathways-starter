export const KINDS = ['event', 'source', 'prompt', 'condition', 'compact', 'mcp', 'context', 'serialize', 'model', 'tools', 'reply', 'speech', 'module', 'module_input', 'module_output'] as const;
export type Kind = typeof KINDS[number];
export type Config = Record<string, unknown>;
export type TariffPreview = { id: string; name: string; config: Config };
export type FlowNode = { id: string; type: Kind; position: { x: number; y: number }; data: Config };
export type FlowEdge = { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null };
export type FlowGraph = { version: 2; name: string; engine?: 'native' | 'langgraph'; nodes: FlowNode[]; edges: FlowEdge[] };
export type ModulePort = { id: string; label: string };
export type ModuleDefinition = { id: string; name: string; version: number; inputs: ModulePort[]; outputs: ModulePort[]; nodes: FlowNode[]; edges: FlowEdge[] };
export type FlowVersion = { id: number; name: string; created_at: string; created_by?: unknown };
export type FlowServerState = { versions: FlowVersion[]; head_version_id: number | null; active_version_id: number | null; default_graph: FlowGraph };
export type FlowMutationState = { head_version_id: number | null; active_version_id: number | null; version?: FlowVersion };
/** POST pointers are authoritative even if the following list request fails. */
export function applyMutationState(state: FlowServerState, result: FlowMutationState): FlowServerState {
  let versions = state.versions;
  if (result.version) {
    const { id, name, created_at, created_by } = result.version;
    versions = [{ id, name, created_at, created_by }, ...versions.filter(version => version.id !== id)].sort((a, b) => b.id - a.id);
  }
  return { ...state, versions, head_version_id: result.head_version_id, active_version_id: result.active_version_id };
}
export type TraceEvent = { nodeId: string; type: string; status: 'running' | 'completed' | 'skipped' | 'failed'; at: string | number; durationMs?: number; inputPreview?: unknown; outputPreview?: unknown; observed?: number | string; branch?: boolean; usage?: unknown; error?: string; iteration?: number; phase?: string; reason?: string; modulePath?: string[]; localNodeId?: string; restored?: boolean };
export type ExecutionCheckpoint = { id: string; status: string; completed: number; uncertain: string[]; bytes: number; limitBytes: number; next?: string[] };
export type Run = { id: string; serverId?: string; versionId?: number | null; preset?: string; name: string; live: boolean; started: string; events: TraceEvent[]; done: boolean; reply?: string; command?: unknown; usage?: unknown; error?: string;
  paused?: boolean; checkpoint?: ExecutionCheckpoint; fixture?: { graph: FlowGraph; event: Record<string, unknown>; sources: Record<string, unknown> } };
export const EVENTS = ['user.message', 'user.audio', 'tool.result', 'page.context', 'lesson.context'];
export const SOURCES = ['recent_context', 'context_summary', 'important_notes', 'lesson_context', 'current_page', 'recent_tool_interactions', 'transcript_candidates', 'parameter_state', 'message_stream'];
export const EVENT_LABELS: Record<string, string> = {
  'user.message': 'Сообщение ученика', 'user.audio': 'Речь ученика', 'tool.result': 'Результат команды',
  'page.context': 'Изменение страницы', 'lesson.context': 'Контекст задания',
};
export const SOURCE_LABELS: Record<string, string> = {
  recent_context: 'Недавние сообщения', context_summary: 'Резюме беседы', important_notes: 'Важные заметки',
  lesson_context: 'Текущее задание', current_page: 'Текущая страница', recent_tool_interactions: 'Последние команды', transcript_candidates: 'Варианты распознавания',
  parameter_state: 'Блок параметров', message_stream: 'Поток сообщений · зебра',
};
export const CONDITION_FIELDS: Record<string, string> = { transcript: 'Текст ученика', current_page: 'Текущая страница', user_message_count: 'Реплик ученика в текущем контексте' };
export const CONDITION_OPERATORS: Record<string, string> = { contains: 'Содержит', equals: 'Совпадает', gt: 'Больше' };
export const CONTEXT_PORTS = Array.from({ length: 8 }, (_, index) => `in${index + 1}`);
export type ContextInput = { id: string; label: string; key: string };
export const CONTEXT_MODES: Record<string, string> = { object: 'Объект', text: 'Текст', json: 'JSON' };
export const SERIALIZE_FORMATS: Record<string, string> = { messages: 'Сообщения модели', text: 'Текст', json: 'JSON' };
export const MCP_SERVICES: Record<string, string> = { web_search: 'Поиск в интернете', grammar_search: 'Поиск по грамматике', grammar_table: 'Грамматическая таблица' };
export function contextInputs(data: Config): ContextInput[] {
  const configured = Array.isArray(data.inputs) ? data.inputs : [];
  return CONTEXT_PORTS.map((id, index) => {
    const input = configured.find(item => item && typeof item === 'object' && item.id === id);
    return { id, label: typeof input?.label === 'string' ? input.label : `Вход ${index + 1}`, key: typeof input?.key === 'string' ? input.key : id };
  });
}
export function conditionFieldPatch(field: string): Config { return field === 'user_message_count' ? { field, operator: 'gt', value: '20' } : { field, operator: 'contains', value: '' }; }
export const META: Record<Kind, { label: string; description: string; icon: string; color: string }> = {
  event: { label: 'Событие', description: 'Точка входа: сообщение, аудио или результат инструмента', icon: 'pi-bolt', color: '#d69a32' },
  source: { label: 'Источник', description: 'Данные беседы, урока, памяти или страницы. Поток сообщений можно передать в условие по числу реплик и в сжатие.', icon: 'pi-database', color: '#35a7a0' },
  prompt: { label: 'Инструкция', description: 'Текст инструкции для репетитора', icon: 'pi-align-left', color: '#8b76df' },
  condition: { label: 'Условие', description: 'Две ветки по тексту, странице или числу реплик. Условие передаёт подключённые данные дальше по выбранной ветке.', icon: 'pi-directions-alt', color: '#d2974b' },
  compact: { label: 'Сжать переписку', description: 'Сводит старые сообщения в резюме, переносит изменения состояния в снимок параметров и сохраняет последние пары реплик.', icon: 'pi-compress', color: '#bd8b56' },
  mcp: { label: 'MCP · данные', description: 'Поиск в интернете, грамматике или получение таблицы через разрешённый серверный сервис. Результат — данные контекста, а не инструкция.', icon: 'pi-search', color: '#5aa78a' },
  context: { label: 'Сборка контекста', description: 'Порядок подключённых инструкций, данных и текущего запроса. Обязательные правила закреплены в начале.', icon: 'pi-objects-column', color: '#4b9fc8' },
  serialize: { label: 'Сериализация', description: 'Преобразует собранный контекст в сообщения, текст или JSON перед передачей модели.', icon: 'pi-code', color: '#8694cf' },
  model: { label: 'Модель', description: 'Модель, глубина рассуждения и размер ответа', icon: 'pi-sparkles', color: '#ab79d6' },
  tools: { label: 'Инструменты', description: 'Разрешённые команды и шаги существующего цикла', icon: 'pi-wrench', color: '#5da78a' },
  reply: { label: 'Ответ', description: 'Текст ответа репетитора', icon: 'pi-comment', color: '#6c91d8' },
  speech: { label: 'Озвучка', description: 'Включает или выключает речь', icon: 'pi-volume-up', color: '#cb84a1' },
  module: { label: 'Модуль', description: 'Сохранённая внутренняя схема с собственными входами и выходами. Версия закреплена в карточке.', icon: 'pi-box', color: '#6376cc' },
  module_input: { label: 'Вход модуля', description: 'Получает данные с одноимённого внешнего входа.', icon: 'pi-sign-in', color: '#168e87' },
  module_output: { label: 'Выход модуля', description: 'Передаёт данные на одноимённый внешний выход.', icon: 'pi-sign-out', color: '#6376cc' },
};
export function initialData(kind: Kind): Config {
  switch (kind) {
    case 'event': return { event: 'page.context' };
    case 'source': return { source: 'recent_context', limitChars: 6000 };
    case 'prompt': return { text: 'Помогай изучать латышский язык. Объясняй понятно и по существу.' };
    case 'condition': return { field: 'transcript', operator: 'contains', value: 'грамматик' };
    case 'compact': return { keepPairs: 5 };
    case 'context': return { mode: 'object', inputs: contextInputs({}), order: [...CONTEXT_PORTS, '$request'] };
    case 'serialize': return { format: 'messages' };
    case 'mcp': return { service: 'grammar_search', query: '', tableKey: '', limit: 3 };
    case 'model': return { model: 'preset', reasoning: 'preset', maxOutputTokens: 2048 };
    case 'tools': return { allCommands: true, allowedCommands: [], maxSteps: 3 };
    case 'speech': return { enabled: true };
    case 'module_input': return { port: 'in1' };
    case 'module_output': return { port: 'out1' };
    default: return {};
  }
}
/** Persist only schema fields; React Flow selection and measurements never become configuration. */
export function cleanGraph(graph: FlowGraph): FlowGraph {
  return { version: 2, name: graph.name, ...(graph.engine !== undefined ? { engine: graph.engine } : {}), nodes: graph.nodes.map(n => ({ id: n.id, type: n.type, position: { x: n.position.x, y: n.position.y }, data: n.data })),
    edges: graph.edges.map(e => ({ id: e.id, source: e.source, target: e.target, ...(e.sourceHandle != null ? { sourceHandle: e.sourceHandle } : {}), ...(e.targetHandle != null ? { targetHandle: e.targetHandle } : {}) })) };
}
export const fingerprint = (graph: FlowGraph) => JSON.stringify(cleanGraph(graph));
export function nodeIssues(graph: FlowGraph, modelIds: string[]): Record<string, string[]> {
  const issues: Record<string, string[]> = {};
  for (const n of graph.nodes) {
    const list: string[] = [], d = n.data;
    const range = (key: string, min: number, max: number) => { if (!Number.isInteger(d[key]) || Number(d[key]) < min || Number(d[key]) > max) list.push(`${key}: целое число от ${min} до ${max}`); };
    switch (n.type) {
      case 'event': if (!EVENTS.includes(String(d.event))) list.push('Выберите разрешённое событие'); break;
      case 'source': if (!SOURCES.includes(String(d.source))) list.push('Выберите разрешённый источник'); range('limitChars', 100, d.source === 'message_stream' ? 120000 : 24000); break;
      case 'prompt': if (typeof d.text !== 'string' || d.text.length > 12000) list.push('Инструкция: не более 12 000 символов'); break;
      case 'condition':
        if (!Object.hasOwn(CONDITION_FIELDS, String(d.field))) list.push('Неизвестное поле условия');
        if (d.field === 'user_message_count') {
          if (d.operator !== 'gt') list.push('Для числа реплик выберите «Больше»');
          if (typeof d.value !== 'string' || !/^\d+$/.test(d.value) || Number(d.value) < 1 || Number(d.value) > 200) list.push('Порог: целое число от 1 до 200');
        } else if (!['contains', 'equals'].includes(String(d.operator))) list.push('Неизвестный оператор');
        if (typeof d.value !== 'string' || !d.value.trim() || d.value.length > 300) list.push('Значение: от 1 до 300 символов'); break;
      case 'compact':
        range('keepPairs', 1, 10);
        if (graph.nodes.filter(item => item.type === 'compact').length > 1) list.push('Допускается не больше одного узла сжатия');
        break;
      case 'context': {
        if (d.mode !== undefined && !Object.hasOwn(CONTEXT_MODES, String(d.mode))) list.push('Выберите режим объекта, текста или JSON');
        if (d.inputs !== undefined) {
          if (!Array.isArray(d.inputs) || d.inputs.length !== 8) list.push('Нужно восемь входов');
          else {
            const ids = new Set(), keys = new Set();
            for (const input of d.inputs) {
              if (!input || typeof input !== 'object' || !CONTEXT_PORTS.includes(input.id) || ids.has(input.id)) { list.push('Входы: уникальные in1–in8'); continue; }
              ids.add(input.id);
              if (typeof input.label !== 'string' || input.label.length > 80) list.push('Подпись входа: до 80 символов');
              if (typeof input.key !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]{0,59}$/.test(input.key) || ['__proto__', 'prototype', 'constructor', 'current_request'].includes(input.key) || keys.has(input.key)) list.push('Ключи входов: уникальные латинские имена, до 60 символов; current_request и служебные имена зарезервированы');
              keys.add(input.key);
            }
          }
        }
        if (d.order !== undefined && (!Array.isArray(d.order) || d.order.some(id => typeof id !== 'string') || new Set(d.order).size !== d.order.length || !d.order.includes('$request'))) list.push('Порядок: уникальные входы и текущий запрос');
        if (Array.isArray(d.inputs) && Array.isArray(d.order) && d.order.some(id => id !== '$request' && !CONTEXT_PORTS.includes(String(id)))) list.push('В новой сборке порядок задаётся ID входов in1–in8');
        break;
      }
      case 'serialize':
        if (!Object.hasOwn(SERIALIZE_FORMATS, String(d.format))) list.push('Выберите формат сериализации');
        if (graph.nodes.filter(item => item.type === 'serialize').length > 1) list.push('Допускается один конечный сериализатор');
        break;
      case 'mcp':
        if (!Object.hasOwn(MCP_SERVICES, String(d.service))) list.push('Выберите разрешённый сервис MCP');
        if (typeof d.query !== 'string' || d.query.length > 1000) list.push('Поисковый запрос: до 1000 символов');
        if (typeof d.tableKey !== 'string' || !/^[a-zA-Z0-9_-]{0,100}$/.test(d.tableKey)) list.push('Ключ таблицы: до 100 латинских букв, цифр, дефисов и подчёркиваний');
        range('limit', 1, 8);
        if (Object.keys(d).some(key => !['service', 'query', 'tableKey', 'limit'].includes(key))) list.push('MCP принимает только сервис, запрос, ключ таблицы и лимит; URL и секреты запрещены');
        break;
      case 'model':
        if (!['preset', ...modelIds].includes(String(d.model))) list.push('Выберите разрешённую модель');
        if (!['preset', 'none', 'low', 'medium', 'high', 'xhigh', 'max'].includes(String(d.reasoning))) list.push('Неизвестная глубина рассуждения');
        range('maxOutputTokens', 700, 8192); break;
      case 'tools':
        if (typeof d.allCommands !== 'boolean') list.push('Укажите режим доступа к командам');
        if (!Array.isArray(d.allowedCommands) || d.allowedCommands.length > 30 || d.allowedCommands.some(c => typeof c !== 'string' || !/^[a-z][a-z0-9_.]{0,99}$/.test(c))) list.push('До 30 имён команд: латинские буквы, цифры, точка и подчёркивание');
        range('maxSteps', 1, 6); break;
      case 'speech': if (typeof d.enabled !== 'boolean') list.push('Укажите, включена ли озвучка'); break;
    }
    if (n.type !== 'speech' && !graph.edges.some(e => e.source === n.id)) list.push('Нет исходящего соединения');
    if (n.type !== 'event' && !graph.edges.some(e => e.target === n.id)) list.push('Нет входящего соединения');
    if (n.type === 'event' && graph.nodes.filter(item => item.type === 'event' && item.data.event === d.event).length > 1) list.push('Такое событие уже добавлено');
    if (['model', 'tools', 'reply', 'speech'].includes(n.type) && graph.nodes.filter(item => item.type === n.type).length !== 1) list.push('В потоке должен быть ровно один такой узел');
    if (list.length) issues[n.id] = list;
  }
  return issues;
}
export function mergeTrace(previous: TraceEvent[], incoming: TraceEvent[]): TraceEvent[] {
  // Gateway may send a complete snapshot or an incremental batch. Same event is never duplicated.
  const result = [...previous];
  for (const event of incoming) {
    const index = result.findIndex(old => old.nodeId === event.nodeId && old.type === event.type && old.status === event.status && old.at === event.at);
    if (index < 0) result.push(event); else result[index] = event;
  }
  return result.slice(-2000);
}
export function errorText(cause: unknown): string { return cause instanceof Error ? cause.message : 'Не удалось выполнить действие'; }
export function pretty(value: unknown): string { return typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? ''; }
