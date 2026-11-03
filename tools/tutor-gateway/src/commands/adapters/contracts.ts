/** Structural contracts for the existing dispatcher and MCP runner. No provider lives here. */
export type Params = Record<string, unknown>;
export type Command = { name: string; params?: Params };
export type CommandResult = {
  type: 'command.result'; version: string; commandId: string; ok: boolean;
  command: string | null; executor: string; action: Params | null;
  message: string; metadata: Params; errors: unknown[];
};
export type CommandScope = {
  /** Omit to permit the existing dispatcher catalogue. An empty list permits nothing. */
  allowedCommands?: readonly string[];
  allowedServices?: readonly string[];
};
export type DispatchContext = {
  scope?: CommandScope; signal?: AbortSignal; metadata?: Params;
};
export type Dispatch = (name: string, params: Params, metadata: Params) => CommandResult;
export type McpConfig = {
  service: 'grammar_search' | 'grammar_table' | 'web_search';
  query: string; tableKey: string; limit: number;
};
export type McpContext = {
  scope?: CommandScope; signal?: AbortSignal;
  event?: { transcript?: string; [key: string]: unknown };
  [key: string]: unknown;
};
export type McpRun<T = unknown> = (config: McpConfig, context: McpContext) => Promise<T>;
export class AdapterScopeError extends Error {
  readonly code = 'adapter_scope_denied';
  constructor(readonly target: string) { super(`Handler is outside the caller scope: ${target}`); }
}
