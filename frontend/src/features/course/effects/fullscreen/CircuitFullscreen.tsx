'use client';
import { useMemo } from 'react';
import { CircuitSparkEffect, createCircuitParams } from '../uniqueEffects';
import { FullscreenCanvas } from './FullscreenCanvas';
import type { FullscreenEffectProps } from './types';

export function CircuitFullscreen({ effect, width, height, tuning }: FullscreenEffectProps) {
  const fallback = useMemo(() => createCircuitParams(), []);
  return <FullscreenCanvas><CircuitSparkEffect width={width} height={height} pulseColor={effect.accent} params={tuning?.kind === 'circuit' ? tuning.params : fallback} /></FullscreenCanvas>;
}
