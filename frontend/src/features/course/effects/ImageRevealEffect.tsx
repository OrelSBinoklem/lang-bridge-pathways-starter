'use client';
import { profileEffectFrame } from './effectDiagnostics';


import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { PointerState } from './engine';

const MIN_RADIUS = 55;
const MAX_RADIUS = 130;
/** Circle diameter as a fraction of the shorter card dimension. */
const RADIUS_RATIO = 0.24;
/** How quickly the circle catches up to the cursor — 1 = instant snap, matches the language-banner mask. */
const FOLLOW_LERP = 0.4;

/**
 * A circular "peephole" that follows the cursor and reveals a fixed picture hiding underneath the
 * card's normal themed background — same mechanic as `LanguageBanner`'s `cursorMask` (a round,
 * overflow-hidden window over a full-size image, offset opposite the window's own position so the
 * image stays visually anchored to the card while only the part under the circle shows), but
 * without that component's black-and-white treatment: the image shows in full color.
 */
export function ImageRevealEffect({
  width,
  height,
  pointerRef,
  imageSrc,
  focus = 'center',
  size = 'cover',
}: {
  width: number;
  height: number;
  pointerRef: MutableRefObject<PointerState>;
  imageSrc: string;
  /** CSS `background-position` for the hidden image — group headers are much wider/shorter than
   * the source picture, so `cover` crops most of its height; use this to keep whichever part
   * actually matters (e.g. a caption near the top) inside that crop instead of the middle. */
  focus?: string;
  /** CSS `background-size` for the hidden image. Defaults to `cover` (fills the card, cropping
   * whatever doesn't fit); pass e.g. `'auto 80%'` to shrink the image instead so more of its
   * height survives uncropped, at the cost of empty margins where it no longer fills the card. */
  size?: string;
}) {
  const circleRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef({ x: width / 2, y: height / 2 });

  useEffect(() => {
    if (width <= 0 || height <= 0) return;
    const diameter = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, Math.min(width, height) * RADIUS_RATIO)) * 2;
    let rafId = 0;

    const loop = profileEffectFrame(circleRef.current!, () => {
      rafId = requestAnimationFrame(loop);
      const circle = circleRef.current;
      const image = imageRef.current;
      if (!circle || !image) return;

      const cursor = pointerRef.current;
      circle.style.opacity = cursor.active ? '1' : '0';
      if (!cursor.active) return;

      const targetX = cursor.x + width / 2;
      const targetY = height / 2 - cursor.y;
      posRef.current.x += (targetX - posRef.current.x) * FOLLOW_LERP;
      posRef.current.y += (targetY - posRef.current.y) * FOLLOW_LERP;

      const left = posRef.current.x - diameter / 2;
      const top = posRef.current.y - diameter / 2;
      circle.style.transform = `translate(${left}px, ${top}px)`;
      image.style.transform = `translate(${-left}px, ${-top}px)`;
    });
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [width, height, pointerRef]);

  if (width <= 0 || height <= 0) return null;
  const diameter = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, Math.min(width, height) * RADIUS_RATIO)) * 2;

  return (
    <div
      ref={circleRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: diameter,
        height: diameter,
        borderRadius: '50%',
        overflow: 'hidden',
        opacity: 0,
        transition: 'opacity 0.15s ease',
        boxShadow: '0 0 0 2px rgba(255,255,255,0.25), 0 4px 18px rgba(0,0,0,0.45)',
        willChange: 'transform',
      }}
    >
      <div
        ref={imageRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
          backgroundImage: `url(${imageSrc})`,
          backgroundSize: size,
          backgroundPosition: focus,
          backgroundRepeat: 'no-repeat',
          willChange: 'transform',
        }}
      />
    </div>
  );
}
