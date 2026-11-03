export const GEM_TRACE_SAMPLES = 64;
export const GEM_IDLE_MS = 220;

/** Only completed full-image samples count. A motion/change invalidates both partial tiles and the old average. */
export function createGemRefinement() {
  let key = '', changedAt = 0, samples = 0, tile = 0, fastDrawn = false;
  let changes = 0, quietMs = 0;
  return {
    get samples() { return samples; },
    get tile() { return tile; },
    get changes() { return changes; },
    get quietMs() { return quietMs; },
    next(nextKey: string, now: number, traceEnabled: boolean, tiles: number) {
      const modeKey = `${traceEnabled ? 'trace' : 'fast'}:${nextKey}`;
      const changed = key !== modeKey;
      if (changed) { key = modeKey; changedAt = now; samples = 0; tile = 0; fastDrawn = false; changes++; }
      quietMs = now - changedAt;
      const quiet = now - changedAt >= GEM_IDLE_MS;
      if (!fastDrawn) { fastDrawn = true; return { mode: 'fast' as const, changed, sample: 0, tile: 0 }; }
      if (!traceEnabled || !quiet || samples >= GEM_TRACE_SAMPLES) return { mode: 'cached' as const, changed, sample: samples, tile };
      return { mode: 'trace' as const, changed, sample: samples, tile: Math.min(tile, tiles - 1) };
    },
    completeTile(tiles: number) {
      tile++;
      if (tile < tiles) return false;
      tile = 0; samples = Math.min(GEM_TRACE_SAMPLES, samples + 1); return true;
    },
  };
}

/** Small scissored trace batches, not a full-screen multi-bounce pass every animation frame. */
export function gemTraceTiles(width: number, height: number, maxPixels = 160_000) {
  const rows = Math.max(1, Math.ceil(width * height / maxPixels));
  return Array.from({ length: rows }, (_, i) => {
    const y = Math.floor(height * i / rows), end = Math.floor(height * (i + 1) / rows);
    return { x: 0, y, width, height: end - y };
  });
}
