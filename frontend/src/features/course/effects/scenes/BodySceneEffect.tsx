'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PointerState } from '../engine';
import { pointerStateFromEvent } from '../pointerState';
import { SceneEffect } from './SceneEffect';
import { createSceneParams, type SceneDef, type SceneParams } from './types';
import { PageEffectHost, useEffectHost, effectBounds, effectPoint, observeEffectSize } from '../EffectHost';

export const PAGE_CONTROLS = 'a, button, input, select, textarea, label, summary, .dg, [data-effect-debug], [role="button"], [role="radio"], [role="tab"], [role="switch"], [role="menuitem"]';

/**
 * A fixed scene in the available page area beneath the app header. Pointer coordinates follow that area's bounds;
 * page controls are ignored and the course content becomes translucent (`scene-body-active`).
 */
type Props = { scene: SceneDef; palette?: number; params?: SceneParams; contentVisible?: boolean };
export function BodySceneEffect(props: Props) {
  return <PageEffectHost><BodySceneCanvas {...props} /></PageEffectHost>;
}

function BodySceneCanvas({ scene, palette = 0, params, contentVisible = true }: Props) {
  const host = useEffectHost();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const pointerRef = useRef<PointerState>({ x: 0, y: 0, active: false, moved: false });
  const own = useMemo(() => params ?? createSceneParams(scene.defaultParams), [params, scene]);

  useEffect(() => {
    document.body.classList.add('scene-body-active', `scene-${scene.id}-active`);
    if (scene.id === 'genome-garden') document.body.classList.add('family-garden-active', 'genome-garden-active');
    const measure = () => { const { width, height } = effectBounds(host); setSize({ width, height }); };
    const stopMeasuring = observeEffectSize(host, measure);
    // A press that begins on a button, link or control is the page's own business, not a click on the scene — the
    // whole press is ignored until the button comes up, or the drag that follows would count as one.
    let pressOnControl = false;
    const move = (event: PointerEvent) => {
      if (event.type === 'pointerdown') {
        pressOnControl = event.target instanceof Element && event.target.closest(PAGE_CONTROLS) !== null;
      } else if (event.type === 'pointerup') {
        pressOnControl = false;
      }
      const previous = pointerRef.current;
      if (!effectPoint(host, event).inside) {
        if (event.type === 'pointerdown') pressOnControl = true;
        leave();
        return;
      }
      const next = pointerStateFromEvent(event, effectBounds(host), previous);
      if (pressOnControl) { next.pressed = false; next.press = previous.press; next.pressHistory = previous.pressHistory; }
      pointerRef.current = next;
    };
    const leave = () => {
      pointerRef.current = { ...pointerRef.current, active: false, pressed: false };
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', move, { passive: true });
    window.addEventListener('pointerup', move, { passive: true });
    window.addEventListener('pointercancel', leave, { passive: true });
    window.addEventListener('blur', leave);
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      document.body.classList.remove('scene-body-active', `scene-${scene.id}-active`);
      if (scene.id === 'genome-garden') document.body.classList.remove('family-garden-active', 'genome-garden-active');
      stopMeasuring();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', move);
      window.removeEventListener('pointerup', move);
      window.removeEventListener('pointercancel', leave);
      window.removeEventListener('blur', leave);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, [scene.id, host]);

  if (typeof document === 'undefined' || size.width === 0) return null;
  return createPortal(
    <div aria-hidden={scene.id === 'gems' || scene.id === 'week-book' ? undefined : true} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: '#10141a' }}>
      <SceneEffect scene={scene} palette={palette} width={size.width} height={size.height} pointerRef={pointerRef} params={own} contentVisible={scene.id.startsWith('late-') || scene.id === 'cloud-carnival' || scene.id === 'voxel-led-cube' && own.leisurePinball === 2 || scene.id === 'zero-gravity-drop' && own.zgLayout === 1 ? contentVisible : undefined} body />
    </div>,
    host ?? document.body,
  );
}
