/** The live course leaves the central column free; the isolated 3D exhibit uses the whole left half. */
export function skylinePinballLayout(width: number, height: number, expanded = false) {
  if (expanded && width >= 700) {
    const zone = width * .48, w = Math.min(zone - 24, height * .70), h = height * .88;
    return { x: (zone - w) / 2, y: (height - h) / 2, width: w, height: h };
  }
  const portrait = width < 700;
  const w = portrait ? Math.min(width * .75, height * .23) : Math.min(Math.max(180, (width - 1240) / 2 - 14), height * .42, width * .31);
  return { x: portrait ? (width - w) / 2 : Math.max(8, (Math.max(w + 16, (width - 1240) / 2) - w) / 2),
    y: portrait ? height * .5 : (height - w * 2.16) / 2, width: w, height: w * 2.16 };
}
