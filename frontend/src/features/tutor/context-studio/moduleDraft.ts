import { cleanGraph, type FlowGraph, type ModuleDefinition } from './flowEditor';

export function cleanModule(definition: ModuleDefinition): ModuleDefinition {
  const graph: FlowGraph = { version: 2, name: definition.name, nodes: definition.nodes, edges: definition.edges };
  const clean = cleanGraph(graph);
  return { ...definition, nodes: clean.nodes, edges: clean.edges };
}
const fingerprint = (definition: ModuleDefinition) => JSON.stringify(cleanModule(definition));
export type ModuleDraft = { draft: ModuleDefinition; baseline: string; saved: boolean; generation: number };
type Action =
  | { type: 'edit'; update: ModuleDefinition | ((current: ModuleDefinition) => ModuleDefinition) }
  | { type: 'load'; definition: ModuleDefinition; saved: boolean }
  | { type: 'saved'; submitted: ModuleDefinition; definition: ModuleDefinition; generation: number };

export function createModuleDraft(definition: ModuleDefinition, saved = false): ModuleDraft {
  return { draft: structuredClone(definition), baseline: fingerprint(definition), saved, generation: 0 };
}

/** Apply a save response atomically without replacing newer edits or another open module. */
export function moduleDraftReducer(state: ModuleDraft, action: Action): ModuleDraft {
  if (action.type === 'edit') return { ...state, draft: typeof action.update === 'function' ? action.update(state.draft) : action.update };
  if (action.type === 'load') return { ...createModuleDraft(action.definition, action.saved), generation: state.generation + 1 };
  if (state.generation !== action.generation || state.draft.id !== action.submitted.id) return state;
  const unchanged = fingerprint(state.draft) === fingerprint(action.submitted);
  return {
    ...state, saved: true, baseline: fingerprint(action.definition),
    draft: unchanged ? structuredClone(action.definition) : { ...state.draft, version: action.definition.version },
  };
}
