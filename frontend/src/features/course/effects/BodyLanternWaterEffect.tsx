'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Canvas } from '@react-three/fiber';
import type { PointerState } from './engine';
import { LanternWaterEffect, createLanternWaterParams, type LanternWaterTuningParams } from './LanternWaterEffect';
import { PAGE_CONTROLS } from './scenes/BodySceneEffect';
import { useEffectHost, effectBounds, effectPoint, observeEffectSize } from './EffectHost';

/**
 * The lanterns on the night pond over the whole page (group 1782's full-page variant): the same 3D scene as the card
 * version (LanternWaterEffect), on a fixed canvas behind the page that follows the cursor anywhere in the window. A
 * click that is not on a page control sends a ripple across the water. The card itself keeps only its tint
 * (ThemedGroupOverlay skips the card version when this one is on).
 */
export function BodyLanternWaterEffect({ params }: { params?: LanternWaterTuningParams }) {
  const host = useEffectHost();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const pointerRef = useRef<PointerState>({ x: 0, y: 0, active: false, moved: false });
  const [fallback] = useState(() => createLanternWaterParams(true));

  useEffect(() => {
    if (!host) document.body.classList.add('scene-body-active', 'scene-lantern-water-active');
    const measure = () => { const { width, height } = effectBounds(host); setSize({ width, height }); };
    const stopResize = observeEffectSize(host, measure);
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
    const leave = () => {
      pointerRef.current = { ...pointerRef.current, active: false, pressed: false };
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', move, { passive: true });
    window.addEventListener('pointerup', move, { passive: true });
    window.addEventListener('blur', leave);
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      if (!host) document.body.classList.remove('scene-body-active', 'scene-lantern-water-active');
      stopResize();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', move);
      window.removeEventListener('pointerup', move);
      window.removeEventListener('blur', leave);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, [host]);

  if (typeof document === 'undefined' || size.width === 0) return null;
  return createPortal(
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, #05081c, #101a40 70%, #1b2a55)' }}>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', stencil: true }}
        camera={{ fov: 45, position: [0, 4, 26], near: 0.5, far: 800 }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <LanternWaterEffect width={size.width} height={size.height} pointerRef={pointerRef} params={params ?? fallback} />
      </Canvas>
    </div>,
    host ?? document.body,
  );
}
