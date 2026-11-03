/** Full-size burners: quality 1 means one render pixel per physical display pixel, with no hidden cap. */
export function burnerRenderScale(deviceRatio: number, quality = 1, compact = false) {
  const dpr = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  const q = Number.isFinite(quality) ? Math.min(1, Math.max(.35, quality)) : 1;
  // The small card keeps its explicitly cheaper profile; it is not the fullscreen quality control.
  return compact ? Math.min(dpr, 1.5) * (.6 + .4 * q) : dpr * q;
}
