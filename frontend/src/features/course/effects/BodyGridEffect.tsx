'use client';
import { profileEffectFrame } from './effectDiagnostics';


import { useEffect, useMemo, useReducer, useRef } from 'react';
import { createPortal } from 'react-dom';
import { EffectTuningPanel } from './tuning/EffectTuningPanel';
import type { EffectTuningState } from './tuning/types';
import { createGridTrail } from './gridTrail';
import { useEffectHost, effectBounds, effectPoint, observeEffectSize } from './EffectHost';

const MAX_DPR = 2;

export type BodyGridTuningParams = {
  /** Side length of one grid cell in CSS pixels — the grid always has however many cells fit the
   * viewport at this size, not a fixed cell count. */
  cellSize: number;
  /** Seconds for a cell to fade from full brightness back to nothing once the cursor leaves it. */
  decaySeconds: number;
  /** Opacity floor added on top of the brightness-scaled term below, so a freshly-lit cell isn't razor-thin. */
  alphaBase: number;
  /** How much of a lit cell's opacity comes from its current brightness (0..1). */
  alphaScale: number;
  /** Max glow blur radius (px) at full brightness. */
  glowBlur: number;
  /** Opacity of the always-visible partition lines between cells. */
  lineAlpha: number;
  /** Stroke width (px) of the partition lines. */
  lineWidth: number;
};

export function createBodyGridParams(): BodyGridTuningParams {
  return {
    cellSize: 45, decaySeconds: 1, alphaBase: 0, alphaScale: 1, glowBlur: 60, lineAlpha: 0.22, lineWidth: 3,
  };
}

/**
 * A grid of glowing cells — each exactly `cellSize` CSS pixels square — covering the whole
 * viewport, portalled straight into `document.body` so it sits behind every page's content
 * instead of being boxed in by whichever group card mounted it. Whichever cell the cursor is over
 * snaps to full brightness immediately; every other cell decays linearly toward zero over
 * `decaySeconds` from wherever it last was — so cells the cursor passes through light up
 * instantly and the trail behind it fades out gradually, rather than everything dimming/
 * brightening on a shared clock.
 */
export function BodyGridEffect({ accent }: { accent: string }) {
  const host = useEffectHost();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tuning = useMemo<EffectTuningState>(() => ({ kind: 'body-grid', params: createBodyGridParams() }), []);
  const [rev, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const params = tuning.kind === 'body-grid' ? tuning.params : createBodyGridParams();
    const { cellSize, decaySeconds, alphaBase, alphaScale, glowBlur, lineAlpha, lineWidth } = params;
    // `body`/`<main>` go transparent/translucent while this is active (see globals.css and
    // app-shell.module.css) so this canvas can show through them — which means this canvas is now
    // the only thing painting the page's actual background color. Reading the same `--background`
    // custom property those rules already key off keeps it correct across the light/dark theme
    // instead of falling back to the browser's own default (white) canvas.
    let pageBg = getComputedStyle(document.body).getPropertyValue('--background').trim() || '#ffffff';
    // next-themes toggles a class on <html> rather than remounting anything, so nothing else here
    // would ever notice a light/dark switch — without this the grid keeps painting whatever color
    // was current when the effect started, until a full page reload picks up the new one.
    const themeObserver = new MutationObserver(() => {
      pageBg = getComputedStyle(document.body).getPropertyValue('--background').trim() || '#ffffff';
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    let vw = effectBounds(host).width;
    let vh = effectBounds(host).height;
    let cols = 1;
    let rows = 1;
    let cells = new Float32Array(1);
    let trail = createGridTrail(cells, cols, rows, cellSize);
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    function resize() {
      vw = effectBounds(host).width;
      vh = effectBounds(host).height;
      cols = Math.max(1, Math.ceil(vw / cellSize));
      rows = Math.max(1, Math.ceil(vh / cellSize));
      cells = new Float32Array(cols * rows);
      trail = createGridTrail(cells, cols, rows, cellSize);
      canvas!.width = vw * dpr;
      canvas!.height = vh * dpr;
      canvas!.style.width = `${vw}px`;
      canvas!.style.height = `${vh}px`;
    }
    const stopResize = observeEffectSize(host, resize);

    const onMove = (e: PointerEvent) => {
      // Coalesced samples preserve curved motion; traversal fills every crossed cell even
      // when the browser supplies only two distant positions during a fast flick.
      const point = effectPoint(host, e);
      if (!point.inside) { trail.reset(); return; }
      for (const sample of e.getCoalescedEvents?.() ?? []) {
        const p = effectPoint(host, sample);
        if (p.inside) trail.move(p.x, p.y, e.pointerId);
      }
      trail.move(point.x, point.y, e.pointerId);
    };
    const onLeave = () => trail.reset();
    const onUp = (e: PointerEvent) => { if (e.pointerType !== 'mouse') trail.reset(); };
    const onVisibility = () => { if (document.hidden) trail.reset(); };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onLeave);
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    document.addEventListener('visibilitychange', onVisibility);

    let rafId = 0;
    let lastTime = 0;
    const loop = profileEffectFrame(canvas, (time: number) => {
      rafId = requestAnimationFrame(loop);
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
      lastTime = time;

      const decayStep = dt / decaySeconds;
      for (let i = 0; i < cells.length; i++) {
        if (cells[i] > 0) cells[i] = Math.max(0, cells[i] - decayStep);
      }
      trail.hold();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = pageBg;
      ctx.fillRect(0, 0, vw, vh);

      // Partition lines between every cell, always faintly visible regardless of theme.
      ctx.strokeStyle = `rgba(140,150,160,${lineAlpha})`;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      for (let c = 1; c < cols; c++) {
        const x = Math.round(c * cellSize) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, vh);
      }
      for (let r = 1; r < rows; r++) {
        const y = Math.round(r * cellSize) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(vw, y);
      }
      ctx.stroke();

      // Lit cells, drawn after the grid lines so their glow isn't cut by a partition on top.
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const v = cells[row * cols + col];
          if (v <= 0.001) continue;
          const x = col * cellSize;
          const y = row * cellSize;
          ctx.save();
          ctx.shadowColor = accent;
          ctx.shadowBlur = glowBlur * v;
          ctx.fillStyle = accent;
          ctx.globalAlpha = alphaBase + v * alphaScale;
          ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
          ctx.restore();
        }
      }
    });
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      themeObserver.disconnect();
      stopResize();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onLeave);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // `rev` intentionally restarts this whole effect (grid recompute included) whenever a debug
    // slider mutates tuning.params in place — that object's identity never changes, so it can't
    // be a dependency itself; `rev` is the signal that something inside it did.
  }, [accent, rev, tuning, host]);

  return (
    <>
      {createPortal(
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
        />,
        host ?? document.body,
      )}
      <EffectTuningPanel tuning={tuning} onChange={bump} />
    </>
  );
}
