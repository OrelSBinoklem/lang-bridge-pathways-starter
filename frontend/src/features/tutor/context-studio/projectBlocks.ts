import type { FlowNode, ModuleDefinition, ModulePort } from './flowEditor';
import { PROJECT_CONTRACT, type ProjectModuleRuntime, type ProjectGraph } from './projectScheme';

export type BlockEdge = { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null; channel?: string };
export type ModuleSnapshot = ProjectModuleRuntime & { graph: { name: string; nodes: FlowNode[]; edges: BlockEdge[] } };
export type ModuleSnapshots = Record<string, ModuleSnapshot>;
export type BlockPreview = { id: string; moduleId: string; parentId: string; source: FlowNode; position: { x: number; y: number }; inputs: string[]; outputs: string[];
  expanded?: boolean; width?: number; height?: number; inputPorts?: ModulePort[]; outputPorts?: ModulePort[] };
export type ModuleFrame = { id: string; position: { x: number; y: number }; width: number; height: number; blocks: BlockPreview[] };
export const blockId = (reference: string, node: string) => `@block:${reference}:${node}`;

/** Derived bounds never mutate executable graphs or user state. */
export function masterFrameBounds(nodes: { parentId?: string; position: { x: number; y: number }; style?: { width?: unknown; height?: unknown }; measured?: { width?: number; height?: number } }[]) {
  const top = nodes.filter(node => !node.parentId);
  const minX = Math.min(0, ...top.map(node => node.position.x)), minY = Math.min(0, ...top.map(node => node.position.y));
  const width = (node: typeof top[number]) => typeof node.style?.width === 'number' ? node.style.width : node.measured?.width ?? 340;
  const height = (node: typeof top[number]) => typeof node.style?.height === 'number' ? node.style.height : node.measured?.height ?? 540;
  return { position: { x: minX - 80, y: minY - 180 }, width: Math.max(600, ...top.map(node => node.position.x + width(node))) - minX + 160,
    height: Math.max(360, ...top.map(node => node.position.y + height(node))) - minY + 260 };
}

/** Same instance IDs and outer wires in both folded and expanded forms. */
function layoutContents(source: ModuleSnapshot['graph'], moduleId: string, parentId: string, expanded: ReadonlySet<string>, path = '', depth = 0) {
  const blocks: BlockPreview[] = [], edges: BlockEdge[] = [];
  const columns = [...new Set(source.nodes.map(node => node.position.x))].sort((a, b) => a - b);
  const minY = Math.min(0, ...source.nodes.map(node => node.position.y));
  let left = 320, bottom = 360;
  const localId = (id: string) => blockId(moduleId, `${path}${id}`);
  for (const x of columns) {
    let y = 120, width = 250;
    for (const node of source.nodes.filter(node => node.position.x === x).sort((a, b) => a.position.y - b.position.y || a.id.localeCompare(b.id))) {
      const id = localId(node.id), incoming = source.edges.filter(edge => edge.target === node.id), outgoing = source.edges.filter(edge => edge.source === node.id);
      const definition = node.type === 'module' ? node.data.definition as ModuleDefinition | undefined : undefined;
      const children = definition && expanded.has(id) && depth < 3 ? layoutContents(definition, moduleId, id, expanded, `${path}${node.id}__`, depth + 1) : null;
      if (children) children.height = Math.max(children.height, 180 + 38 * Math.max(definition!.inputs.length, definition!.outputs.length));
      y = Math.max(y, 120 + node.position.y - minY);
      blocks.push({ id, moduleId, parentId, source: node, position: { x: left, y },
        inputs: definition?.inputs.map(port => port.id) ?? [...new Set(incoming.map(edge => edge.targetHandle ?? 'in'))],
        outputs: definition?.outputs.map(port => port.id) ?? [...new Set(outgoing.map(edge => edge.sourceHandle ?? 'out'))],
        ...(children ? { expanded: true, width: children.width, height: children.height, inputPorts: definition!.inputs, outputPorts: definition!.outputs } : {}) });
      if (children) { blocks.push(...children.blocks); edges.push(...children.edges); }
      width = Math.max(width, children?.width ?? 250); y += (children?.height ?? 230) + 40; bottom = Math.max(bottom, y + 60);
    }
    left += width + 80;
  }
  const ids = new Set(source.nodes.map(node => node.id));
  for (const edge of source.edges) if (ids.has(edge.source) && ids.has(edge.target)) edges.push({ ...edge, id: `@inside:${moduleId}:${path}${edge.id}`, source: localId(edge.source), target: localId(edge.target) });
  return { blocks, edges, width: Math.max(800, left + 240), height: bottom };
}

export function projectModuleLayout(project: ProjectGraph, snapshots: ModuleSnapshots, expandedNested: ReadonlySet<string> = new Set()) {
  const frames: ModuleFrame[] = [], edges: BlockEdge[] = [], positions: Record<string, { x: number; y: number }> = {};
  const detailed = project.modules.some(reference => reference.expanded);
  for (const reference of project.modules) {
    if (!reference.expanded || !snapshots[reference.id]) continue;
    const contents = layoutContents(snapshots[reference.id].graph, reference.id, reference.id, expandedNested);
    frames.push({ id: reference.id, position: { x: 0, y: 0 }, width: contents.width, height: contents.height, blocks: contents.blocks }); edges.push(...contents.edges);
  }
  const columnWidth = Math.max(600, ...frames.map(frame => frame.width)) + 220;
  let y = 0;
  for (let i = 0; i < project.modules.length; i += 2) {
    let height = 0;
    for (let column = 0; column < 2; column++) {
      const reference = project.modules[i + column]; if (!reference) continue;
      const frame = frames.find(frame => frame.id === reference.id);
      positions[reference.id] = detailed ? reference.detailPosition ?? { x: 460 + column * columnWidth, y } : reference.position;
      if (frame) frame.position = positions[reference.id];
      height = Math.max(height, frame?.height ?? 540);
    }
    y += height + 240;
  }
  const anchors = detailed ? { events: { x: 0, y: 100 }, storage: { x: 460 + columnWidth * 2, y: 100 } }
    : Object.fromEntries(PROJECT_CONTRACT.anchors.map(anchor => [anchor.id, anchor.position]));
  return { frames, edges, positions, anchors };
}

export function blockSummary(node: FlowNode): string {
  const data = node.data;
  const value = node.type === 'prompt' ? data.text : node.type === 'source' ? data.source : node.type === 'event' ? data.event ?? data.title : node.type === 'model' ? data.model : node.type === 'context' ? `${data.mode ?? 'object'} · ${(data.order as unknown[] | undefined)?.length ?? 0} частей` : node.type === 'serialize' ? data.format : node.type === 'condition' ? `${data.field} ${data.operator} ${data.value}` : node.type === 'module' ? (data.definition as { name?: string } | undefined)?.name : data.title;
  return String(value ?? PROJECT_CONTRACT.modules.find(reference => reference.roles.includes(String(data.role)))?.name ?? node.type).slice(0, 260);
}
