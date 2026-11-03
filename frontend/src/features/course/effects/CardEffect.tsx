'use client';

import { useEffect, useState, type MutableRefObject } from 'react';
import type { PointerState } from './engine';
import type { GroupEffectDefinition } from './groupEffects.config';
import type { EffectTuningState } from './tuning/types';
import { EffectSurface } from './EffectSurface';
import { natureCardComposition } from './natureCardComposition';

/** Card composition has its own entry point for per-effect size/camera adjustments. */
export function CardEffect({ effect, tuning, pointerRef, getHost }: {
  effect: GroupEffectDefinition; tuning: EffectTuningState | null;
  pointerRef: MutableRefObject<PointerState>; getHost: () => HTMLElement | null;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const appearance = natureCardComposition(effect, null)?.effect ?? effect;
  useEffect(() => {
    const host = getHost();
    if (!host) return;
    const update = () => setSize({ width: host.clientWidth, height: host.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, [getHost]);
  return <div aria-hidden={effect.sceneId === 'gems' || effect.sceneId === 'week-book' ? undefined : true} data-course-effect-surface="" data-effect-view="card" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'auto', borderRadius: 'inherit', background: appearance.background }}>
    {size.width > 0 && size.height > 0 && <EffectSurface effect={effect} {...size} pointerRef={pointerRef} tuning={tuning} getHost={getHost} cameraControls={false} />}
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', boxShadow: `0 0 0 2px ${appearance.glow} inset` }} />
  </div>;
}
