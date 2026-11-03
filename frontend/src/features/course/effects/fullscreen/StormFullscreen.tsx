'use client';
import { useMemo } from 'react';
import { StormEffect, createStormParams } from '../presets';
import { FullscreenCanvas } from './FullscreenCanvas';
import type { FullscreenEffectProps } from './types';

export function StormFullscreen({ width, height, pointerRef, tuning }: FullscreenEffectProps) {
  const fallback = useMemo(() => createStormParams(), []);
  return <FullscreenCanvas><StormEffect width={width} height={height} pointerRef={pointerRef} params={tuning?.kind === 'storm' ? tuning.params : fallback} umbrellaScale={width >= 1024 ? 1.25 : 1} /></FullscreenCanvas>;
}
