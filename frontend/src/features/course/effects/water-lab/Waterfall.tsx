'use client';

import { useEffect, useRef, useState } from 'react';
import type { WaterPointer, WaterTool } from './waterfallSimulation';
import type { WaterfallRenderer } from './waterfallRenderer';

export type WaterfallSettings = { paused: boolean; flow: number; radius: number; tool: WaterTool; reset: number };

export function Waterfall({ settings }: { settings: WaterfallSettings }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  const [error, setError] = useState('');
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const abort = new AbortController();
    let renderer: WaterfallRenderer | null = null;
    let disposed = false, raf = 0, last = 0, accumulator = 0, clock = 0;
    let dirty = true, lastSettings = settingsRef.current;
    let frames = 0, submittedMs = 0, sampleStart = performance.now();
    let w = 1000, h = 850, reset = settingsRef.current.reset;
    const pointer: WaterPointer = { x: 0, y: 0, active: false, radius: 52, tool: 'barrier' };
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = motion.matches;
    const onMotion = () => { reduced = motion.matches; dirty = true; };
    const draw = () => {
      if (disposed || document.hidden) return;
      dirty = false;
      if (renderer) {
        renderer.render(clock, pointer);
      }
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      h = 850; w = h * rect.width / rect.height;
      const dpr = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(1.4e6 / (rect.width * rect.height)));
      canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
      renderer?.resize(canvas.width, canvas.height, w, h);
      pointer.active = false; dirty = true; draw();
    };
    import('./waterfallRenderer').then(mod => disposed ? null : mod.createWaterfallRenderer(abort.signal, canvas)).then(result => {
      if (!result) return;
      if (disposed) { result.dispose(); return; }
      renderer = result; renderer.resize(canvas.width, canvas.height, w, h); dirty = true; draw();
    }).catch(cause => {
      if (disposed) return;
      console.error('Waterfall renderer failed', cause);
      setError('Не удалось загрузить воду. Проверьте доступность WebGL и обновите страницу.');
    });
    const point = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (e.clientX - rect.left) / rect.width * w;
      pointer.y = (e.clientY - rect.top) / rect.height * h;
      pointer.active = true; dirty = true;
      if (e.type === 'pointerdown') canvas.setPointerCapture(e.pointerId);
    };
    const leave = () => { pointer.active = false; dirty = true; };
    const up = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (e.pointerType !== 'mouse') leave();
    };
    const visibility = () => { last = 0; accumulator = 0; pointer.active = false; dirty = true; frames = 0; submittedMs = 0; sampleStart = performance.now(); };
    const frame = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      if (document.hidden) { last = 0; return; }
      accumulator += last ? Math.min((now - last) / 1000, 0.05) : 1 / 60; last = now;
      if (accumulator < 1 / 30) return;
      const dt = Math.min(accumulator, 0.05); accumulator = 0;
      const started = performance.now();
      const current = settingsRef.current;
      if (current !== lastSettings) { dirty = true; lastSettings = current; }
      pointer.radius = current.radius; pointer.tool = current.tool;
      if (current.reset !== reset) { renderer?.reset(); reset = current.reset; clock = 0; }
      if (!current.paused && (!reduced || pointer.active)) { renderer?.advance(dt, pointer, current.flow); clock += dt; dirty = true; }
      if (dirty) { draw(); frames++; submittedMs += performance.now() - started; }
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    const inspect = () => {
      if (renderer) canvas.dataset.fluidDiagnostics = JSON.stringify({ ...renderer.inspect(),
        averageSubmissionMs: frames ? submittedMs / frames : 0,
        averageFps: frames * 1000 / Math.max(1, performance.now() - sampleStart),
      });
    };
    if (process.env.NODE_ENV === 'development') canvas.addEventListener('waterfall-inspect', inspect);
    canvas.addEventListener('pointermove', point); canvas.addEventListener('pointerdown', point);
    canvas.addEventListener('pointerleave', leave); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', leave);
    document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', leave);
    motion.addEventListener('change', onMotion);
    raf = requestAnimationFrame(frame);
    return () => {
      disposed = true; abort.abort(); cancelAnimationFrame(raf); observer.disconnect(); renderer?.dispose();
      canvas.removeEventListener('waterfall-inspect', inspect);
      canvas.removeEventListener('pointermove', point); canvas.removeEventListener('pointerdown', point);
      canvas.removeEventListener('pointerleave', leave); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', leave);
      document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', leave);
      motion.removeEventListener('change', onMotion);
    };
  }, []);
  return <><canvas ref={canvasRef} aria-label="Интерактивный 2D-водопад" style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', background: '#354741' }} />{error && <p role="alert" style={{ position: 'absolute', inset: '45% 16px auto', textAlign: 'center', color: '#fff' }}>{error}</p>}</>;
}
