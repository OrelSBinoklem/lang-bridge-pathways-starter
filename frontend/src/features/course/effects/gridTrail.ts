type Point = { x: number; y: number };

/** Visit every cell crossed by the segment, not just uniformly spaced samples of it. */
export function visitGridSegment(from: Point, to: Point, cellSize: number, cols: number, rows: number, visit: (index: number) => void) {
  const clamp = (value: number, count: number) => Math.max(0, Math.min(count * cellSize - 1e-7, value));
  const x0 = clamp(from.x, cols), y0 = clamp(from.y, rows);
  const x1 = clamp(to.x, cols), y1 = clamp(to.y, rows);
  let col = Math.floor(x0 / cellSize), row = Math.floor(y0 / cellSize);
  const endCol = Math.floor(x1 / cellSize), endRow = Math.floor(y1 / cellSize);
  const dx = x1 - x0, dy = y1 - y0;
  const stepX = Math.sign(dx), stepY = Math.sign(dy);
  const deltaX = dx ? cellSize / Math.abs(dx) : Infinity;
  const deltaY = dy ? cellSize / Math.abs(dy) : Infinity;
  let nextX = dx ? ((col + (stepX > 0 ? 1 : 0)) * cellSize - x0) / dx : Infinity;
  let nextY = dy ? ((row + (stepY > 0 ? 1 : 0)) * cellSize - y0) / dy : Infinity;
  visit(row * cols + col);
  while (col !== endCol || row !== endRow) {
    const tx = col === endCol ? Infinity : nextX;
    const ty = row === endRow ? Infinity : nextY;
    // Exactly through a corner: enter the diagonal cell without painting its untouched neighbours.
    if (tx <= ty) { col += stepX; nextX += deltaX; }
    if (ty <= tx) { row += stepY; nextY += deltaY; }
    visit(row * cols + col);
  }
}

/** Records input immediately, so several turns between two animation frames aren't lost. */
export function createGridTrail(cells: Float32Array, cols: number, rows: number, cellSize: number) {
  let previous: (Point & { pointerId: number }) | null = null;
  const light = (index: number) => { cells[index] = 1; };
  return {
    move(x: number, y: number, pointerId: number) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { previous = null; return; }
      const point = { x, y, pointerId };
      visitGridSegment(previous?.pointerId === pointerId ? previous : point, point, cellSize, cols, rows, light);
      previous = point;
    },
    hold() {
      if (previous) visitGridSegment(previous, previous, cellSize, cols, rows, light);
    },
    reset() { previous = null; },
  };
}
