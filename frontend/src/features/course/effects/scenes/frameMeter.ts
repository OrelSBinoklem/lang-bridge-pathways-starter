/**
 * How loaded the machine is by an effect, against a frame at 60 fps (16.7 ms) — owner: «индикация, на сколько %
 * загружена система при 60 кадрах».
 *
 * The processor's share is the time the scene's update and draw take. The graphics card works on its own, after the
 * calls return, so its share is measured on the card itself: every WebGL2 context the page makes is noted (getContext is
 * wrapped once) and, around each frame of the effect, a timer query (EXT_disjoint_timer_query_webgl2) is run on each
 * context the effect made — its result comes back a few frames later. The load is the larger of the two (they work at
 * the same time), so 100 % means the frame just fits in 16.7 ms; over 100 % the effect cannot keep 60 fps. Without
 * the extension (some browsers hide it) only the processor's share and the frame rate are shown.
 */

type Tracked = {
  gl: WebGL2RenderingContext;
  // The extension's constants (TIME_ELAPSED_EXT, GPU_DISJOINT_EXT), or null where the browser does not offer it.
  ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  born: number;
  open: WebGLQuery | null;
  pending: WebGLQuery[];
  /** The last measured time of a frame on the card, ms. */
  last: number | null;
};

const contexts: Tracked[] = [];
let installed = false;

export function trackGlContext(gl: WebGLRenderingContext | WebGL2RenderingContext) {
  if (!('createQuery' in gl) || contexts.some(t => t.gl === gl)) return;
  const context = gl as WebGL2RenderingContext;
  let ext: Tracked['ext'] = null;
  try { ext = context.getExtension('EXT_disjoint_timer_query_webgl2') as Tracked['ext']; } catch { /* Optional timer. */ }
  contexts.push({ gl: context, ext, born: performance.now(), open: null, pending: [], last: null });
}

/** Wraps getContext once so that WebGL2 contexts made from now on can be timed. */
export function installGlTracking() {
  if (installed || typeof HTMLCanvasElement === 'undefined') return;
  installed = true;
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (type: string, ...rest: unknown[]) => unknown };
  const original = proto.getContext;
  proto.getContext = function getContext(this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
    const ctx = original.call(this, type, ...rest);
    if (type === 'webgl2' && ctx) trackGlContext(ctx as WebGL2RenderingContext);
    return ctx;
  };
}

export type FrameLoad = { load: number; cpu: number; gpu: number | null; fps: number };

/** A meter for one running effect: the contexts made since `since` (performance.now()) are its own. */
export function createFrameMeter(since: number, element?: HTMLElement) {
  let t0 = 0;
  let cpu = 0;
  let gpu = 0;
  let gpuKnown = false;
  let fps = 60;
  let lastFrame = 0;
  const mine = () => contexts.filter((t) => (element ? t.gl.canvas === element : t.born >= since - 50) && !t.gl.isContextLost());
  return {
    /** Before the effect's frame. */
    begin(now: number) {
      if (lastFrame) {
        const dt = now - lastFrame;
        if (dt > 0 && dt < 500) fps += (1000 / dt - fps) * 0.1;
      }
      lastFrame = now;
      t0 = performance.now();
      for (const t of mine()) {
        if (!t.ext || t.open || t.pending.length > 6) continue;
        try {
          const q = t.gl.createQuery();
          if (!q) continue;
          t.gl.beginQuery(t.ext.TIME_ELAPSED_EXT, q);
          t.open = q;
        } catch {
          t.open = null;
        }
      }
    },
    /** After it. */
    end() {
      cpu += (performance.now() - t0 - cpu) * 0.1;
      let sum = 0;
      let any = false;
      for (const t of mine()) {
        if (!t.ext) continue;
        const { gl, ext } = t;
        try {
          if (t.open) {
            gl.endQuery(ext.TIME_ELAPSED_EXT);
            t.pending.push(t.open);
            t.open = null;
          }
          const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
          while (t.pending.length && gl.getQueryParameter(t.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
            const q = t.pending.shift()!;
            if (!disjoint) t.last = Number(gl.getQueryParameter(q, gl.QUERY_RESULT)) / 1e6;
            gl.deleteQuery(q);
          }
        } catch {
          t.open = null;
        }
        if (t.last !== null) { sum += t.last; any = true; }
      }
      // Contexts that are gone are let go of.
      for (let i = contexts.length - 1; i >= 0; i -= 1) if (contexts[i].gl.isContextLost()) contexts.splice(i, 1);
      if (any) {
        gpu += (sum - gpu) * 0.1;
        gpuKnown = true;
      }
    },
    read(): FrameLoad {
      const budget = 1000 / 60;
      const g = gpuKnown ? gpu : null;
      return { load: (Math.max(cpu, g ?? 0) / budget) * 100, cpu, gpu: g, fps };
    },
  };
}

export type FrameMeter = ReturnType<typeof createFrameMeter>;

/** The badge's text. */
export function frameLoadText(f: FrameLoad) {
  const ms = (v: number) => v.toFixed(1).replace('.', ',');
  // The load first (the badge is cut on the right on a narrow card).
  return [`Нагрузка ${Math.round(f.load)}% (от 60 к/с)`, `ЦП ${ms(f.cpu)} мс`, f.gpu === null ? 'ГП: нет таймера' : `ГП ${ms(f.gpu)} мс`, `${Math.round(f.fps)} к/с`].join(' · ');
}

/** The badge's colour: green with room to spare, amber near the budget, red over it. */
export const frameLoadColor = (load: number) => (load < 70 ? '#8fe3a4' : load < 100 ? '#ffd27a' : '#ff8a7a');
