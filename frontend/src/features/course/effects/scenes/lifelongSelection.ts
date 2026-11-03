import { LIFELONG_CATALOG } from './cinematic/catalog';
import { createSceneParams, type SceneParams } from './types';

type Selection = Pick<SceneParams, 'lifeStory'>;
const listeners = new WeakMap<Selection, Set<() => void>>();
export const validLifeStory = (index: number) => Number.isInteger(index) && index >= 0 && index < LIFELONG_CATALOG.length;

export function selectLifeStory(params: Selection, index: number) {
  if (!validLifeStory(index)) return false;
  if (params.lifeStory !== index) {
    params.lifeStory = index;
    listeners.get(params)?.forEach(listener => listener());
  }
  return true;
}

/** The chosen index lives in shared activation params, not in a renderer's resize-dependent state. */
export function ensureLifeStory(params: Selection, random: () => number = Math.random) {
  if (!validLifeStory(params.lifeStory)) {
    const sample = random();
    const index = Math.min(LIFELONG_CATALOG.length - 1, Math.max(0, Math.floor((Number.isFinite(sample) ? sample : 0) * LIFELONG_CATALOG.length)));
    selectLifeStory(params, index);
  }
  return params.lifeStory;
}

export function createActivatedLifeParams(overrides: Partial<SceneParams> = {}, random: () => number = Math.random) {
  const params = createSceneParams(overrides);
  ensureLifeStory(params, random);
  return params;
}

export function subscribeLifeStory(params: Selection, listener: () => void) {
  const current = listeners.get(params) ?? new Set(); current.add(listener); listeners.set(params, current);
  return () => { current.delete(listener); };
}
