/** Stop work, not the scene: retain simulation state while its canvas is off screen. */
export function createVisibleAnimationLoop(element: HTMLElement, frame: (dt: number, time: number) => void, visibility?: (visible: boolean) => void) {
  const doc = element.ownerDocument;
  const view = doc.defaultView!;
  const rect = element.getBoundingClientRect();
  let intersects = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
    && rect.top < view.innerHeight && rect.left < view.innerWidth;
  let disposed = false;
  let request: number | null = null;
  let last: number | null = null;
  let reported: boolean | undefined;
  const active = () => !disposed && !doc.hidden && intersects;
  const loop = (time: number) => {
    request = null;
    if (!active()) return;
    const dt = last === null ? 1 / 60 : Math.max(0, Math.min((time - last) / 1000, .05));
    last = time;
    frame(dt, time);
    if (active() && request === null) request = view.requestAnimationFrame(loop);
  };
  const sync = () => {
    const running = active();
    if (reported !== running) { reported = running; visibility?.(running); }
    element.dataset.effectRunning = String(running);
    if (running) {
      if (request === null) request = view.requestAnimationFrame(loop);
    } else {
      if (request !== null) view.cancelAnimationFrame(request);
      request = null;
      last = null; // Do not catch up hours of hidden physics on return.
    }
  };
  const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
    if (disposed) return;
    for (const entry of entries) if (entry.target === element) intersects = entry.isIntersecting && entry.intersectionRatio > 0;
    sync();
  });
  // Older embedded browsers still animate; document visibility remains respected.
  if (!observer) intersects = true;
  observer?.observe(element);
  doc.addEventListener('visibilitychange', sync);
  sync();
  return () => {
    disposed = true;
    sync();
    observer?.disconnect();
    doc.removeEventListener('visibilitychange', sync);
    delete element.dataset.effectRunning;
  };
}
