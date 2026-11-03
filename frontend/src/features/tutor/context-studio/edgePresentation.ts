import type { FlowEdge } from './flowEditor';

// Fixed port colours keep a connection recognisable when inputs are reordered.
export const PORT_COLOURS = ['#7c3aed', '#008b83', '#cf7900', '#2563eb', '#c23987', '#56851c', '#b34e27', '#5260bd'];
export function portColour(handle?: string | null) {
  const index = /^in([1-9]|1[0-6])$/.exec(handle ?? '');
  return index ? PORT_COLOURS[(Number(index[1]) - 1) % PORT_COLOURS.length] : undefined;
}

export function edgePresentation(edges: FlowEdge[], edge: FlowEdge) {
  const sourceHash = [...edge.source].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
  const siblings = edges.filter(item => item.target === edge.target).sort((a, b) =>
    (a.targetHandle ?? '').localeCompare(b.targetHandle ?? '', 'en', { numeric: true }) || a.id.localeCompare(b.id));
  const index = siblings.findIndex(item => item.id === edge.id);
  return {
    colour: portColour(edge.targetHandle) ?? (edge.sourceHandle === 'true' ? '#008b83' : edge.sourceHandle === 'false' ? '#c04f56' : PORT_COLOURS[sourceHash % PORT_COLOURS.length]),
    // Fan in along separate tracks, rather than stacking every bend at the midpoint.
    lane: .2 + .6 * (index + 1) / (siblings.length + 1),
    branch: edge.sourceHandle === 'false',
  };
}

export function edgeFocus(edges: FlowEdge[], hovered: { kind: string; id: string } | null, selected: string[]) {
  const ids = new Set(selected);
  for (const edge of edges) if (hovered?.kind === 'edge' ? edge.id === hovered.id : hovered?.kind === 'node' && (edge.source === hovered.id || edge.target === hovered.id)) ids.add(edge.id);
  const nodes = new Set<string>();
  for (const edge of edges) if (ids.has(edge.id)) { nodes.add(edge.source); nodes.add(edge.target); }
  return { edges: ids, nodes };
}
