import { randomUUID } from 'node:crypto';
import { commandRegistry, findCommand } from './registry.mjs';
import { navigationRoutes } from './routes.mjs';

export const COMMAND_RESULT_VERSION = 'tutor.command_result.v1';

function toPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function createCommandResult({
  ok,
  command = null,
  executor = 'node',
  action = null,
  message = '',
  metadata = {},
  errors = [],
}) {
  const result = {
    type: 'command.result',
    version: COMMAND_RESULT_VERSION,
    commandId: randomUUID(),
    ok: Boolean(ok),
    command,
    executor,
    action,
    message,
    metadata,
    errors,
  };

  assertStrictCommandResult(result);
  return result;
}

export function assertStrictCommandResult(result) {
  const required = ['type', 'version', 'commandId', 'ok', 'command', 'executor', 'action', 'message', 'metadata', 'errors'];
  for (const key of required) {
    if (!(key in result)) {
      throw new Error(`Invalid command result: missing ${key}`);
    }
  }

  if (result.type !== 'command.result') throw new Error('Invalid command result type');
  if (result.version !== COMMAND_RESULT_VERSION) throw new Error('Invalid command result version');
  if (typeof result.commandId !== 'string' || result.commandId.length === 0) {
    throw new Error('Invalid command result commandId');
  }
  if (typeof result.ok !== 'boolean') throw new Error('Invalid command result ok');
  if (result.command !== null && typeof result.command !== 'string') throw new Error('Invalid command result command');
  if (typeof result.executor !== 'string') throw new Error('Invalid command result executor');
  if (result.action !== null && (typeof result.action !== 'object' || Array.isArray(result.action))) {
    throw new Error('Invalid command result action');
  }
  if (typeof result.message !== 'string') throw new Error('Invalid command result message');
  if (!result.metadata || typeof result.metadata !== 'object' || Array.isArray(result.metadata)) {
    throw new Error('Invalid command result metadata');
  }
  if (!Array.isArray(result.errors)) throw new Error('Invalid command result errors');
}

function validateParams(entry, params) {
  const normalized = {};
  const errors = [];

  for (const [name, schema] of Object.entries(entry.params || {})) {
    const rawValue = params?.[name] ?? schema.default;
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      if (schema.required) {
        errors.push({
          code: 'missing_param',
          message: `Missing required parameter: ${name}`,
          path: name,
        });
      }
      continue;
    }

    if (schema.type === 'number') {
      const numberValue = toPositiveInteger(rawValue);
      if (numberValue === null) {
        errors.push({
          code: 'invalid_param',
          message: `Parameter must be a positive integer: ${name}`,
          path: name,
        });
        continue;
      }
      normalized[name] = numberValue;
      continue;
    }

    if (schema.type === 'string') {
      const stringValue = String(rawValue);
      if (schema.enum && !schema.enum.includes(stringValue)) {
        errors.push({
          code: 'invalid_param',
          message: `Parameter has unsupported value: ${name}`,
          path: name,
        });
        continue;
      }
      normalized[name] = stringValue;
      continue;
    }

    if (schema.type === 'object') {
      if (typeof rawValue !== 'object' || Array.isArray(rawValue)) {
        errors.push({
          code: 'invalid_param',
          message: `Parameter must be an object: ${name}`,
          path: name,
        });
        continue;
      }
      normalized[name] = rawValue;
      continue;
    }

    if (schema.type === 'array') {
      if (!Array.isArray(rawValue)) {
        errors.push({
          code: 'invalid_param',
          message: `Parameter must be an array: ${name}`,
          path: name,
        });
        continue;
      }
      normalized[name] = rawValue;
      continue;
    }

    normalized[name] = rawValue;
  }

  if (entry.command === 'navigate') {
    const routeParams = normalized.route_params || {};
    if (routeParams.dictionary_id !== undefined) {
      normalized.route_params = {
        ...routeParams,
        dictionary_id: toPositiveInteger(routeParams.dictionary_id),
      };
    }
    if (routeParams.category_id !== undefined) {
      normalized.route_params = {
        ...normalized.route_params,
        category_id: toPositiveInteger(routeParams.category_id),
      };
    }

    const routeDefinition = navigationRoutes.find((route) => route.id === normalized.route);
    if (!routeDefinition) {
      errors.push({
        code: 'invalid_param',
        message: 'Unknown navigation route.',
        path: 'route',
      });
    } else {
      for (const param of routeDefinition.params || []) {
        const rawParamValue = normalized.route_params?.[param.name] ?? param.default;
        if (param.required && (rawParamValue === undefined || rawParamValue === null || rawParamValue === '')) {
          errors.push({
            code: 'missing_param',
            message: `Missing required route parameter: ${param.name}`,
            path: `route_params.${param.name}`,
          });
          continue;
        }

        if (rawParamValue !== undefined && param.type === 'number') {
          const numberValue = toPositiveInteger(rawParamValue);
          if (numberValue === null) {
            errors.push({
              code: 'invalid_param',
              message: `Route parameter must be a positive integer: ${param.name}`,
              path: `route_params.${param.name}`,
            });
            continue;
          }
          normalized.route_params = {
            ...normalized.route_params,
            [param.name]: numberValue,
          };
        }
      }
    }
  }

  if (typeof entry.validate === 'function') {
    errors.push(...entry.validate(normalized));
  }

  return { params: normalized, errors };
}

