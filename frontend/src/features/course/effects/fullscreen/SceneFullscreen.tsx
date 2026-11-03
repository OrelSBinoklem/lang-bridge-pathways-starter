'use client';
import { useEffect, useMemo } from 'react';
import { SceneEffect } from '../scenes/SceneEffect';
import { getScene } from '../scenes/registry';
import { createSceneParams } from '../scenes/types';
import type { FullscreenEffectProps } from './types';

export function SceneFullscreen({ effect, width, height, pointerRef, tuning, contentVisible, region }: FullscreenEffectProps) {
  const scene = effect.sceneId ? getScene(effect.sceneId) : null;
  useEffect(() => {
    if (!scene) return;
    const classes = ['scene-body-active', `scene-${scene.id}-active`, ...(scene.id === 'genome-garden' ? ['family-garden-active', 'genome-garden-active'] : [])];
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, [scene]);
  const fallback = useMemo(() => createSceneParams({ ...scene?.defaultParams, ...effect.sceneParams }), [scene, effect.sceneParams]);
  return scene ? <div style={{ position: 'absolute', inset: 0, background: '#10141a' }}>
    <SceneEffect scene={scene} width={width} height={height} pointerRef={pointerRef} palette={effect.scenePalette} params={tuning?.kind === 'scene' ? tuning.params : fallback} body region={region} cameraControls={!contentVisible} />
  </div>
    : <span role="status">Сцена не найдена: {effect.sceneId}</span>;
}
