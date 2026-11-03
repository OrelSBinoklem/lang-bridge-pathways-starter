'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { GroupEffectDefinition } from './groupEffects.config';
import { frameLoadColor, frameLoadText } from './scenes/frameMeter';
import { readEffectDiagnostics, startEffectDiagnostics } from './effectDiagnostics';
import { EffectDebugToggle, EffectLoadBadge } from './EffectPreviewControls';

export function CourseEffectDebug({ effect, card, getHost, tunable }: {
  effect: GroupEffectDefinition; card: boolean; getHost: () => HTMLElement | null; tunable: boolean;
}) {
  const output = useRef<HTMLDivElement>(null);
  const host = useRef(getHost);
  useEffect(() => { host.current = getHost; }, [getHost]);
  useEffect(() => {
    const stop = startEffectDiagnostics();
    let lastVideoFrames = 0, lastVideoAt = performance.now();
    const timer = window.setInterval(() => {
      if (!output.current) return;
      const load = readEffectDiagnostics();
      const root = card ? host.current() : document.body;
      const video = root?.querySelector('video');
      if (video) {
        const quality = video.getVideoPlaybackQuality();
        const now = performance.now();
        const fps = (quality.totalVideoFrames - lastVideoFrames) * 1000 / (now - lastVideoAt);
        output.current.textContent = `Видео · ${Math.round(fps)} к/с · пропущено ${quality.droppedVideoFrames} · ${video.videoWidth}×${video.videoHeight} · ${video.paused ? 'пауза' : 'воспроизведение'}`;
        lastVideoFrames = quality.totalVideoFrames; lastVideoAt = now;
      } else output.current.textContent = load ? frameLoadText(load) : effect.kind === 'compass'
        ? 'DOM · обновление по движению курсора' : root?.querySelector('[data-effect-state="static"]')
          ? 'Статичный кадр · уменьшение анимации' : 'Нет измеренных кадров: пауза или подготовка';
      output.current.style.color = load ? frameLoadColor(load.load) : '#c8d5df';
    }, 250);
    return () => { clearInterval(timer); stop(); };
  }, [effect, card]);
  if (typeof document === 'undefined') return null;
  return createPortal(<>
    <div data-effect-debug="" style={{ position: 'fixed', right: 8, bottom: 8, zIndex: 10050, width: 'calc(100% - 16px)', height: 0, pointerEvents: 'none' }}>
      <EffectLoadBadge ref={output} style={{ right: 0, bottom: 44, maxWidth: '100%' }} />
      {tunable && <EffectDebugToggle settings style={{ position: 'absolute', right: 0, bottom: 0, pointerEvents: 'auto' }} />}
    </div>
    <div id="course-effect-gui-anchor" data-effect-settings="" style={{ position: 'fixed', top: 0, right: 0, zIndex: 10041, pointerEvents: 'none' }} />
  </>, document.body);
}
