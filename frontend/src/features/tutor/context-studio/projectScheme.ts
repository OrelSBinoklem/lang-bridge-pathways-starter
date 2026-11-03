import contract from '../../../../../resources/ai-studio/project.json';
import sessionPolicy from '../../../../../resources/tutor-flow/session-policy.json';

export type ModuleReference = { id: string; position: { x: number; y: number }; expanded: boolean; detailPosition?: { x: number; y: number } };
export type ProjectGraph = { version: 2; name: string; modules: ModuleReference[] };
export type ProjectDocument = { id: string; graph: ProjectGraph; version: number; revision: string };
export type ProjectConnection = typeof contract.connections[number];
export type ProjectDefinition = typeof contract.modules[number];
export type ProjectModuleRuntime = { active: number | null; nodes: number; edges: number; models: string[] };
export type ProjectCatalogue = { schemes: ProjectDocument[]; contract: typeof contract; modules: Record<string, ProjectModuleRuntime> };
export const PROJECT_CONTRACT = contract;
export const MASTER_SESSION_POLICY = sessionPolicy;
export const MASTER_FRAME_ID = '@master-session';
export const PROJECT_MODULE_NAMES = Object.fromEntries(contract.modules.map(reference => [reference.id, reference.name]));
const CONNECTION_COLOURS = ['#2563eb', '#008b83', '#7c3aed', '#c23987', '#b45309', '#56851c', '#b34e27', '#5260bd'];

/** Match both ports and the wire. Sibling outputs have distinct colours;
 * choosing a subset of modules or moving them never changes the assignment. */
export function projectConnectionColour(edge: ProjectConnection): string {
  const siblings = contract.connections.filter(item => item.source === edge.source).map(item => item.id).sort();
  const seed = [...edge.source].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
  return CONNECTION_COLOURS[(seed + Math.max(0, siblings.indexOf(edge.id))) % CONNECTION_COLOURS.length];
}

/** Stable port IDs belong to channels; dragging or selecting never changes bindings. */
export function projectChannels(graph: ProjectGraph): ProjectConnection[] {
  const ids = new Set(['events', 'storage', ...graph.modules.map(reference => reference.id)]);
  return contract.connections.filter(edge => ids.has(edge.source) && ids.has(edge.target));
}

export function moveProjectModules(graph: ProjectGraph, changes: { id?: string; type: string; position?: { x: number; y: number } }[], detailed = false): ProjectGraph {
  const moves = new Map(changes.filter(change => change.type === 'position' && typeof change.id === 'string' && change.position).map(change => [change.id!, change.position!]));
  if (![...moves.keys()].some(id => graph.modules.some(reference => reference.id === id))) return graph;
  return { ...graph, modules: graph.modules.map(reference => moves.has(reference.id) ? { ...reference, [detailed ? 'detailPosition' : 'position']: { x: moves.get(reference.id)!.x, y: moves.get(reference.id)!.y } } : reference) };
}

export function addProjectModule(graph: ProjectGraph, id: string): ProjectGraph {
  const reference = contract.modules.find(reference => reference.id === id);
  if (!reference || graph.modules.some(item => item.id === id)) return graph;
  return { ...graph, modules: [...graph.modules, { id, position: { ...reference.position }, expanded: false }] };
}

export function expandProjectModule(graph: ProjectGraph, id: string, expanded: boolean): ProjectGraph {
  if (!graph.modules.some(reference => reference.id === id && reference.expanded !== expanded)) return graph;
  return { ...graph, modules: graph.modules.map(reference => reference.id === id ? { ...reference, expanded } : reference) };
}
