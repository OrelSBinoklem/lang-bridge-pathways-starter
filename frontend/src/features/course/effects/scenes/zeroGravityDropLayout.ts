export type DropPlacement = { x: number; y: number; scale: number; phase: number; rate: number; warm: boolean };

/** Shared camera/placements for rendering and hit testing. World units, the original drop radius is .94. */
export function zeroGravityDropLayout(width: number, height: number, course = false, body = false, contentVisible = true) {
  const aspect = width / height;
  const halfY = 1.55 * Math.max(1, 1 / aspect), halfX = halfY * aspect;
  const worldPerPixel = 2 * halfY / height;
  const placement = (x: number, y: number, radius: number, phase = 0, rate = 1, warm = false): DropPlacement => ({
    x: (x - width / 2) * worldPerPixel, y: (height / 2 - y) * worldPerPixel,
    scale: radius * worldPerPixel / .94, phase, rate, warm,
  });
  if (!course) return { halfX, halfY, drops: [{ x: 0, y: 0, scale: 1, phase: 0, rate: 1, warm: false }] };
  if (!body && height < 480) {
    const zone = Math.min(width * .34, height * .9);
    return { halfX, halfY, drops: [placement(width - zone / 2 - 8, height / 2, Math.min(zone * .34, height * .34))] };
  }
  // Keep the 1240px course column clear; focus gets two larger half-screen compositions.
  const zone = body && contentVisible && width > 1240 ? (width - 1240) / 2 : width / 2;
  const radius = Math.min(zone * .30, height * .27);
  return { halfX, halfY, drops: [
    placement(zone / 2, height * .48, radius),
    placement(width - zone / 2, height * .56, radius * .88, 2.3, .83, true),
  ] };
}

export function dropHitCoordinates(rawX: number, rawY: number, width: number, height: number, halfX: number, halfY: number, centerX: number, centerY: number, scale: number) {
  return {
    x: ((rawX / width * 2 - 1) * halfX - centerX) / (.94 * scale),
    y: ((1 - rawY / height * 2) * halfY - centerY) / (.94 * scale),
  };
}
