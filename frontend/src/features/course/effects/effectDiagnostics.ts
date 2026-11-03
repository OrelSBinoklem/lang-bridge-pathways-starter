import { createFrameMeter, installGlTracking, trackGlContext, type FrameLoad } from './scenes/frameMeter';

let viewers = 0;
const readings = new Map<HTMLElement, FrameLoad & { at: number }>();
export const effectDiagnosticsEnabled = () => viewers > 0;

export function startEffectDiagnostics() {
  viewers++;
  installGlTracking();
  return () => { viewers--; if (!viewers) readings.clear(); };
}

export function recordEffectFrame(element: HTMLElement, load: FrameLoad) {
  if (viewers) readings.set(element, { ...load, at: performance.now() });
}

export function readEffectDiagnostics() {
  const now = performance.now();
  const active = [];
  for (const [element, reading] of readings) {
    if (!element.isConnected) { readings.delete(element); continue; }
    if (now - reading.at < 1500) active.push(reading);
  }
  if (!active.length) return null;
  const cpu = active.reduce((sum, reading) => sum + reading.cpu, 0);
  const gpu = active.every(reading => reading.gpu !== null) ? active.reduce((sum, reading) => sum + reading.gpu!, 0) : null;
  return { cpu, gpu, fps: Math.min(...active.map(reading => reading.fps)), load: Math.max(cpu, gpu ?? 0) * 6 };
}

/** Wrap only the renderer's own callback, never the browser's global animation API. */
export function profileEffectFrame(element: HTMLElement, frame: (time: number) => void) {
  let meter: ReturnType<typeof createFrameMeter> | undefined;
  return (time: number) => {
    if (!viewers) { meter = undefined; frame(time); return; }
    if (!meter) {
      if (element instanceof HTMLCanvasElement) {
        const gl = element.getContext('webgl2');
        if (gl) trackGlContext(gl);
      }
      meter = createFrameMeter(0, element);
    }
    meter.begin(time);
    try { frame(time); }
    finally { meter.end(); recordEffectFrame(element, meter.read()); }
  };
}
