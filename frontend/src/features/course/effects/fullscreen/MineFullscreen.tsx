'use client';
import { useMemo } from 'react';
import { MineEffect, createMineParams, MINE_CAMERA_FOV, mineCameraDistance } from '../MineEffect';
import { FullscreenCanvas } from './FullscreenCanvas';
import type { FullscreenEffectProps } from './types';

export function MineFullscreen({ width, height, pointerRef, tuning }: FullscreenEffectProps) {
  const fallback = useMemo(() => createMineParams(), []);
  const distance = mineCameraDistance(height);
  return <FullscreenCanvas perspective shadows camera={{ fov: MINE_CAMERA_FOV, position: [0, 0, distance], near: 1, far: distance * 6 }}>
    <MineEffect width={width} height={height} pointerRef={pointerRef} params={tuning?.kind === 'mine' ? tuning.params : fallback} cameraDistance={distance} />
  </FullscreenCanvas>;
}
