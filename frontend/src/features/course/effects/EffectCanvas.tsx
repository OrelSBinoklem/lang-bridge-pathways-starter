'use client';

import { Canvas } from '@react-three/fiber';
import { useTheme } from 'next-themes';
import type { MutableRefObject } from 'react';
import { AmbientParticles, CursorParticles, type PointerState } from './engine';
import { StormEffect, createStormParams } from './presets';
import {
  CircuitSparkEffect,
  SparkleFieldEffect,
  PulseRingsEffect,
  OrbitDotsEffect,
  createCircuitParams,
  createSparkleParams,
  createPulseRingsParams,
  createOrbitDotsParams,
} from './uniqueEffects';
import { MineEffect, createMineParams, MINE_CAMERA_FOV, mineCameraDistance } from './MineEffect';
import { LatviaCubeEffect } from '../LatviaSouvenirCube';
import { SakuraEffect, createSakuraParams } from './SakuraEffect';
import { LanternWaterEffect, createLanternWaterParams } from './LanternWaterEffect';
import type { GroupEffectDefinition } from './groupEffects.config';
import { createLatviaCubeParams, type EffectTuningState } from './tuning/types';
import { EffectFrameProbe } from './EffectFrameProbe';

export function EffectCanvas({
  effect,
  width,
  height,
  pointerRef,
  tuning,
  preview = false,
  framed = false,
}: {
  effect: GroupEffectDefinition;
  width: number;
  height: number;
  pointerRef: MutableRefObject<PointerState>;
  /** Live-tunable params for the on-page effect tuning panel; falls back to fresh defaults when
   * absent (e.g. on the effects-preview demo page) so `EffectCanvas` still renders standalone. */
  tuning?: EffectTuningState | null;
  preview?: boolean;
  /** Isolated card/fullscreen previews need a complete, centred composition. */
  framed?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  if (width <= 0 || height <= 0) return null;
  const ambientConfig = tuning?.kind === 'ambient' ? tuning.params : effect.ambient;
  const cursorConfig = tuning?.kind === 'cursor' ? tuning.params : effect.cursor;
  const stormParams = tuning?.kind === 'storm' ? tuning.params : createStormParams();
  const circuitParams = tuning?.kind === 'circuit' ? tuning.params : createCircuitParams();
  const sparkleParams = tuning?.kind === 'sparkle' ? tuning.params : createSparkleParams();
  const pulseRingsParams = tuning?.kind === 'pulse-rings' ? tuning.params : createPulseRingsParams();
  const orbitDotsParams = tuning?.kind === 'orbit-dots' ? tuning.params : createOrbitDotsParams();
  const mineParams = tuning?.kind === 'mine' ? tuning.params : createMineParams();
  const latviaCubeParams = tuning?.kind === 'latvia-cube' ? tuning.params : createLatviaCubeParams();
  const cubeParams = framed ? { ...latviaCubeParams, positionX: latviaCubeParams.positionX - createLatviaCubeParams().positionX } : latviaCubeParams;
  const cubeDistance = framed
    ? Math.max(4.7, (cubeParams.cubeScale * 1.2 + Math.abs(cubeParams.positionX)) / (Math.tan(13 * Math.PI / 180) * Math.min(1, width / height)))
    : 4.7;
  const lanternWaterParams = tuning?.kind === 'lantern-water' ? tuning.params : createLanternWaterParams();
  const sakuraParams = tuning?.kind === 'sakura' ? tuning.params : {
    ...createSakuraParams(),
    ...(effect.bodyEffect === 'sakura-card' ? { petalCount: 120, petalSize: 17 } : {}),
  };
  // The mine is a real 3D scene, so it needs a perspective camera rather than the flat
  // orthographic one the 2D particle effects use. Its distance is chosen so one world unit still
  // maps to roughly one pixel at the scene's depth, keeping sizing consistent with everything else.
  const isPerspective = effect.kind === 'mine' || effect.kind === 'latvia-cube' || effect.kind === 'lantern-water';
  const cameraDistance = mineCameraDistance(height);
  const dark = resolvedTheme === 'dark';
  return (
    <Canvas
      shadows={effect.kind === 'mine'}
      orthographic={!isPerspective}
      // The 3D scenes carry hard edges (lantern frames, torii, mine beams), so they get MSAA and the
      // display's real pixel ratio; the flat particle effects stay cheap at 1.5x with none.
      dpr={isPerspective ? [1, 2] : [1, 1.5]}
      gl={{ alpha: true, antialias: isPerspective, powerPreference: 'low-power', stencil: true, preserveDrawingBuffer: preview }}
      camera={
        isPerspective
          ? effect.kind === 'lantern-water'
            ? { fov: 45, position: [0, 4, 26], near: 0.5, far: 800 }
            : effect.kind === 'latvia-cube'
            // A narrower lens with a compensating distance keeps the cube the same apparent size,
            // while its centre-mounted worlds no longer look much smaller than the front frame.
            ? { fov: 26, position: [0, 0, cubeDistance], near: 0.1, far: Math.max(20, cubeDistance * 3) }
            : { fov: MINE_CAMERA_FOV, position: [0, 0, cameraDistance], near: 1, far: cameraDistance * 6 }
          : { position: [0, 0, 100], near: 0.1, far: 1000 }
      }
      style={{ position: 'absolute', inset: 0 }}
    >
      <EffectFrameProbe />
      {effect.kind === 'ambient' && ambientConfig && <AmbientParticles width={width} height={height} config={ambientConfig} pointerRef={pointerRef} />}
      {effect.kind === 'cursor' && cursorConfig && <CursorParticles pointerRef={pointerRef} config={cursorConfig} />}
      {effect.kind === 'storm' && <StormEffect width={width} height={height} pointerRef={pointerRef} params={stormParams} />}
      {effect.kind === 'circuit' && <CircuitSparkEffect width={width} height={height} pulseColor={effect.accent} params={circuitParams} />}
      {/* Subpixel sparkles disappear in a still thumbnail; enlarge only the preview's points. */}
      {effect.kind === 'sparkle' && <SparkleFieldEffect width={width} height={height} color={effect.accent} params={preview ? { ...sparkleParams, size: sparkleParams.size * 6 } : sparkleParams} />}
      {effect.kind === 'pulse-rings' && <PulseRingsEffect width={width} height={height} color={effect.accent} params={pulseRingsParams} />}
      {effect.kind === 'orbit-dots' && <OrbitDotsEffect width={width} height={height} color={effect.accent} params={orbitDotsParams} />}
      {effect.kind === 'mine' && <MineEffect width={width} height={height} pointerRef={pointerRef} params={mineParams} cameraDistance={cameraDistance} />}
      {effect.kind === 'latvia-cube' && <LatviaCubeEffect dark={dark} params={cubeParams} />}
      {effect.kind === 'lantern-water' && <LanternWaterEffect width={width} height={height} pointerRef={pointerRef} params={lanternWaterParams} />}
      {effect.kind === 'sakura' && <SakuraEffect width={width} height={height} params={sakuraParams} pointerRef={pointerRef} detailed={effect.bodyEffect === 'sakura-card'} />}
    </Canvas>
  );
}
