'use client';

import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { createFrameMeter, trackGlContext } from './scenes/frameMeter';
import { effectDiagnosticsEnabled, recordEffectFrame } from './effectDiagnostics';

/** Measure the R3F update callbacks and the following render, without taking over rendering. */
export function EffectFrameProbe() {
  const gl = useThree(state => state.gl);
  const meter = useRef<ReturnType<typeof createFrameMeter> | null>(null);
  useFrame(() => {
    if (!effectDiagnosticsEnabled()) { meter.current = null; return; }
    if (!meter.current) {
      trackGlContext(gl.getContext());
      meter.current = createFrameMeter(0, gl.domElement);
    }
    meter.current.begin(performance.now());
  }, -10000);
  useLayoutEffect(() => {
    const original = gl.render;
    const render: typeof original = function (...args) {
      try { return original.apply(gl, args); }
      finally {
        if (meter.current) { meter.current.end(); recordEffectFrame(gl.domElement, meter.current.read()); }
      }
    };
    gl.render = render;
    return () => { if (gl.render === render) gl.render = original; };
  }, [gl]);
  return null;
}
