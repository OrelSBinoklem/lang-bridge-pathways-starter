import type { LazySceneDef, LoadedSceneDef } from './types';

export function lazyScene(meta: Omit<LazySceneDef, 'kind' | 'load' | 'sourceKind'> & { kind: LoadedSceneDef['kind'] }, loader: () => Promise<LoadedSceneDef>): LazySceneDef {
  let pending: Promise<LoadedSceneDef> | undefined;
  return { ...meta, kind: 'lazy', sourceKind: meta.kind, load() {
    // Share download/parse across card + background, but allow retry after a failed network request.
    return pending ??= loader().then(scene => {
      if (!scene || scene.id !== meta.id || scene.kind !== meta.kind) throw new Error(`Invalid scene module: ${meta.id}`);
      return scene;
    }).catch(error => { pending = undefined; throw error; });
  } };
}
