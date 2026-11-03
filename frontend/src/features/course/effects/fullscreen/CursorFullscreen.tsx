'use client';
import { CursorParticles } from '../engine';
import { FullscreenCanvas } from './FullscreenCanvas';
import type { FullscreenEffectProps } from './types';

export function CursorFullscreen({ effect, pointerRef, tuning }: FullscreenEffectProps) {
  const config = tuning?.kind === 'cursor' ? tuning.params : effect.cursor;
  return <FullscreenCanvas>{config && <CursorParticles pointerRef={pointerRef} config={config} />}</FullscreenCanvas>;
}
