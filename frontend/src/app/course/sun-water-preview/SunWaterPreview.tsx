'use client';

import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { PointerState } from '@/features/course/effects/engine';
import { pointerStateFromEvent } from '@/features/course/effects/pointerState';
import { getGroupEffect } from '@/features/course/effects/groupEffects.config';
import { SunWaterEffect } from '@/features/course/effects/SunWaterEffect';
import { createTuningState } from '@/features/course/effects/tuning/types';
import { EffectTuningPanel } from '@/features/course/effects/tuning/EffectTuningPanel';

const noop = () => {};

/** One "Солнце и вода" card at the size given, with the cursor wired the way the group header wires it. */
export function SunWaterPreview({ width, height, overrides }: { width: number; height: number; overrides?: Record<string, number | string> }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<PointerState>({ x: 0, y: 0, active: false, moved: false });
  const effect = getGroupEffect({ categoryId: 1797, title: null, variantId: 'sun-water' });
  const tuning = useMemo(() => {
    const state = effect ? createTuningState(effect) : null;
    if (state?.kind === 'sun-water' && overrides) Object.assign(state.params, overrides);
    return state;
  }, [effect, overrides]);
  const feedPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerRef.current = pointerStateFromEvent(event, hostRef.current!.getBoundingClientRect(), pointerRef.current);
  };
  if (!effect) return null;
  return (
    <div style={{ minHeight: '100vh', background: '#0e1114', padding: 24 }}>
      <div id="course-effect-gui-anchor" style={{ position: 'fixed', top: 100, right: 12, zIndex: 9998, pointerEvents: 'none' }} />
      <div
        ref={hostRef}
        onPointerMove={feedPointer}
        onPointerDown={feedPointer}
        onPointerUp={feedPointer}
        onPointerCancel={feedPointer}
        onPointerLeave={() => {
          pointerRef.current.active = false;
        }}
        style={{ position: 'relative', width, height, overflow: 'hidden', borderRadius: 14 }}
      >
        <div style={{ position: 'absolute', inset: 0, background: effect.background }} />
        <SunWaterEffect width={width} height={height} pointerRef={pointerRef} params={tuning?.kind === 'sun-water' ? tuning.params : undefined} />
      </div>
      {tuning && <EffectTuningPanel tuning={tuning} onChange={noop} />}
    </div>
  );
}
