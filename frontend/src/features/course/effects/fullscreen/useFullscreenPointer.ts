'use client';
import { useEffect, useRef } from 'react';
import type { PointerState } from '../engine';
import { pointerStateFromEvent } from '../pointerState';
import { PAGE_CONTROLS } from '../scenes/BodySceneEffect';

type Bounds = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

export function useFullscreenPointer(getBounds?: () => Bounds | null) {
  const pointer = useRef<PointerState>({ x: 0, y: 0, active: false, moved: false });
  useEffect(() => {
    let pressOnControl = false;
    const idle = () => { pointer.current = { ...pointer.current, active: false, pressed: false }; };
    const leave = () => { pressOnControl = false; idle(); };
    const move = (event: PointerEvent) => {
      if (event.type === 'pointerdown') pressOnControl = event.target instanceof Element && event.target.closest(PAGE_CONTROLS) !== null;
      const rect = getBounds ? getBounds() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      if (!rect || event.clientX < rect.left || event.clientX > rect.left + rect.width || event.clientY < rect.top || event.clientY > rect.top + rect.height) {
        idle();
        if (event.type === 'pointerup') pressOnControl = false;
        return;
      }
      const previous = pointer.current;
      const next = pointerStateFromEvent(event, rect, previous);
      if (pressOnControl) { next.pressed = false; next.press = previous.press; next.pressHistory = previous.pressHistory; }
      pointer.current = next;
      if (event.type === 'pointerup') pressOnControl = false;
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', move, { passive: true });
    window.addEventListener('pointerup', move, { passive: true });
    window.addEventListener('pointercancel', leave);
    window.addEventListener('blur', leave);
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', move);
      window.removeEventListener('pointerup', move);
      window.removeEventListener('pointercancel', leave);
      window.removeEventListener('blur', leave);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, [getBounds]);
  return pointer;
}
