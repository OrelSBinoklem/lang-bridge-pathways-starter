'use client';
import { ChickHatchStages } from '../ChickHatchStages';
import { useRef } from 'react';

export function CompassFullscreen() {
  const host = useRef<HTMLSpanElement>(null);
  return <span ref={host} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
    <ChickHatchStages getHost={() => host.current?.parentElement ?? null} />
  </span>;
}
