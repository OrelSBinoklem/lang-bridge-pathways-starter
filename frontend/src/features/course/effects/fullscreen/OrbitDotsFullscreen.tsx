'use client';
import { useMemo } from 'react';
import { OrbitDotsEffect, createOrbitDotsParams } from '../uniqueEffects';
import { FullscreenCanvas } from './FullscreenCanvas';
import type { FullscreenEffectProps } from './types';

export function OrbitDotsFullscreen({ effect, width, height, tuning }: FullscreenEffectProps) {
  const fallback = useMemo(() => createOrbitDotsParams(), []);
  return <FullscreenCanvas><OrbitDotsEffect width={width} height={height} color={effect.accent} params={tuning?.kind === 'orbit-dots' ? tuning.params : fallback} /></FullscreenCanvas>;
}
