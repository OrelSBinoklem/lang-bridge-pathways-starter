'use client';

import type { GroupEffectDefinition } from './groupEffects.config';
import type { EffectTuningState } from './tuning/types';
import { BodySceneEffect } from './scenes/BodySceneEffect';
import { getScene } from './scenes/registry';
import { BodySurfaceEffect } from './BodySurfaceEffect';
import { BodyEffectContent } from './BodyEffectContent';
import { ExpandedCardEffect } from './ExpandedCardEffect';

/** Full-window composition is independent of the card; no preview-page navigation. */
export function FullscreenEffect({ effect, tuning, focused, uk, onClose, cardComposition = false }: {
  effect: GroupEffectDefinition; tuning: EffectTuningState | null; focused: boolean; uk: boolean; onClose: () => void; cardComposition?: boolean;
}) {
  // Pottery carries its own interactive toolbar; a read-only card host cannot expose it.
  if (focused && cardComposition && effect.bodyEffect !== 'pottery') return <ExpandedCardEffect effect={effect} tuning={tuning} />;
  const body = effect.bodyEffect;
  const sceneId = typeof body === 'object' ? body.scene : undefined;
  const scene = sceneId ? getScene(sceneId) : null;
  if (scene) return <BodySceneEffect scene={scene} contentVisible={!focused} palette={typeof body === 'object' ? body.palette : effect.scenePalette}
    params={tuning?.kind === 'scene' && (!tuning.sceneId || tuning.sceneId === sceneId) ? tuning.params : undefined} />;
  if (body) return <BodyEffectContent effect={effect} tuning={tuning} focused={focused} uk={uk} onClose={onClose} />;
  return <BodySurfaceEffect effect={effect} tuning={tuning} contentVisible={!focused} />;
}
