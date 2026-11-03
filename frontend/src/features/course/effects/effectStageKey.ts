import categoryIcons from '../category-icons.json';
import { getGroupEffect, getGroupEffectVariants, getHiddenGroupEffectVariants, type GroupEffectDefinition } from './groupEffects.config';

export function effectStageKey(effect: GroupEffectDefinition): string | null {
  for (const id of Object.keys(categoryIcons).map(Number)) {
    if (getGroupEffect({ categoryId: id, title: null }) === effect) return `${id}:default`;
    for (const variant of getGroupEffectVariants(id) ?? []) if (variant.effect === effect) return `${id}:${variant.id}`;
  }
  for (const { categoryId, variant } of getHiddenGroupEffectVariants()) if (variant.effect === effect) return `${categoryId}:${variant.id}`;
  return null;
}
export function resolveEffectStage(key: string): GroupEffectDefinition | null {
  const [id, variant] = key.split(':');
  if (!Object.hasOwn(categoryIcons, id) || !variant || key.split(':').length !== 2) return null;
  if (variant !== 'default' && !getGroupEffectVariants(Number(id))?.some(v => v.id === variant)
    && !getHiddenGroupEffectVariants().some(v => v.categoryId === Number(id) && v.variant.id === variant)) return null;
  return getGroupEffect({ categoryId: Number(id), title: null, variantId: variant === 'default' ? null : variant });
}
