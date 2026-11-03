const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** One continuous landscape in fullscreen; the compact card keeps its original composition. */
export function getSongFireLayout(width: number, height: number, fullscreen = false) {
  const ground = fullscreen
    ? height - clamp(height * .14, 48, 160)
    : Math.min(height, 260) - 16;
  return {
    ground,
    fireX: width - clamp(width * .13, 100, 190),
    fireY: ground + 8,
  };
}
