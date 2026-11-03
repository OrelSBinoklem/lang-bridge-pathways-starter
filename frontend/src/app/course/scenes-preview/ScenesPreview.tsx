'use client';

import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { PointerState } from '@/features/course/effects/engine';
import { pointerStateFromEvent } from '@/features/course/effects/pointerState';
import { SceneEffect } from '@/features/course/effects/scenes/SceneEffect';
import { BodySceneEffect } from '@/features/course/effects/scenes/BodySceneEffect';
import { ALL_SCENES, getScene } from '@/features/course/effects/scenes/registry';
import { createSceneParams, type SceneDef, type SceneParams } from '@/features/course/effects/scenes/types';
import { EffectTuningPanel } from '@/features/course/effects/tuning/EffectTuningPanel';

function Card({ scene, palette, width, height, overrides, controls = false }: { scene: SceneDef; palette: number; width: number; height: number; overrides?: Record<string, number | string>; controls?: boolean }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<PointerState>({ x: 0, y: 0, active: false, moved: false });
  const params = useMemo(() => createSceneParams({ ...scene.defaultParams, ...(overrides as Partial<SceneParams>) }), [scene, overrides]);
  const tuning = useMemo(() => ({ kind: 'scene' as const, sceneId: scene.id, params }), [scene, params]);
  const feed = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerRef.current = pointerStateFromEvent(event, hostRef.current!.getBoundingClientRect(), pointerRef.current);
  };
  return (
    <div style={{ color: '#cfd6dd', fontFamily: 'sans-serif', fontSize: 12 }}>
      <div style={{ marginBottom: 4 }}>
        {scene.id} · {scene.label} · {scene.kind} · палитр {scene.palettes.length}
      </div>
      <div
        ref={hostRef}
        onPointerMove={feed}
        onPointerDown={feed}
        onPointerUp={feed}
        onPointerLeave={() => {
          pointerRef.current.active = false;
        }}
        style={{ position: 'relative', width, height, overflow: 'hidden', borderRadius: 12, background: '#111' }}
      >
        <SceneEffect scene={scene} palette={palette} width={width} height={height} pointerRef={pointerRef} params={params} />
      </div>
      {/* ?controls=1: the scene's debug panel, the same one the course shows. */}
      {controls && <div style={{ position: 'fixed', top: 77, right: 0, width: 280, zIndex: 20 }}>
        <EffectTuningPanel tuning={tuning} onChange={() => {}} />
      </div>}
    </div>
  );
}

export function ScenesPreview({
  only,
  palette,
  width,
  height,
  body,
  controls,
  from,
  count,
  overrides,
}: {
  only: string | null;
  palette: number;
  width: number;
  height: number;
  body: boolean;
  controls: boolean;
  from: number;
  count: number;
  overrides?: Record<string, number | string>;
}) {
  const single = only ? getScene(only) : null;
  const bodyParams = useMemo(() => createSceneParams({ ...single?.defaultParams, ...(overrides as Partial<SceneParams>) }), [single, overrides]);
  const bodyTuning = useMemo(() => ({ kind: 'scene' as const, sceneId: single?.id, params: bodyParams }), [single, bodyParams]);
  useEffect(() => {
    document.body.classList.toggle('body-effect-active', !!single && body);
    // ?controls=1 shows the scene's debug panel without the header's toggle.
    document.body.classList.toggle('garden-preview-controls', !!single && controls);
    return () => document.body.classList.remove('body-effect-active', 'garden-preview-controls');
  }, [single, body, controls]);
  if (single && body) {
    return <>
      <BodySceneEffect scene={single} palette={palette} params={bodyParams} contentVisible={single.id.startsWith('late-') ? false : undefined} />
      {controls && <div style={{ position: 'fixed', top: 77, right: 0, width: 250, zIndex: 20, pointerEvents: 'none' }}>
        <EffectTuningPanel tuning={bodyTuning} onChange={() => {}} />
      </div>}
    </>;
  }
  return (
    <div style={{ minHeight: '100vh', background: '#0e1114', padding: 16, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {single ? (
        <Card scene={single} palette={palette} width={width || 1100} height={height || 190} overrides={overrides} controls={controls} />
      ) : (
        ALL_SCENES.slice(from, from + count).map((scene) => <Card key={scene.id} scene={scene} palette={palette} width={width || 380} height={height || 170} />)
      )}
    </div>
  );
}
