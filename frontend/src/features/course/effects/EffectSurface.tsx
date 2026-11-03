'use client';
import dynamic from 'next/dynamic';
import type { MutableRefObject } from 'react';
import type { PointerState } from './engine';
import type { GroupEffectDefinition } from './groupEffects.config';
import type { EffectTuningState } from './tuning/types';
import { SunWaterEffect } from './SunWaterEffect';
import { WaterRippleEffect } from './WaterRippleEffect';
import { VideoLoopEffect } from './VideoLoopEffect';
import { ImageRevealEffect } from './ImageRevealEffect';
import { ChickHatchStages } from './ChickHatchStages';
import { EmbroideryEffect } from './culture/EmbroideryEffect';
import { AmberEffect } from './culture/AmberEffect';
import { SongFireEffect } from './culture/SongFireEffect';
import { SceneEffect } from './scenes/SceneEffect';
import { getScene } from './scenes/registry';
import { createSceneParams } from './scenes/types';
import { EffectBodyFrame } from './EffectBodyFrame';
import { natureCardComposition } from './natureCardComposition';
const EffectCanvas = dynamic(() => import('./EffectCanvas').then(m => m.EffectCanvas), { ssr: false });

/** Route dedicated card compositions separately from their page-background counterparts. */
export function EffectSurface({ effect, width, height, pointerRef, tuning, getHost, preview = false, bodyView = false, cameraControls = true }: {
  effect: GroupEffectDefinition; width: number; height: number; pointerRef: MutableRefObject<PointerState>;
  tuning: EffectTuningState | null; getHost: () => HTMLElement | null; preview?: boolean; bodyView?: boolean; cameraControls?: boolean | 'below-toolbar';
}) {
  const props = { width, height, pointerRef };
  if (bodyView && typeof effect.bodyEffect === 'string') return <EffectBodyFrame effect={effect} width={width} height={height} tuning={tuning} />;
  const natureCard = natureCardComposition(effect, tuning);
  if (natureCard) return <EffectCanvas {...props} effect={natureCard.effect} tuning={natureCard.tuning} preview={preview} framed />;
  const sceneId = effect.sceneId ?? (typeof effect.bodyEffect === 'object' ? effect.bodyEffect.scene : undefined);
  // Other body-only engines retain their contained renderer; nature above has genuine legacy card components.
  // Explicit card-only variants have bodyEffect unset and retain their renderer.
  if (typeof effect.bodyEffect === 'string') return <EffectBodyFrame effect={effect} width={width} height={height} tuning={tuning} />;
  switch (effect.kind) {
    case 'sun-water': return <SunWaterEffect {...props} params={tuning?.kind === 'sun-water' ? tuning.params : undefined} />;
    case 'water': return <WaterRippleEffect {...props} />;
    case 'video': return effect.videoSrc ? <VideoLoopEffect src={effect.videoSrc} /> : null;
    case 'image-reveal': return effect.imageSrc ? <ImageRevealEffect {...props} imageSrc={effect.imageSrc} focus={effect.imageFocus} size={effect.imageSize} /> : null;
    case 'compass': return <span data-intro-egg="" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}><ChickHatchStages getHost={getHost} /></span>;
    case 'embroidery': return tuning?.kind === 'embroidery' ? <EmbroideryEffect {...props} params={tuning.params} /> : null;
    case 'amber-words': return tuning?.kind === 'amber-words' ? <AmberEffect {...props} params={tuning.params} /> : null;
    case 'song-fire': return tuning?.kind === 'song-fire' ? <SongFireEffect {...props} params={tuning.params} /> : null;
    case 'scene': {
      const scene = sceneId ? getScene(sceneId) : null;
      return scene ? <SceneEffect {...props} scene={scene} body={bodyView && scene.id.startsWith('late-')} palette={effect.scenePalette} params={tuning?.kind === 'scene' ? tuning.params : createSceneParams({ ...scene.defaultParams, ...effect.sceneParams })} preview={preview} cameraControls={cameraControls} /> : <span role="status">Сцена не найдена: {sceneId}</span>;
    }
    // Latvia already had its own right-aligned card composition: keep its original camera and position.
    default: return <EffectCanvas effect={effect} {...props} tuning={tuning} preview={preview} framed={bodyView || effect.kind !== 'latvia-cube'} />;
  }
}
