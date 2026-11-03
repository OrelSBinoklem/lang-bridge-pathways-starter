'use client';
import { ContainedEffectHost } from './EffectHost';
import { BodyEffectContent } from './BodyEffectContent';
import type { GroupEffectDefinition } from './groupEffects.config';
import type { EffectTuningState } from './tuning/types';

/** Compatibility name: now an in-document component, never an iframe or another Next page. */
export function EffectBodyFrame({ effect, tuning }: { effect: GroupEffectDefinition; width: number; height: number; tuning?: EffectTuningState | null }) {
  return <ContainedEffectHost><BodyEffectContent effect={effect} tuning={tuning} /></ContainedEffectHost>;
}
