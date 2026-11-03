'use client';

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GroupEffectDefinition } from './groupEffects.config';
import type { EffectTuningState } from './tuning/types';
import { CardEffect } from './CardEffect';
import { useFullscreenPointer } from './fullscreen/useFullscreenPointer';
import { PageEffectHost, useEffectHost } from './EffectHost';

/** Below Full HD, focus enlarges the card composition, never substitutes its body counterpart. */
type Props = {
  effect: GroupEffectDefinition; tuning: EffectTuningState | null;
};
export function ExpandedCardEffect(props: Props) {
  return <PageEffectHost><ExpandedCardContent {...props} /></PageEffectHost>;
}

function ExpandedCardContent({ effect, tuning }: Props) {
  const targetHost = useEffectHost();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const getHost = useCallback(() => host, [host]);
  const getBounds = useCallback(() => host?.getBoundingClientRect() ?? null, [host]);
  const pointerRef = useFullscreenPointer(getBounds);
  if (typeof document === 'undefined') return null;
  return createPortal(<div ref={setHost} data-course-expanded-card="" aria-hidden={effect.sceneId === 'gems' || effect.sceneId === 'week-book' ? undefined : true}
    style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', background: 'var(--background)' }}>
    {host && <CardEffect effect={effect} tuning={tuning} getHost={getHost} pointerRef={pointerRef} />}
  </div>, targetHost ?? document.body);
}
