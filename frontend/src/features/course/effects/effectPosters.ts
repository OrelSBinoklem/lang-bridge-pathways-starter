import type { GroupEffectDefinition } from './groupEffects.config';
import { effectStageKey } from './effectStageKey';
import manifest from './effect-posters.json';

const posters = manifest as {
  stages: Record<string, { card: string; body: string }>;
  scenes: Record<string, string>;
  kinds: Record<string, string>;
  bodies: Record<string, string>;
};

/** No renderer, observers, storage or network capture: just a static asset URL. */
export function getEffectPoster(effect: GroupEffectDefinition, bodyView = false): string {
  const stage = effectStageKey(effect);
  if (stage && posters.stages[stage]) return posters.stages[stage][bodyView ? 'body' : 'card'];
  const body = effect.bodyEffect;
  if ((bodyView || effect.bodyOnly) && body) {
    const image = typeof body === 'string' ? posters.bodies[body] : posters.scenes[body.scene];
    if (image) return image;
  }
  return (effect.sceneId && posters.scenes[effect.sceneId])
    || effect.imageSrc
    || posters.kinds[effect.kind]
    || '/course/effects/sprite-swarm/poster.svg';
}
