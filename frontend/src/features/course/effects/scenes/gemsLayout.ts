/** Cell radius in CSS pixels. Small cards need more of the showcase visible, not one oversized stone. */
export function gemsCellRadius(width: number, height: number, desktopScale: number, mobileScale: number, body = false) {
  const base = 90 * (width <= 720 ? mobileScale * 0.8 : desktopScale);
  return base * (!body && height < 480 ? 0.6 : 1);
}
