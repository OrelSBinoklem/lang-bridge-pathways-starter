'use client';
import { ImageRevealEffect } from '../ImageRevealEffect';
import type { FullscreenEffectProps } from './types';

export function ImageRevealFullscreen({ effect, width, height, pointerRef }: FullscreenEffectProps) {
  return effect.imageSrc ? <ImageRevealEffect width={width} height={height} pointerRef={pointerRef}
    imageSrc={effect.imageSrc} focus={effect.imageFocus} size={effect.imageSize} /> : null;
}
