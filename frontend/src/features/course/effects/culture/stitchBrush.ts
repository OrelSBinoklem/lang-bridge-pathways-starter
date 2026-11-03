/** A node is one stitch cell, not one screen pixel. Always measure from the real cursor. */
export function stitchBrushRadius(nodeSize: number, requestedNodes: number): number {
  if (!Number.isFinite(nodeSize) || nodeSize <= 0) return 0;
  return nodeSize * Math.max(.5, Math.min(6, Number.isFinite(requestedNodes) ? requestedNodes : 6));
}

export function inStitchBrush(cell: { x: number; y: number }, nodeSize: number, cursor: { x: number; y: number; active: boolean }, radius: number): boolean {
  return cursor.active && radius > 0 && Math.hypot(cell.x + nodeSize / 2 - cursor.x, cell.y + nodeSize / 2 - cursor.y) <= radius;
}

type StitchNode = { x: number; y: number; done: boolean; active: boolean };
type Point = { x: number; y: number };

/** Keep the current pass stable while the cursor jitters: adjacent rows run in opposite directions. */
export function createStitchTraversal<T extends StitchNode>() {
  let pending: T[] = [];
  return {
    clear() { pending = []; },
    next(candidates: () => T[], nodeSize: number, brush: Point & { active: boolean }, radius: number, needle: Point): T | null {
      const eligible = (cell: T) => !cell.done && !cell.active && inStitchBrush(cell, nodeSize, brush, radius);
      // Discard nodes that left the brush, including after a sudden jump to another motif.
      pending = pending.filter(eligible);
      if (!pending.length && brush.active && radius > 0) {
        const rows = new Map<number, T[]>();
        for (const cell of candidates()) {
          if (!eligible(cell)) continue;
          const row = Math.round(cell.y / nodeSize);
          const cells = rows.get(row);
          if (cells) cells.push(cell);
          else rows.set(row, [cell]);
        }
        const ordered = [...rows.entries()].sort(([a], [b]) => a - b);
        pending = ordered.flatMap(([, cells], i) => cells.sort((a, b) => i % 2 ? b.x - a.x : a.x - b.x));
        // Enter the whole zigzag from its nearer end, rather than jumping across the brush to start it.
        if (pending.length > 1) {
          const distance = (cell: T) => Math.hypot(cell.x + nodeSize / 2 - needle.x, cell.y + nodeSize / 2 - needle.y);
          if (distance(pending[pending.length - 1]) < distance(pending[0])) pending.reverse();
        }
      }
      return pending.shift() ?? null;
    },
  };
}

/** Local stitches keep their steady speed; distant targets are caught quickly with a smooth, distance-based boost. */
export function stepStitchNeedle(from: Point, to: Point, nodeSize: number, stitchRate: number, dt: number): Point {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const speed = nodeSize * Math.max(12, Math.min(80, stitchRate * 2));
  const local = nodeSize * 2;
  const catchUp = 40;
  const threshold = local + speed / catchUp;
  let remaining = distance;
  let seconds = Math.max(0, dt);
  // Exact integration across both speeds prevents frame-rate-dependent jumps at their boundary.
  if (remaining > threshold) {
    const fastSeconds = Math.min(seconds, Math.log((remaining - local) / (threshold - local)) / catchUp);
    remaining = local + (remaining - local) * Math.exp(-catchUp * fastSeconds);
    seconds -= fastSeconds;
  }
  remaining = Math.max(0, remaining - speed * seconds);
  const part = distance > 0 ? (distance - remaining) / distance : 0;
  return { x: from.x + (to.x - from.x) * part, y: from.y + (to.y - from.y) * part };
}
