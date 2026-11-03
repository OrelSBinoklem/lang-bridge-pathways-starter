'use client';
import { useMemo } from 'react';
import { useTheme } from 'next-themes';
import { LatviaCubeEffect } from '../../LatviaSouvenirCube';
import { createLatviaCubeParams } from '../tuning/types';
import { FullscreenCanvas } from './FullscreenCanvas';
import type { FullscreenEffectProps } from './types';

export function LatviaCubeFullscreen({ width, height, tuning }: FullscreenEffectProps) {
  const { resolvedTheme } = useTheme();
  const defaults = useMemo(() => createLatviaCubeParams(), []);
  const original = tuning?.kind === 'latvia-cube' ? tuning.params : defaults;
  const params = { ...original, positionX: original.positionX - defaults.positionX };
  const distance = Math.max(4.7, (params.cubeScale * 1.2 + Math.abs(params.positionX)) / (Math.tan(13 * Math.PI / 180) * Math.min(1, width / height)));
  return <FullscreenCanvas perspective camera={{ fov: 26, position: [0, 0, distance], near: 0.1, far: Math.max(20, distance * 3) }}>
    <LatviaCubeEffect dark={resolvedTheme === 'dark'} params={params} />
  </FullscreenCanvas>;
}
