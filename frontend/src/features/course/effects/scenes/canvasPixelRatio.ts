/** Infinity is an explicit native-resolution opt-in; existing scenes retain their historical caps. */
export function canvasPixelRatio(deviceRatio: number, body: boolean, cap?: number) {
  return Math.min(deviceRatio || 1, cap ?? (body ? 1 : 1.75));
}

/** Browser zoom / monitor changes can change DPR without changing a fixed-size card's CSS dimensions. */
export function watchPixelRatio(onChange: () => void, target: Window = window) {
  let ratio = target.devicePixelRatio || 1;
  let query: MediaQueryList | undefined;
  let disposed = false;
  const arm = () => {
    query?.removeEventListener('change', changed);
    // Chromium may report e.g. 2.0000000596 for a 2dppx media resolution: exact equality can start false.
    const low=Math.max(0,ratio-.0001).toFixed(6), high=(ratio+.0001).toFixed(6);
    query = target.matchMedia?.(`(min-resolution: ${low}dppx) and (max-resolution: ${high}dppx)`);
    query?.addEventListener('change', changed);
  };
  const changed = () => {
    if(disposed) return;
    const next = target.devicePixelRatio || 1;
    if(next === ratio) return;
    ratio = next;
    arm();
    onChange();
  };
  arm();
  target.addEventListener('resize', changed);
  return () => {
    disposed = true;
    query?.removeEventListener('change', changed);
    target.removeEventListener('resize', changed);
  };
}
