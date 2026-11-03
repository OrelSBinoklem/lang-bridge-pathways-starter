import handlers from '../../../../../resources/tutor-flow/command-handlers.json' with { type: 'json' };
import { AdapterScopeError, type Command, type Dispatch, type DispatchContext, type McpConfig, type McpContext, type McpRun } from './contracts.mjs';

export { AdapterScopeError } from './contracts.mjs';
export type { Command, CommandResult, CommandScope, Dispatch, DispatchContext, McpConfig, McpContext, McpRun } from './contracts.mjs';
export const commandHandlers = handlers;
export type HandlerMetadata = (typeof handlers)[number];

/** Always goes through dispatchStructuredCommand's existing validation/action builder.
 * No UI execution here: client_api stays on the current authenticated browser route.
 * Scope denial throws before dispatch; callers keep their existing denial policy. */
export function dispatchRegisteredCommand(name: string, params: Record<string, unknown>, context: DispatchContext, { dispatch }: { dispatch: Dispatch }) {
  context.signal?.throwIfAborted();
  if (context.scope?.allowedCommands && !context.scope.allowedCommands.includes(name)) throw new AdapterScopeError(name);
  return dispatch(name, params, context.metadata ?? {});
}

/** Inject the result of createMcpFlowRunner(); its config validation, deadlines,
 * provider isolation and result/error contract remain authoritative. */
export function runRegisteredMcp<T>(config: McpConfig, context: McpContext, { run }: { run: McpRun<T> }): Promise<T> {
  context.signal?.throwIfAborted();
  if (context.scope?.allowedServices && !context.scope.allowedServices.includes(config.service)) throw new AdapterScopeError(config.service);
  if (!handlers.some(handler => handler.kind === 'mcp' && handler.service === config.service)) throw new AdapterScopeError(config.service);
  return run(config, context);
}

/** Immutable dependencies only; instantiate with the caller's dispatcher/runner.
 * Context/scope/signal are supplied per invocation and never retained globally. */
export class CommandAdapterRegistry {
  constructor(private readonly dependencies: { dispatch: Dispatch; run: McpRun }) {}
  get metadata() { return commandHandlers; }
  execute(command: Command, context: DispatchContext = {}) {
    return dispatchRegisteredCommand(command.name, command.params ?? {}, context, this.dependencies);
  }
  runMcp(config: McpConfig, context: McpContext = {}) {
    return runRegisteredMcp(config, context, this.dependencies);
  }
}
