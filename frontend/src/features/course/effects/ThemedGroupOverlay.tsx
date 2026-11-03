'use client';

import { useMemo, useReducer, useSyncExternalStore, type MutableRefObject } from 'react';
import type { GroupEffectDefinition } from './groupEffects.config';
import type { PointerState } from './engine';
import { createTuningState } from './tuning/types';
import { EffectTuningPanel } from './tuning/EffectTuningPanel';
import { CardEffect } from './CardEffect';
import { FullscreenEffect } from './FullscreenEffect';
import { EffectDebugContext } from './EffectDebugContext';
import { CourseEffectDebug } from './CourseEffectDebug';
import { isCameraAdmin, onCameraAdminChange } from './scenes/orbitControl';

/** Automatic placement, with an admin-only simultaneous card/background comparison. */
export function ThemedGroupOverlay({ effect, getHost, pointerRef, forceCard = false, comparison = false, focused = false, expandCard = false, uk = false, onClose = () => {} }: {
  effect: GroupEffectDefinition;
  getHost: () => HTMLElement | null;
  pointerRef: MutableRefObject<PointerState>;
  forceCard?: boolean;
  comparison?: boolean;
  focused?: boolean;
  expandCard?: boolean;
  uk?: boolean;
  onClose?: () => void;
}) {
  // The compact dragon has a deliberately cheaper profile. Its settings must not label/control the large pair.
  const tuneBurnerBackground = !forceCard && typeof effect.bodyEffect === 'object' && effect.bodyEffect.scene === 'burner-pair';
  const tuning = useMemo(() => createTuningState(tuneBurnerBackground
    ? { ...effect, kind: 'scene', sceneId: 'burner-pair', sceneParams: undefined }
    : effect), [effect, tuneBurnerBackground]);
  const [, bumpTuning] = useReducer((n: number) => n + 1, 0);
  const admin = useSyncExternalStore(onCameraAdminChange, isCameraAdmin, () => false);
  forceCard = forceCard || !!effect.cardOnly;
  const dual = admin && comparison && !focused && !effect.cardOnly;
  const rendererOwnsPanel = typeof effect.bodyEffect === 'string' && ['grid', 'fluid', 'liquid-glass', 'liquid-drops'].includes(effect.bodyEffect);
  return <EffectDebugContext.Provider value={admin}>
    {admin && <CourseEffectDebug effect={effect} card={forceCard} getHost={getHost} tunable={!!tuning || rendererOwnsPanel} />}
    <EffectDebugContext.Provider value={admin && !(dual && forceCard)}>
      {forceCard ? <CardEffect effect={effect} tuning={tuning} pointerRef={pointerRef} getHost={getHost} />
        : <FullscreenEffect effect={effect} tuning={tuning} focused={focused} cardComposition={expandCard} uk={uk} onClose={onClose} />}
    </EffectDebugContext.Provider>
    {dual && <EffectDebugContext.Provider value={admin && forceCard}>
      {forceCard ? <FullscreenEffect effect={effect} tuning={tuning} focused={focused} uk={uk} onClose={onClose} />
        : <CardEffect effect={effect} tuning={tuning} pointerRef={pointerRef} getHost={getHost} />}
    </EffectDebugContext.Provider>}
    {tuning && !rendererOwnsPanel && <EffectTuningPanel tuning={tuning} onChange={bumpTuning} />}
  </EffectDebugContext.Provider>;
}