export function dispatchStructuredCommand(command, params = {}, metadata = {}) {
  const entry = findCommand(command);
  if (!entry) {
    return createCommandResult({
      ok: false,
      command,
      executor: 'node',
      message: `Unsupported command: ${command || 'unknown'}`,
      metadata: { ...metadata, source: 'command.dispatcher' },
      errors: [
        {
          code: 'command_not_found',
          message: `Command is not registered: ${command || 'unknown'}`,
          path: 'command',
        },
      ],
    });
  }

  const validation = validateParams(entry, params);
  if (validation.errors.length > 0) {
    return createCommandResult({
      ok: false,
      command: entry.command,
      executor: entry.executor,
      message: 'Не хватает параметров для команды.',
      metadata: { ...metadata, source: 'command.dispatcher' },
      errors: validation.errors,
    });
  }

  const action = entry.action(validation.params);
  if (!action) {
    return createCommandResult({
      ok: false,
      command: entry.command,
      executor: entry.executor,
      message: 'Команда не смогла собрать действие.',
      metadata: { ...metadata, source: 'command.dispatcher' },
      errors: [
        {
          code: 'action_not_created',
          message: 'Command handler returned empty action.',
          path: 'action',
        },
      ],
    });
  }

  return createCommandResult({
    ok: true,
    command: entry.command,
    executor: entry.executor,
    action,
    message: action.type === 'commands_guide'
      ? 'Каталог доступных MCP-команд получен.'
      : action.type === 'command_doc'
        ? `Описание команды получено: ${action.command?.command || entry.command}`
      : action.type === 'route_guide'
      ? 'Список доступных роутов получен.'
      : action.type === 'grammar_tables_guide'
        ? 'Список грамматических HTML-таблиц получен.'
      : action.type === 'grammar_table_doc'
        ? `Дока таблицы получена: ${action.table?.title || entry.command}`
      : action.type === 'grammar_table_highlight'
        ? `Подсвечиваю: ${action.labelRu || entry.command}`
      : action.type === 'grammar_table_read'
        ? `Читаю таблицу: ${action.title || action.tableKey}`
      : action.type === 'grammar_table_hint'
        ? `Читаю подсказку к таблице: ${action.title || action.tableKey}`
      : action.type === 'grammar_lesson_present'
        ? `Показываю грамматический разбор: ${action.tableKeys.join(', ')}`
      : action.type === 'site_menu_guide'
        ? 'Описание возможностей меню получено.'
      : action.type === 'site_menu_activate'
        ? `Выполняю действие меню: ${action.action}`
      : action.type === 'verb_search_open'
        ? `Открываю спряжение глагола: ${action.query}`
      : action.type === 'verb_form_highlight'
        ? `Подсвечиваю форму глагола: ${action.tense}/${action.person}`
      : action.type === 'client_api'
        ? `Выполняю: ${entry.command}`
      : `Открываю: ${action.title || action.to || entry.command}`,
    metadata: {
      ...metadata,
      source: 'command.dispatcher',
      matched_command: entry.command,
    },
  });
}
