'use client';
import { useMemo } from 'react';
import { LanternWaterEffect, createLanternWaterParams, type LanternWaterView } from '../LanternWaterEffect';
import { FullscreenCanvas } from './FullscreenCanvas';
import type { FullscreenEffectProps } from './types';

const VIEW: LanternWaterView = { fov: 45, distance: 26, heightRatio: .36, targetRatio: .25 };

export function LanternWaterFullscreen({ width, height, pointerRef, tuning }: FullscreenEffectProps) {
  const fallback = useMemo(() => createLanternWaterParams(), []);
  const original = tuning?.kind === 'lantern-water' ? tuning.params : fallback;
  const params = { ...original, size: original.size * Math.min(1, width / height) };
  return <FullscreenCanvas perspective camera={{ fov: VIEW.fov, position: [0, 4, VIEW.distance], near: 0.5, far: 800 }}>
    <LanternWaterEffect width={width} height={height} pointerRef={pointerRef} params={params} view={VIEW} />
  </FullscreenCanvas>;
}
