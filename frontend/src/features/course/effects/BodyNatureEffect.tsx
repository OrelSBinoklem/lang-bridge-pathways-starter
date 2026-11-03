'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';
import { EffectCanvas } from './EffectCanvas';
import type { PointerState } from './engine';
import type { GroupEffectDefinition } from './groupEffects.config';
import type { EffectTuningState } from './tuning/types';
import { PAGE_CONTROLS } from './scenes/BodySceneEffect';
import { createSakuraParams, type SakuraTuningParams } from './SakuraEffect';
import { currentPhase, drawLandscape, paletteAt } from './BodySakuraEffect';
import { useEffectHost, effectBounds, effectPoint, observeEffectSize } from './EffectHost';

/**
 * Behind the big sakura (owner: «сакуре с градиентами добавь зелень, горы, солнце, как на другом варианте, где две
 * сакуры»): the same painted landscape as the two-tree variant — the sky by the time of day, the sun (or the moon and
 * stars), the misty hills, the meadow with grass — redrawn every 20 s (the time of day moves slowly).
 */
function LandscapeBackdrop({ width, height, params }: { width: number; height: number; params: SakuraTuningParams }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const start = performance.now();
    const paint = () => {
      const phase = currentPhase(params, (performance.now() - start) / 1000);
      drawLandscape(ctx, width, height, phase, paletteAt(phase));
    };
    paint();
    const timer = window.setInterval(paint, params.timeMode === 'cycle' ? 1000 : 20000);
    return () => window.clearInterval(timer);
  }, [width, height, params]);
  return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

const DEFAULT_SAKURA = createSakuraParams();

export function BodyNatureEffect({ effect, tuning }: { effect: GroupEffectDefinition; tuning?: EffectTuningState | null }) {
  const host = useEffectHost();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const pointerRef = useRef<PointerState>({ x: 0, y: 0, active: false, moved: false });
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!host) document.body.classList.add('scene-body-active', 'scene-nature-active');
    const measure = () => { const { width, height } = effectBounds(host); setSize({ width, height }); };
    // A press on a button, link or control belongs to the page; any other press reaches the effect (the sakura
    // blows its blossoms off with it).
    let pressOnControl = false;
    const move = (event: PointerEvent) => {
      const point = effectPoint(host, event), rect = effectBounds(host);
      if (!point.inside) { pointerRef.current.active = false; pointerRef.current.pressed = false; return; }
      if (event.type === 'pointerdown') pressOnControl = event.target instanceof Element && event.target.closest(PAGE_CONTROLS) !== null;
      else if (event.type === 'pointerup') pressOnControl = false;
      pointerRef.current = {
        x: point.x - rect.width / 2,
        y: rect.height / 2 - point.y,
        active: true,
        moved: true,
        pressed: pressOnControl ? false : event.pointerType === 'mouse' ? (event.buttons & 1) === 1 : event.type !== 'pointerup',
        pointerType: event.pointerType,
      };
    };
    const leave = () => { pointerRef.current.active = false; };
    const stopResize = observeEffectSize(host, measure);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', move, { passive: true });
    window.addEventListener('pointerup', move, { passive: true });
    window.addEventListener('blur', leave);
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      if (!host) document.body.classList.remove('scene-body-active', 'scene-nature-active');
      stopResize();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', move);
      window.removeEventListener('pointerup', move);
      window.removeEventListener('blur', leave);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, [host]);

  if (typeof document === 'undefined' || !size.width || !size.height) return null;
  const dark = resolvedTheme === 'dark';
  const autumn = effect.bodyEffect === 'leaves';
  const background = autumn
    ? dark ? 'linear-gradient(160deg, #25343d, #403d2f 68%, #304339)' : 'linear-gradient(160deg, #e3edf0, #ebdfbd 68%, #d7e1c5)'
    : dark ? 'linear-gradient(160deg, #253b4e, #414054 60%, #29483d)' : 'linear-gradient(160deg, #e1edf2, #f1e4ed 60%, #dcebdd)';

  return createPortal(
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background }}>
      {!autumn && <LandscapeBackdrop width={size.width} height={size.height} params={tuning?.kind === 'sakura' ? tuning.params : DEFAULT_SAKURA} />}
      <EffectCanvas effect={effect} width={size.width} height={size.height} pointerRef={pointerRef} tuning={tuning} />
    </div>,
    host ?? document.body,
  );
}
