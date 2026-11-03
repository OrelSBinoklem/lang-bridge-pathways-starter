/** Global default for grammar table embeds — MOBILE trainer font controller. Change to 100 or 120 when needed. */
export const GRAMMAR_EMBED_FONT_SCALE_PERCENT = 130;

export const GRAMMAR_EMBED_BASE_FONT_PX = 16;

export function embedFontPx(scalePercent: number = GRAMMAR_EMBED_FONT_SCALE_PERCENT): number {
  return GRAMMAR_EMBED_BASE_FONT_PX * (scalePercent / 100);
}