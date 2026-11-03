import { FlowExecutionSession } from './execution-session.mjs';
import { upgradeVisualAssembly } from './assembly.mjs';
import { validateModuleDefinition } from './modules.mjs';
import { connectionError, connectionSignature } from './connections.mjs';
export { validateModuleDefinition, createModuleDefinition } from './modules.mjs';
export { defaultContextInputs, upgradeVisualAssembly } from './assembly.mjs';
export { FlowExecutionSession } from './execution-session.mjs';
export { orderContextBlocks } from './node-strategies.mjs';

// Shared, side-effect-free graph contract used by the editor and gateway.
export const nodeCatalog = {
  module: { label: 'Модуль', group: 'Логика', icon: 'pi-box', description: 'Встроенная неизменяемая версия схемы с именованными входами и выходами.' },
  module_input: { label: 'Вход модуля', group: 'Границы модуля', icon: 'pi-sign-in', description: 'Внутренняя граница именованного входа модуля.' },
  module_output: { label: 'Выход модуля', group: 'Границы модуля', icon: 'pi-sign-out', description: 'Внутренняя граница именованного выхода модуля.' },
  event: { label: 'Источник события', group: 'События', icon: 'pi-bolt', description: 'Сообщение, голос или результат команды запускают ветку. Контекст страницы сам не запускает платный запрос.' },
  source: { label: 'Данные контекста', group: 'Источники', icon: 'pi-database', description: 'Передаёт выбранную часть текущего контекста. Отключённые тарифом возможности не восстанавливает.' },
  prompt: { label: 'Инструкция', group: 'Инструкции', icon: 'pi-file-edit', description: 'Дополняет обязательные правила бота. Данные ученика не подставляются в системные инструкции.' },
  condition: { label: 'Условие', group: 'Логика', icon: 'pi-directions-alt', description: 'Проверяет входящий поток сообщений, текст или страницу и выбирает ветку «да» либо «нет».' },
  compact: { label: 'Сжать переписку', group: 'Память', icon: 'pi-compress', description: 'Сжимает старые реплики, переносит изменения в блок параметров и сохраняет последние пары дословно.' },
  context: { label: 'Собрать контекст', group: 'Логика', icon: 'pi-objects-column', description: 'Собирает только подключённые источники и инструкции в запрос модели.' },
  serialize: { label: 'Подготовить запрос', group: 'Контекст', icon: 'pi-code', description: 'В самом конце превращает объект контекста в сообщения, текст или JSON для робота.' },
  mcp: { label: 'MCP-инструмент', group: 'Инструменты', icon: 'pi-link', description: 'Поиск в интернете или чтение наших грамматических таблиц. Результат передаётся по линии как данные.' },
  model: { label: 'Робот', group: 'Исполнение', icon: 'pi-sparkles', description: 'Реальный запрос выбранной модели через существующий учёт кредитов.' },
  tools: { label: 'Команды бота', group: 'Исполнение', icon: 'pi-wrench', description: 'Разрешённые команды и предел шагов. В рабочем чате команды выполняются, в тесте показываются без изменения страницы.' },
  reply: { label: 'Ответ ученику', group: 'Результат', icon: 'pi-comments', description: 'Отправляет ответ в чат и сохраняет его существующим механизмом истории.' },
  speech: { label: 'Озвучка', group: 'Результат', icon: 'pi-volume-up', description: 'Разрешает или выключает существующую потоковую озвучку. Голос выбирается тарифом.' },
};
export const SOURCE_KEYS = ['recent_context', 'context_summary', 'important_notes', 'lesson_context', 'current_page', 'recent_tool_interactions', 'transcript_candidates', 'parameter_state', 'message_stream'];
export const EVENT_TYPES = ['user.message', 'user.audio', 'tool.result', 'page.context', 'lesson.context'];
const requiredTypes = ['model', 'tools', 'reply', 'speech'];
const settings = {
  event: ['event'], source: ['source', 'limitChars'], prompt: ['text'], condition: ['field', 'operator', 'value'],
  compact: ['keepPairs'],
  context: ['order', 'mode', 'inputs'], serialize: ['format'], mcp: ['service', 'query', 'tableKey', 'limit'], model: ['model', 'reasoning', 'maxOutputTokens'], tools: ['allCommands', 'allowedCommands', 'maxSteps', 'loop'], reply: [], speech: ['enabled'], module: ['definition'], module_input: ['port'], module_output: ['port'],
};
const identifier = /^[a-zA-Z0-9_-]{1,80}$/;
function fail(message) { throw new Error(message); }
function keysOnly(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(`${label}: неизвестные поля или неверный формат.`);
}
export function validateGraph(input, { models = null } = {}) {
  return validateStructure(input, { models });
}
// Shared ordinary-node validation for module fragments; lifecycle invariants stay top-level.
export function validateModuleGraph(definition, { models = null, depth = 1, budget = { count: 0 } } = {}) {
  return validateStructure({ version: 2, name: definition.name, nodes: definition.nodes, edges: definition.edges }, { models, fragment: definition, depth, budget });
}
function validateStructure(input, { models = null, fragment = null, depth = 0, budget = { count: 0 } } = {}) {
  keysOnly(input, ['version', 'name', 'nodes', 'edges', 'engine'], 'Схема');
  if (input.engine !== undefined && !['native', 'langgraph'].includes(input.engine)) fail('Неизвестный движок исполнения.');
  if (input.version !== 2 || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 120) fail('Нужны версия 2 и название до 120 символов.');
  if (new TextEncoder().encode(JSON.stringify(input)).length > 131072 || !Array.isArray(input.nodes) || input.nodes.length > 64 || !Array.isArray(input.edges) || input.edges.length > 128) fail('Схема превышает лимит: 64 узла, 128 связей, 128 КБ.');
  const graph = JSON.parse(JSON.stringify(input));
  budget.count += graph.nodes.length;
  if (budget.count > 256) fail('Схема превышает 256 развёрнутых узлов.');
  graph.name = graph.name.trim();
  const byId = new Map();
  const counts = {};
  for (const node of graph.nodes) {
    keysOnly(node, ['id', 'type', 'position', 'data'], 'Узел');
    const internal = fragment && ['module_input', 'module_output'].includes(node.type);
    if (!fragment && ['module_input', 'module_output'].includes(node.type)) fail('Граничные узлы разрешены только внутри модуля.');
    if (typeof node.id !== 'string' || !identifier.test(node.id) || byId.has(node.id) || !(Object.hasOwn(nodeCatalog, node.type) || internal)) fail(`Некорректный или повторяющийся узел: ${node.id}.`);
    if (fragment && (!['module_input', 'module_output', 'source', 'prompt', 'condition', 'context', 'serialize', 'mcp', 'model', 'module'].includes(node.type) || node.id.includes('__') || ['__proto__', 'constructor', 'prototype'].includes(node.id))) fail('Недопустимый внутренний узел модуля.');
    keysOnly(node.position, ['x', 'y'], node.id);
    if (![node.position.x, node.position.y].every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 100000)) fail(`${node.id}: неверная позиция.`);
    keysOnly(node.data, settings[node.type], node.id);
    const d = node.data;
    if (node.type === 'module') node.data.definition = validateModuleDefinition(d.definition, { models }, { depth: depth + 1, budget });
    if (internal && !(node.type === 'module_input' ? fragment.inputs : fragment.outputs).some(port => port.id === d.port)) fail(`${node.id}: неизвестный порт модуля.`);
    if (node.type === 'tools' && d.loop !== undefined) {
      keysOnly(d.loop, ['timeoutMs', 'maxRepeatedCommand', 'maxCostUsd'], 'Цикл команд');
      if (!Number.isInteger(d.loop.timeoutMs) || d.loop.timeoutMs < 1000 || d.loop.timeoutMs > 120000 || !Number.isInteger(d.loop.maxRepeatedCommand) || d.loop.maxRepeatedCommand < 2 || d.loop.maxRepeatedCommand > 3 || d.loop.maxCostUsd !== undefined && (typeof d.loop.maxCostUsd !== 'number' || !Number.isFinite(d.loop.maxCostUsd) || d.loop.maxCostUsd < 0.001 || d.loop.maxCostUsd > 10)) fail('Неверные ограничения цикла команд.');
    }
    if (node.type === 'event' && !EVENT_TYPES.includes(d.event)) fail(`${node.id}: неизвестное событие.`);
    if (node.type === 'source' && (!SOURCE_KEYS.includes(d.source) || !Number.isInteger(d.limitChars) || d.limitChars < 100 || d.limitChars > (d.source === 'message_stream' ? 120000 : 24000))) fail(`${node.id}: неверный источник или лимит.`);
    if (node.type === 'prompt' && (typeof d.text !== 'string' || d.text.length > 12000)) fail(`${node.id}: инструкция до 12000 символов.`);
    if (node.type === 'condition' && (!['transcript', 'current_page', 'user_message_count'].includes(d.field) || typeof d.value !== 'string' || !d.value.trim() || d.value.length > 300 || (d.field === 'user_message_count' ? d.operator !== 'gt' || !/^\d+$/.test(d.value) || Number(d.value) < 1 || Number(d.value) > 200 : !['contains', 'equals'].includes(d.operator)))) fail(`${node.id}: задайте условие.`);
    if (node.type === 'compact' && (!Number.isInteger(d.keepPairs) || d.keepPairs < 1 || d.keepPairs > 10)) fail(`${node.id}: сохраняйте от 1 до 10 завершённых пар.`);
    if (node.type === 'context' && d.order !== undefined && (!Array.isArray(d.order) || d.order.length > 65 || d.order.some(id => typeof id !== 'string') || new Set(d.order).size !== d.order.length || d.order.filter(id => id === '$request').length !== 1)) fail(`${node.id}: порядок должен содержать уникальные блоки и один текущий запрос.`);
    if (node.type === 'context') {
      if (d.mode !== undefined && !['object', 'text', 'json'].includes(d.mode)) fail(`${node.id}: неверный режим склейки.`);
      if (d.inputs !== undefined) {
        if (!Array.isArray(d.inputs) || d.inputs.length !== 8) fail(`${node.id}: нужны восемь входов.`);
        const ids = new Set(), names = new Set();
        for (const port of d.inputs) {
          keysOnly(port, ['id', 'label', 'key'], 'Вход');
          if (!/^in[1-8]$/.test(port.id) || ids.has(port.id) || typeof port.label !== 'string' || port.label.length > 80 || typeof port.key !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]{0,59}$/.test(port.key) || ['__proto__', 'constructor', 'prototype', 'current_request'].includes(port.key) || names.has(port.key)) fail(`${node.id}: входы и ключи должны быть уникальны.`);
          ids.add(port.id); names.add(port.key);
        }
        if (d.order?.some(id => id !== '$request' && !ids.has(id))) fail(`${node.id}: порядок склейки должен содержать ID входов.`);
      }
    }
    if (node.type === 'serialize' && !['messages', 'text', 'json'].includes(d.format)) fail(`${node.id}: неверный формат запроса.`);
    if (node.type === 'mcp' && (!['web_search', 'grammar_search', 'grammar_table'].includes(d.service) || typeof d.query !== 'string' || d.query.length > 1000 || typeof d.tableKey !== 'string' || !/^[a-zA-Z0-9_-]{0,100}$/.test(d.tableKey) || !Number.isInteger(d.limit) || d.limit < 1 || d.limit > 8)) fail(`${node.id}: неверные настройки MCP.`);
    if (node.type === 'model') {
      if (typeof d.model !== 'string' || (d.model !== 'preset' && (models ? !models.includes(d.model) : !/^(gpt-[a-zA-Z0-9.-]{1,60}|o[1-9][a-zA-Z0-9.-]{0,60})$/.test(d.model)))) fail(`${node.id}: неизвестная модель.`);
      if (!['preset', 'none', 'low', 'medium', 'high', 'xhigh', 'max'].includes(d.reasoning) || !Number.isInteger(d.maxOutputTokens) || d.maxOutputTokens < 700 || d.maxOutputTokens > 8192) fail(`${node.id}: неверные настройки модели.`);
    }
    if (node.type === 'tools' && (typeof d.allCommands !== 'boolean' || !Number.isInteger(d.maxSteps) || d.maxSteps < 1 || d.maxSteps > 6 || !Array.isArray(d.allowedCommands) || d.allowedCommands.length > 30 || d.allowedCommands.some(x => typeof x !== 'string' || !/^[a-z][a-z0-9_.]{0,99}$/.test(x)))) fail(`${node.id}: неверные разрешения команд.`);
    if (node.type === 'speech' && typeof d.enabled !== 'boolean') fail(`${node.id}: укажите состояние озвучки.`);
    counts[node.type] = (counts[node.type] || 0) + 1;
    byId.set(node.id, node);
  }
  if (!fragment) {
    for (const type of requiredTypes) if (counts[type] !== 1) fail(`Схема должна содержать ровно один узел «${nodeCatalog[type].label}».`);
    if (!counts.context) fail('Добавьте сборку контекста.');
    if (counts.serialize > 1) fail('Допустим один конечный сериализатор.');
    if (counts.compact > 1) fail('Допустим один блок сжатия в схеме.');
    for (const event of ['user.message', 'user.audio', 'tool.result']) if (graph.nodes.filter(n => n.type === 'event' && n.data.event === event).length !== 1) fail(`Нужен один источник ${event}.`);
  }
  for (const module of graph.nodes.filter(n => n.type === 'module')) if (graph.nodes.some(n => n.id.startsWith(`${module.id}__`))) fail('ID узла совпадает с пространством имён модуля.');
  const edgeIds = new Set(), signatures = new Set();
  for (const edge of graph.edges) {
    keysOnly(edge, ['id', 'source', 'target', 'sourceHandle', 'targetHandle'], 'Связь');
    const from = byId.get(edge.source), to = byId.get(edge.target);
    if (typeof edge.id !== 'string' || !identifier.test(edge.id) || edgeIds.has(edge.id) || !from || !to || from === to) fail(`Недопустимая связь ${edge.id}.`);
    const invalid = connectionError(from, to, edge, !!fragment);
    if (invalid) fail(`${edge.id}: ${invalid}.`);
    const signature = connectionSignature(edge);
    if (signatures.has(signature)) fail('Повторяющаяся связь.');
    signatures.add(signature); edgeIds.add(edge.id);
  }
  const order = topological(graph);
  const reach = (start, target) => { const seen = new Set([start]); for (const id of order) if (seen.has(id)) for (const e of graph.edges.filter(e => e.source === id)) seen.add(e.target); return seen.has(target); };
  if (fragment) {
    for (const [type, ports] of [['module_input', fragment.inputs], ['module_output', fragment.outputs]]) for (const port of ports) if (graph.nodes.filter(n => n.type === type && n.data.port === port.id).length !== 1) fail('Каждый порт должен иметь ровно один граничный узел.');
    for (const node of graph.nodes) {
      const incoming = graph.edges.filter(e => e.target === node.id), outgoing = graph.edges.filter(e => e.source === node.id);
      if (node.type === 'module_input' ? incoming.length !== 0 : incoming.length === 0) fail('Неверный вход внутреннего узла.');
      if (node.type === 'module_output' ? outgoing.length !== 0 : outgoing.length === 0) fail('Неверный выход внутреннего узла.');
      if (['model', 'serialize'].includes(node.type) && incoming.length !== 1) fail('Модель и сериализатор должны получать одну сборку.');
      if (!graph.nodes.some(n => n.type === 'module_input' && reach(n.id, node.id)) || !graph.nodes.some(n => n.type === 'module_output' && reach(node.id, n.id))) fail('Каждый внутренний узел должен лежать на пути от входа к выходу.');
    }
  }
  const model = graph.nodes.find(n => n.type === 'model');
  const reply = graph.nodes.find(n => n.type === 'reply');
  const speech = graph.nodes.find(n => n.type === 'speech');
  for (const node of graph.nodes) {
    if (node.type === 'context' && node.data.order && !node.data.inputs) for (const id of node.data.order) {
      if (id !== '$request' && (id === node.id || !['source', 'prompt', 'mcp', 'context', 'module', ...(fragment ? ['module_input'] : [])].includes(byId.get(id)?.type) || !reach(id, node.id))) fail(`${node.id}: блок ${id} не подключён к сборке контекста.`);
    }
    if (fragment) continue;
    if (node.type === 'speech') { if (!graph.edges.some(e => e.target === node.id)) fail('Подключите озвучку к ответу.'); }
    else if (!reach(node.id, speech.id)) fail(`${node.id}: узел не связан с результатом.`);
    if (node.type !== 'event' && !graph.edges.some(e => e.target === node.id)) fail(`${node.id}: отсутствует источник данных.`);
    if (node.type === 'model' && graph.edges.filter(e => e.target === node.id).length !== 1) fail('Робот должен получать одну сборку контекста.');
    if (node.type === 'serialize' && graph.edges.filter(e => e.target === node.id).length !== 1) fail('Сериализатор должен получать одну сборку.');
  }
  if (!fragment && !reach(model.id, reply.id)) fail('Робот не подключён к ответу.');
  return graph;
}
export function topological(graph) {
  const incoming = new Map(graph.nodes.map(n => [n.id, 0]));
  for (const edge of graph.edges) incoming.set(edge.target, incoming.get(edge.target) + 1);
  const queue = graph.nodes.filter(n => incoming.get(n.id) === 0).map(n => n.id), order = [];
  while (queue.length) { const id = queue.shift(); order.push(id); for (const e of graph.edges.filter(e => e.source === id)) { incoming.set(e.target, incoming.get(e.target) - 1); if (incoming.get(e.target) === 0) queue.push(e.target); } }
  if (order.length !== graph.nodes.length) fail('В схеме есть цикл. Повторные команды выполняет ограниченный узел команд, а не циклические связи.');
  return order;
}
export function defaultFlow() {
  const nodes = [
    ...['user.message', 'user.audio', 'tool.result'].map((event, i) => ({ id: `event_${i}`, type: 'event', position: { x: 0, y: i * 140 }, data: { event } })),
    ...['context_summary', 'parameter_state'].map((source, i) => ({ id: `source_${i}`, type: 'source', position: { x: 1230, y: i * 160 }, data: { source, limitChars: 24000 } })),
    { id: 'source_2', type: 'source', position: { x: 310, y: 160 }, data: { source: 'message_stream', limitChars: 120000 } },
    { id: 'count_gate', type: 'condition', position: { x: 620, y: 160 }, data: { field: 'user_message_count', operator: 'gt', value: '20' } },
    { id: 'compact', type: 'compact', position: { x: 930, y: 10 }, data: { keepPairs: 5 } },
    { id: 'prompt', type: 'prompt', position: { x: 1230, y: 320 }, data: { text: 'Отвечай понятно, учитывая уровень ученика. Не выдумывай факты.' } },
    { id: 'context', type: 'context', position: { x: 1540, y: 200 }, data: { order: ['prompt', 'source_0', 'source_1', 'source_2', '$request'] } },
    { id: 'model', type: 'model', position: { x: 1850, y: 200 }, data: { model: 'preset', reasoning: 'preset', maxOutputTokens: 8192 } },
    { id: 'tools', type: 'tools', position: { x: 2160, y: 200 }, data: { allCommands: true, allowedCommands: [], maxSteps: 6 } },
    { id: 'reply', type: 'reply', position: { x: 2470, y: 200 }, data: {} },
    { id: 'speech', type: 'speech', position: { x: 2780, y: 200 }, data: { enabled: true } },
  ];
  const pairs = [];
  for (let i = 0; i < 3; i++) pairs.push([`event_${i}`, 'source_2']);
  pairs.push(['source_2', 'count_gate']);
  pairs.push(['count_gate', 'compact', 'true'], ['count_gate', 'context', 'false'], ['compact', 'context']);
  for (const n of nodes.filter(n => ['source', 'prompt'].includes(n.type) && n.id !== 'source_2')) pairs.push(['count_gate', n.id, 'false'], ['compact', n.id]);
  for (const n of nodes.filter(n => ['source', 'prompt'].includes(n.type) && n.id !== 'source_2')) pairs.push([n.id, 'context']);
  pairs.push(['context', 'model'], ['model', 'tools'], ['tools', 'reply'], ['reply', 'speech']);
  const graph = upgradeVisualAssembly({ version: 2, engine: 'langgraph', name: 'Основной репетитор · зебра', nodes, edges: pairs.map(([source, target, handle], i) => ({ id: `edge_${i}`, source, target, sourceHandle: handle || 'out', targetHandle: 'in' })) });
  // Preserve the pre-studio tutor evidence alongside the journal. Keep the web/table
  // ports available for optional MCP nodes; both branches must carry these sources.
  for (const [id, source, port, label, y] of [
    ['source_tools', 'recent_tool_interactions', 'in7', 'История команд', 520],
    ['source_transcripts', 'transcript_candidates', 'in8', 'Варианты распознавания', 700],
  ]) {
    graph.nodes.push({ id, type: 'source', position: { x: 1230, y }, data: { source, limitChars: 24000 } });
    const input = graph.nodes.find(node => node.id === 'context').data.inputs.find(input => input.id === port);
    Object.assign(input, { label, key: source });
    graph.edges.push(
      { id: `gate_${id}`, source: 'count_gate', target: id, sourceHandle: 'false', targetHandle: 'in' },
      { id: `compact_${id}`, source: 'compact', target: id, sourceHandle: 'out', targetHandle: 'in' },
      { id: `${id}_context`, source: id, target: 'context', sourceHandle: 'out', targetHandle: port },
    );
  }
  return graph;
}
export function flowSettings(input, config = {}) {
  const graph = validateGraph(input);
  const model = graph.nodes.find(n => n.type === 'model').data;
  const policy = graph.nodes.find(n => n.type === 'tools').data;
  const speech = graph.nodes.find(n => n.type === 'speech').data.enabled;
  const result = { ...config };
  if (model.model !== 'preset') result.tutorModel = model.model;
  // The user's explicit complex-question action wins for this turn.
  if (model.reasoning !== 'preset' && !config.complexQuestion) { result.reasoningEnabled = model.reasoning !== 'none'; result.reasoningEffort = model.reasoning; }
  return { graph, config: result, policy, speech, maxOutputTokens: model.maxOutputTokens };
}
export function flowCommandAllowed(policy, command) { return policy.allCommands || policy.allowedCommands.includes(command); }
// Compatibility facade; browser previews and old callers keep the same contract.
export async function executeFlow(input, options = {}) { return new FlowExecutionSession(input, options).runAll(); }
export async function previewFlow(graph, event, sources = {}) { return executeFlow(graph, { event, sources }); }
