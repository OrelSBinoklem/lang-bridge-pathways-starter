import type { NodeChange } from '@xyflow/react';

export type CanvasGeometry = Record<string, { measured?: { width: number; height: number }; dragging?: boolean }>;

/** React Flow must receive its measured sizes back on every controlled render.
 * Keep them outside the saved graph: stripping them during a drag clears all
 * handle bounds, while an unchanged DOM size never triggers another resize. */
export function updateCanvasGeometry(previous: CanvasGeometry, changes: NodeChange[]): CanvasGeometry {
  let next = previous;
  for (const change of changes) {
    if (change.type === 'remove') {
      if (next[change.id]) { if (next === previous) next = { ...previous }; delete next[change.id]; }
      continue;
    }
    if (change.type !== 'dimensions' && change.type !== 'position') continue;
    const old = next[change.id] || {};
    const measured = change.type === 'dimensions' && change.dimensions ? change.dimensions : old.measured;
    const dragging = change.type === 'position' && change.dragging !== undefined ? change.dragging : old.dragging;
    if (measured?.width === old.measured?.width && measured?.height === old.measured?.height && dragging === old.dragging) continue;
    if (next === previous) next = { ...previous };
    next[change.id] = { ...(measured ? { measured: { ...measured } } : {}), ...(dragging !== undefined ? { dragging } : {}) };
  }
  return next;
}
