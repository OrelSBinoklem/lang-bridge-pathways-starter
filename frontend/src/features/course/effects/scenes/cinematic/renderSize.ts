/** Keep CSS pixels, display density and the quality multiplier separate: never downsample twice. */
export function renderSize(width: number, height: number, dpr: number, quality: number, mobile: boolean) {
  const multiplier = Math.max(0.35, Math.min(1.5, quality));
  const density = Math.max(1, Math.min(2, dpr));
  const budget = mobile ? 2600000 : 9000000;
  const scale = Math.min(density * multiplier, Math.sqrt(budget / Math.max(1, width * height)));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
