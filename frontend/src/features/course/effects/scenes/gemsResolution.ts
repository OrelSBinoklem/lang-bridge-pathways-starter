/** User quality remains explicit; there is no DPR or pixel-budget cap hidden below it. */
export function gemsRenderSize(width: number, height: number, dpr: number, quality = 1) {
  const scale = Math.max(.4, Math.min(1, quality)) * dpr;
  return { width: Math.max(64, Math.round(width * scale)), height: Math.max(64, Math.round(height * scale)) };
}
