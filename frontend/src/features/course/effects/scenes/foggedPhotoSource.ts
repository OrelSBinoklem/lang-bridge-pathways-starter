export const BLACKHEADS_PHOTO = '/course/effects/blackheads-night-clean.webp';
export const BLACKHEADS_PHOTO_VARIANTS = [640, 960, 1440, 1920, 2560, 3840].map(width => ({
  width,
  url: `/course/effects/blackheads-night-riga-v4-${width}.jpg`,
}));
export const BLACKHEADS_PHOTO_4K = BLACKHEADS_PHOTO_VARIANTS[5].url;

/** Match cover sampling and the renderer's 1.5x DPR cap; compact scenes never fetch 4K. */
export function foggedPhotoSource(source: string | undefined, width: number, height: number, deviceScale = 1) {
  if (source !== BLACKHEADS_PHOTO) return source;
  const w = Number.isFinite(width) && width > 0 ? width : 640;
  const h = Number.isFinite(height) && height > 0 ? height : w * 0.75;
  const scale = Number.isFinite(deviceScale) ? Math.min(1.5, Math.max(1, deviceScale)) : 1;
  const compact = w < 1280 || h < 480;
  const coverWidth = Math.max(w, h * 4 / 3) * scale;
  const wanted = compact ? Math.min(1920, coverWidth) : coverWidth;
  return BLACKHEADS_PHOTO_VARIANTS.find(v => v.width >= wanted)?.url ?? BLACKHEADS_PHOTO_4K;
}

/** A strictly decreasing fallback chain, also skipping textures too large for this GPU. */
export function foggedPhotoFallback(source: string, maxTextureSize = Infinity) {
  const index = BLACKHEADS_PHOTO_VARIANTS.findIndex(v => v.url === source);
  if (index < 1) return undefined;
  const limit = Number.isFinite(maxTextureSize) ? Math.max(0, maxTextureSize) : Infinity;
  return BLACKHEADS_PHOTO_VARIANTS.slice(0, index).reverse().find(v => v.width <= limit)?.url;
}
