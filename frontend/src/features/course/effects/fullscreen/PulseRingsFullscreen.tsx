'use client';
import { useMemo } from 'react';
import { PulseRingsEffect, createPulseRingsParams } from '../uniqueEffects';
import { FullscreenCanvas } from './FullscreenCanvas';
import type { FullscreenEffectProps } from './types';

export function PulseRingsFullscreen({ effect, width, height, tuning }: FullscreenEffectProps) {
  const fallback = useMemo(() => createPulseRingsParams(), []);
  return <FullscreenCanvas><PulseRingsEffect width={width} height={height} color={effect.accent} params={tuning?.kind === 'pulse-rings' ? tuning.params : fallback} /></FullscreenCanvas>;
}
