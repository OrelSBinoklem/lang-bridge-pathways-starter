export const CONTENT_WIDTH = 1240;
export const CONTENT_GAP = 24;
const MIN_SIDE_WIDTH = 160;

export type FullscreenRegion = { id: 'full' | 'left' | 'right'; left: number; top: number; width: number; height: number };

/** Keep the central reading column clear only while the course content is visible. */
export function getFullscreenRegions(width: number, height: number, contentVisible = false): FullscreenRegion[] {
  const sideWidth = Math.floor((width - CONTENT_WIDTH) / 2 - CONTENT_GAP);
  if (!contentVisible || sideWidth < MIN_SIDE_WIDTH) return [{ id: 'full', left: 0, top: 0, width, height }];
  return [
    { id: 'left', left: 0, top: 0, width: sideWidth, height },
    { id: 'right', left: width - sideWidth, top: 0, width: sideWidth, height },
  ];
}
