import { getGroupEffect, type GroupEffectDefinition } from './groupEffects.config';
import type { EffectTuningState } from './tuning/types';

/** Restore the existing dedicated card engines, not a contained/shrunken BodyNatureEffect.
 * Stable public variant IDs still select their untouched large counterparts on the page background. */
export function natureCardComposition(effect: GroupEffectDefinition, tuning: EffectTuningState | null) {
  const body = effect.bodyEffect;
  if (body !== 'sakura-card' && body !== 'sakura' && body !== 'leaves') return null;
  const card = getGroupEffect({ categoryId: 1778, title: null, variantId: body === 'leaves' ? 'leaves' : 'sakura' });
  if (!card) return null;
  let cardTuning = tuning;
  if (body === 'leaves' && tuning?.kind === 'ambient' && effect.ambient && card.ambient) {
    const p = tuning.params, full = effect.ambient, small = card.ambient;
    const range = (value: [number, number], before: [number, number], after: [number, number]): [number, number] =>
      [value[0] * after[0] / before[0], value[1] * after[1] / before[1]];
    cardTuning = { ...tuning, params: { ...p,
      count: Math.round(p.count * small.count / full.count),
      sizeRange: range(p.sizeRange, full.sizeRange, small.sizeRange),
      fallSpeedRange: range(p.fallSpeedRange, full.fallSpeedRange, small.fallSpeedRange),
      swayAmplitude: (p.swayAmplitude ?? full.swayAmplitude ?? 20) * (small.swayAmplitude ?? 20) / (full.swayAmplitude ?? 20),
      cursorRepelRadius: (p.cursorRepelRadius ?? 0) * (small.cursorRepelRadius ?? 0) / (full.cursorRepelRadius || 1),
      cursorRepelForce: (p.cursorRepelForce ?? 0) * (small.cursorRepelForce ?? 0) / (full.cursorRepelForce || 1),
    } };
  } else if (tuning?.kind === 'sakura') {
    // Transfer live slider changes relative to each composition's own original defaults; never mutate the body.
    const fullCount = body === 'sakura' ? 180 : 120;
    const fullSize = body === 'sakura' ? 9 : 17;
    cardTuning = { ...tuning, fullPage: false, params: { ...tuning.params,
      petalCount: Math.round(tuning.params.petalCount * 60 / fullCount),
      petalSize: tuning.params.petalSize * 7 / fullSize,
      blossomSize: tuning.params.blossomSize / (body === 'sakura' ? 1.1 : 1),
    } };
  }
  return { effect: card, tuning: cardTuning };
}
