'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createFoilRenderer, foilDefaults } from '@/features/holographic-foil/foilRenderer';
import {
  createStreetRenderer,
  defaults as streetDefaults,
  lightDepths,
} from '@/features/street-relight/streetRenderer';
import { PAGE_CONTROLS } from './scenes/BodySceneEffect';
import { useEffectHost, effectPoint } from './EffectHost';
import { effectClientPoint } from './touchAim';

/**
 * The two photo experiments over a whole page (owner, 2026-10-03): the holographic island for group 1777 «Моё место
 * жительства» (the painted island, or the silver technical label) and the street after the rain as a variant of 1772
 * «Я путешествую…». A fixed canvas behind the page, not catching the pointer: the renderers follow the cursor over
 * the whole window (the foil tilts after it, the street's lamp goes where it points). No toolbars or panels — their
 * full controls stay on the effects page. The street keeps its five depths of the light: a click anywhere but on the
 * page's own controls sends it one step deeper (after the fifth, back to the nearest), and a label shows which.
 */
export type BodyPhotoKind = 'holo-island' | 'holo-silver' | 'street-relight';

export function BodyPhotoEffect({ kind }: { kind: BodyPhotoKind }) {
  const host = useEffectHost();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const [depth, setDepth] = useState<{ step: number; shown: number } | null>(null);
  useEffect(() => {
    if (!host) document.body.classList.add('scene-body-active');
    return () => { if (!host) document.body.classList.remove('scene-body-active'); };
  }, [host]);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const pointerTarget = host?.hasAttribute('data-effect-page-viewport') ? window : host ?? window;
    if (kind === 'street-relight') {
      let cancelled = false;
      const abort = new AbortController();
      let dispose: (() => void) | null = null;
      createStreetRenderer(
        el,
        streetDefaults,
        () => undefined,
        (message) => {
          if (!cancelled) setError(message);
        },
        abort.signal,
        () => undefined,
        { cover: true, pointerTarget, pointerPoint: effectClientPoint },
      )
        .then((r) => {
          if (cancelled) {
            r.dispose();
            return;
          }
          let step = streetDefaults.depthStep;
          let hide = 0;
          const click = (event: MouseEvent) => {
            if (!effectPoint(host, event).inside) return;
            if (event.button !== 0 || (event.target instanceof Element && event.target.closest(PAGE_CONTROLS))) return;
            step = (step + 1) % lightDepths.length;
            r.update({ ...streetDefaults, depthStep: step });
            setDepth({ step, shown: Date.now() });
            window.clearTimeout(hide);
            hide = window.setTimeout(() => setDepth(null), 1800);
          };
          window.addEventListener('click', click);
          dispose = () => {
            window.removeEventListener('click', click);
            window.clearTimeout(hide);
            r.dispose();
          };
        })
        .catch((e: unknown) => {
          if (!cancelled && !abort.signal.aborted) setError(e instanceof Error ? e.message : String(e));
        });
      return () => {
        cancelled = true;
        abort.abort();
        dispose?.();
      };
    }
    try {
      const r = createFoilRenderer(
        el,
        { ...foilDefaults, art: kind === 'holo-silver' ? 1 : 0 },
        () => undefined,
        () => undefined,
        setError,
        { pointerTarget, instant: true, pointerPoint: effectClientPoint },
      );
      return () => r.dispose();
    } catch (e) {
      queueMicrotask(() => setError(e instanceof Error ? e.message : String(e)));
      return undefined;
    }
  }, [kind, host]);
  if (typeof document === 'undefined') return null;
  return (
    <>
      {createPortal(
        <div
          aria-hidden="true"
          style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: '#0e1012' }}
        >
          <canvas ref={canvas} style={{ display: 'block', width: '100%', height: '100%' }} />
          {error && (
            <div
              style={{
                position: 'absolute',
                left: 16,
                bottom: 16,
                color: '#e9e2cf',
                font: '13px sans-serif',
              }}
            >
              {error}
            </div>
          )}
        </div>,
        host ?? document.body,
      )}
      {/* The depth's label over the page's content (the background's own layer is under it). */}
      {depth &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              zIndex: 60,
              pointerEvents: 'none',
              left: '50%',
              bottom: 110,
              transform: 'translateX(-50%)',
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(10,12,16,0.78)',
              color: '#ffe2ae',
              font: '600 14px sans-serif',
            }}
          >
            Свет: глубина {depth.step + 1}/5 · {lightDepths[depth.step].label}
          </div>,
          host ?? document.body,
        )}
    </>
  );
}
