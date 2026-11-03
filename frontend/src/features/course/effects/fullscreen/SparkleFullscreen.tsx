'use client';
import { useMemo } from 'react';
import { SparkleFieldEffect, createSparkleParams } from '../uniqueEffects';
import { FullscreenCanvas } from './FullscreenCanvas';
import type { FullscreenEffectProps } from './types';

export function SparkleFullscreen({ effect, width, height, tuning }: FullscreenEffectProps) {
  const fallback = useMemo(() => createSparkleParams(), []);
  return <FullscreenCanvas><SparkleFieldEffect width={width} height={height} color={effect.accent} params={tuning?.kind === 'sparkle' ? tuning.params : fallback} /></FullscreenCanvas>;
}
