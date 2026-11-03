export const FULL_HD_EFFECT_WIDTH = 1920;
export const FULL_HD_EFFECT_QUERY = `(min-width: ${FULL_HD_EFFECT_WIDTH}px)`;

/** Card-only exceptions never expand; other effects follow viewport, manual choice and focus. */
export function getCardPlacement(fullHd: boolean, manualCard?: boolean, focused = false, cardOnly = false): boolean {
  if (cardOnly) return true;
  if (focused) return false;
  return manualCard ?? !fullHd;
}
