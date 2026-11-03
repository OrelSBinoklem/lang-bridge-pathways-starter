import { createLiquidDropsParams, LIQUID_DROPS_SCENE_LABELS, type LiquidDropsParams, type LiquidDropsScene } from './params';

/** Pick once per group activation, not every time its renderer changes size or placement. */
export function createActivatedDropsParams(random: () => number = Math.random): LiquidDropsParams {
  const scenes = (Object.keys(LIQUID_DROPS_SCENE_LABELS) as LiquidDropsScene[]).filter(scene => scene !== 'custom');
  const index = Math.min(scenes.length - 1, Math.max(0, Math.floor(random() * scenes.length)));
  return createLiquidDropsParams({ scene: scenes[index] });
}

const listeners = new WeakMap<LiquidDropsParams, Set<() => void>>();

export function subscribeDropsScene(params: LiquidDropsParams, listener: () => void) {
  const list = listeners.get(params) ?? new Set(); list.add(listener); listeners.set(params, list);
  return () => { list.delete(listener); };
}

/** The public picker and the optional debug panel share the renderer's live params. */
export function notifyDropsScene(params: LiquidDropsParams) {
  listeners.get(params)?.forEach(listener => listener());
}

export function selectDropsScene(params: LiquidDropsParams, scene: string) {
  if (!Object.hasOwn(LIQUID_DROPS_SCENE_LABELS, scene)) return false;
  params.scene = scene as LiquidDropsParams['scene']; notifyDropsScene(params); return true;
}

export function setDropsImage(params: LiquidDropsParams, url: string) {
  const previous = params.customImage;
  params.customImage = url; selectDropsScene(params, 'custom');
  if (previous !== url && previous.startsWith('blob:')) URL.revokeObjectURL(previous);
}
