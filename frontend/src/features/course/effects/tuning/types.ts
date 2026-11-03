import type { AmbientParticlesConfig, CursorParticlesConfig } from '../engine';
import { createStormParams, type StormTuningParams } from '../presets';
import { createMineParams, type MineTuningParams } from '../MineEffect';
import type { BodyGridTuningParams } from '../BodyGridEffect';
import type { FluidTuningParams } from '../FluidEffect';
import type { LiquidGlassParams } from '../BodyLiquidGlassEffect';
import type { LiquidDropsParams } from '../liquidDrops/params';
import { createActivatedDropsParams } from '../liquidDrops/sceneSelection';
import { createSakuraParams, type SakuraTuningParams } from '../SakuraEffect';
import { createLanternWaterParams, type LanternWaterTuningParams } from '../LanternWaterEffect';
import { createSunWaterParams, type SunWaterParams } from '../SunWaterEffect';
import {
  createAmberParams,
  createEmbroideryParams,
  createSongFireParams,
  type AmberParams,
  type EmbroideryParams,
  type SongFireParams,
} from '../culture/params';
import { createSceneParams, type SceneParams } from '../scenes/types';
import { getScene } from '../scenes/registry';
import { createActivatedLifeParams } from '../scenes/lifelongSelection';
import {
  createCircuitParams,
  createSparkleParams,
  createPulseRingsParams,
  createOrbitDotsParams,
  type CircuitTuningParams,
  type SparkleTuningParams,
  type PulseRingsTuningParams,
  type OrbitDotsTuningParams,
} from '../uniqueEffects';
import type { GroupEffectDefinition } from '../groupEffects.config';

export type LatviaPortalId = 'cat' | 'sprats' | 'amber' | 'monument';

export type LatviaPortalTuningParams = {
  depthScale: number;
  parallaxOpacity: number;
  roomBackdropOpacity: number;
  artworkBrightness: number;
};

export type LatviaCubeTuningParams = {
  cubeScale: number;
  imageZoom: number;
  parallaxOnly: boolean;
  rotationSpeed: number;
  frameThickness: number;
  portalSize: number;
  positionX: number;
  portals: Record<LatviaPortalId, LatviaPortalTuningParams>;
};

export function createLatviaCubeParams(): LatviaCubeTuningParams {
  return {
    cubeScale: 1.36,
    imageZoom: 1,
    parallaxOnly: false,
    rotationSpeed: 0.12,
    frameThickness: 0.047,
    portalSize: 1.473,
    positionX: 1.42,
    portals: {
      cat: { depthScale: 0.07, parallaxOpacity: 0.85, roomBackdropOpacity: 1, artworkBrightness: 2 },
      sprats: { depthScale: 0.5, parallaxOpacity: 0.85, roomBackdropOpacity: 1, artworkBrightness: 2 },
      amber: { depthScale: 0.2, parallaxOpacity: 0.85, roomBackdropOpacity: 1, artworkBrightness: 2 },
      monument: { depthScale: 0.07, parallaxOpacity: 1, roomBackdropOpacity: 1, artworkBrightness: 2 },
    },
  };
}

/** One entry per `EffectCanvas`-rendered kind — 'compass'/'water'/'video' render through a
 * different path in `ThemedGroupOverlay` and never reach this panel. */
export type EffectTuningState =
  | { kind: 'ambient'; params: AmbientParticlesConfig }
  | { kind: 'cursor'; params: CursorParticlesConfig }
  | { kind: 'storm'; params: StormTuningParams }
  | { kind: 'circuit'; params: CircuitTuningParams }
  | { kind: 'sparkle'; params: SparkleTuningParams }
  | { kind: 'pulse-rings'; params: PulseRingsTuningParams }
  | { kind: 'orbit-dots'; params: OrbitDotsTuningParams }
  | { kind: 'mine'; params: MineTuningParams }
  | { kind: 'latvia-cube'; params: LatviaCubeTuningParams }
  | { kind: 'body-grid'; params: BodyGridTuningParams }
  | { kind: 'fluid'; params: FluidTuningParams }
  | { kind: 'liquid-glass'; params: LiquidGlassParams }
  | { kind: 'liquid-drops'; params: LiquidDropsParams }
  | { kind: 'sakura'; params: SakuraTuningParams; fullPage: boolean }
  | { kind: 'lantern-water'; params: LanternWaterTuningParams }
  | { kind: 'sun-water'; params: SunWaterParams }
  | { kind: 'embroidery'; params: EmbroideryParams }
  | { kind: 'amber-words'; params: AmberParams }
  | { kind: 'song-fire'; params: SongFireParams }
  | { kind: 'scene'; params: SceneParams; sceneId?: string };

/**
 * Builds a fresh, per-instance tuning state for a group's effect — cloning `effect.ambient`/
 * `effect.cursor` rather than reusing the static config object from `groupEffects.config.ts`,
 * since that object is a module-level singleton: mutating it in place (which is exactly what the
 * GUI panel does — it writes straight into `params`) would leak across every group sharing the
 * same config reference in the same tab. Returns null for kinds with no tuning panel.
 */
export function createTuningState(effect: GroupEffectDefinition): EffectTuningState | null {
  if (effect.bodyEffect === 'liquid-drops') return { kind: 'liquid-drops', params: createActivatedDropsParams() };
  switch (effect.kind) {
    case 'ambient':
      return effect.ambient ? { kind: 'ambient', params: { ...effect.ambient } } : null;
    case 'cursor':
      return effect.cursor ? { kind: 'cursor', params: { ...effect.cursor } } : null;
    case 'storm':
      return { kind: 'storm', params: createStormParams() };
    case 'circuit':
      return { kind: 'circuit', params: createCircuitParams() };
    case 'sparkle':
      return { kind: 'sparkle', params: createSparkleParams() };
    case 'pulse-rings':
      return { kind: 'pulse-rings', params: createPulseRingsParams() };
    case 'orbit-dots':
      return { kind: 'orbit-dots', params: createOrbitDotsParams() };
    case 'mine':
      return { kind: 'mine', params: createMineParams() };
    case 'latvia-cube':
      return { kind: 'latvia-cube', params: createLatviaCubeParams() };
    case 'sakura':
      return {
        kind: 'sakura',
        params: {
          ...createSakuraParams(),
          ...(effect.bodyEffect === 'sakura' ? { petalCount: 180, petalSize: 9, blossomSize: 1.1 } : {}),
          ...(effect.bodyEffect === 'sakura-card' ? { petalCount: 120, petalSize: 17 } : {}),
        },
        fullPage: effect.bodyEffect === 'sakura',
      };
    case 'lantern-water':
      return { kind: 'lantern-water', params: createLanternWaterParams(effect.bodyEffect === 'lantern-water') };
    case 'sun-water':
      return { kind: 'sun-water', params: createSunWaterParams() };
    case 'embroidery':
      return { kind: 'embroidery', params: createEmbroideryParams() };
    case 'amber-words':
      return { kind: 'amber-words', params: createAmberParams() };
    case 'song-fire':
      return { kind: 'song-fire', params: createSongFireParams() };
    case 'scene': {
      const scene = effect.sceneId ? getScene(effect.sceneId) : null;
      const overrides = { ...scene?.defaultParams, ...effect.sceneParams };
      return { kind: 'scene', params: effect.sceneId === 'late-stories' ? createActivatedLifeParams(overrides) : createSceneParams(overrides), sceneId: effect.sceneId };
    }
    default:
      return null;
  }
}
