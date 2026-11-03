'use client';

import { Canvas } from '@react-three/fiber';
import type { ComponentProps, ReactNode } from 'react';
import { EffectFrameProbe } from '../EffectFrameProbe';

/** Fullscreen-only canvas settings; individual effects own their camera/composition. */
export function FullscreenCanvas({ children, perspective = false, camera, shadows = false }: {
  children: ReactNode; perspective?: boolean; camera?: ComponentProps<typeof Canvas>['camera']; shadows?: boolean;
}) {
  return <Canvas orthographic={!perspective} shadows={shadows} dpr={perspective ? [1, 2] : [1, 1.5]}
    gl={{ alpha: true, antialias: perspective, powerPreference: 'low-power', stencil: true }}
    camera={camera ?? { position: [0, 0, 100], near: 0.1, far: 1000 }} style={{ position: 'absolute', inset: 0 }}>
    <EffectFrameProbe />{children}
  </Canvas>;
}
