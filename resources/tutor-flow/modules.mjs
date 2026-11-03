import { validateModuleGraph } from './graph.mjs';

const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value) && !['__proto__', 'constructor', 'prototype', 'current_request'].includes(value) && !value.includes('__');
function fail(message) { throw new Error(message); }
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail('Неверные поля определения модуля.');
}
function json(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return;
  if (!value || typeof value !== 'object' || seen.has(value) || !Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('Модуль должен содержать только JSON-данные.');
  seen.add(value); for (const item of Object.values(value)) json(item, seen); seen.delete(value);
}

/** Browser-pure validation. Snapshots never resolve IDs through a mutable catalogue. */
export function validateModuleDefinition(value, { models = null } = {}, { depth = 1, budget = { count: 0 } } = {}) {
  if (depth > 3) fail('Вложенность модулей не должна превышать 3.');
  object(value, ['id', 'name', 'version', 'inputs', 'outputs', 'nodes', 'edges']);
  json(value);
  if (new TextEncoder().encode(JSON.stringify(value)).length > 131072) fail('Модуль превышает 128 КиБ.');
  if (!safeId(value.id) || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 120 || !Number.isSafeInteger(value.version) || value.version < 1) fail('Неверный ID, название или версия модуля.');
  for (const key of ['inputs', 'outputs']) {
    const ports = value[key];
    if (!Array.isArray(ports) || ports.length < 1 || ports.length > 16) fail('Нужно от 1 до 16 портов каждого направления.');
    const ids = new Set();
    for (const port of ports) {
      object(port, ['id', 'label']);
      if (!safeId(port.id) || ids.has(port.id) || typeof port.label !== 'string' || !port.label.trim() || port.label.length > 80) fail('Порты должны иметь уникальные безопасные ID и названия.');
      ids.add(port.id);
    }
  }
  const result = structuredClone(value);
  const graph = validateModuleGraph(result, { models, depth, budget });
  return { ...result, name: graph.name, nodes: graph.nodes, edges: graph.edges };
}

/** Default wiring exposes every requested boundary without introducing lifecycle nodes. */
export function createModuleDefinition({ id = 'module', name = 'Новый модуль', inputs = 1, outputs = 1 } = {}) {
  if (![inputs, outputs].every(n => Number.isInteger(n) && n >= 1 && n <= 16)) fail('Нужно от 1 до 16 портов.');
  const inputPorts = Array.from({ length: inputs }, (_, i) => ({ id: `in${i + 1}`, label: `Вход ${i + 1}` }));
  const outputPorts = Array.from({ length: outputs }, (_, i) => ({ id: `out${i + 1}`, label: `Выход ${i + 1}` }));
  const nodes = [
    ...inputPorts.map((p, i) => ({ id: `input_${i + 1}`, type: 'module_input', position: { x: 0, y: i * 160 }, data: { port: p.id } })),
    { id: 'prompt', type: 'prompt', position: { x: 340, y: 0 }, data: { text: '' } },
    ...outputPorts.map((p, i) => ({ id: `output_${i + 1}`, type: 'module_output', position: { x: 680, y: i * 160 }, data: { port: p.id } })),
  ];
  const pairs = [...inputPorts.map((_, i) => [`input_${i + 1}`, 'prompt']), ...outputPorts.map((_, i) => ['prompt', `output_${i + 1}`])];
  return validateModuleDefinition({ id, name, version: 1, inputs: inputPorts, outputs: outputPorts, nodes, edges: pairs.map(([source, target], i) => ({ id: `edge_${i + 1}`, source, target, sourceHandle: 'out', targetHandle: 'in' })) });
}
