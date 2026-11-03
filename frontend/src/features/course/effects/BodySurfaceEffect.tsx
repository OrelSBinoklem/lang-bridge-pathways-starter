'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GroupEffectDefinition } from './groupEffects.config';
import type { EffectTuningState } from './tuning/types';
import { FullscreenSurface } from './fullscreen/FullscreenSurface';
import { useFullscreenPointer } from './fullscreen/useFullscreenPointer';
import { PageEffectHost, useEffectHost } from './EffectHost';

/** Full-page counterpart for video, water, embroidery and other previously card-only effects. */
type Props = { effect: GroupEffectDefinition; tuning: EffectTuningState | null; contentVisible?: boolean };
export function BodySurfaceEffect(props: Props) {
  return <PageEffectHost><BodySurfaceContent {...props} /></PageEffectHost>;
}

function BodySurfaceContent({ effect, tuning, contentVisible = false }: Props) {
  const targetHost = useEffectHost();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const getBounds = useCallback(() => host?.getBoundingClientRect() ?? null, [host]);
  const pointerRef = useFullscreenPointer(getBounds);
  useEffect(() => {
    if (!host) return;
    const measure = () => setSize({ width: host.clientWidth, height: host.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [host]);
  if (typeof document === 'undefined') return null;
  return createPortal(<div ref={setHost} aria-hidden="true" data-course-body-effect={effect.kind}
    style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'var(--background)' }}>
    <div style={{ position: 'absolute', inset: 0, background: effect.background }} />
    {size.width > 0 && size.height > 0 && <FullscreenSurface effect={effect} width={size.width} height={size.height} pointerRef={pointerRef} tuning={tuning} contentVisible={contentVisible} />}
  </div>, targetHost ?? document.body);
}
