import type { MutableRefObject } from 'react';
import type { PointerState } from '../engine';
import type { ScenePointer } from './types';

/**
 * Turns the page's PointerState (from the middle of the scene, y up) into the scene's pointer: px from the top left,
 * smoothed, with a velocity, and wandering on its own while nobody points at the scene.
 */
export function createPointerTracker(width: number, height: number, source: MutableRefObject<PointerState>, isControlPoint?: (x: number, y: number) => boolean) {
  const out: ScenePointer = { x: width / 2, y: height / 2, rawX: width / 2, rawY: height / 2, vx: 0, vy: 0, active: false, pressed: false, clicked: false };
  let wasPressed = false;
  let pressSerial = source.current.press?.serial ?? 0;
  let clock = 0;
  return {
    out,
    update(dt: number): ScenePointer {
      clock += dt;
      const s = source.current;
      // Retain a bounded history so several clicks during a slow/background frame
      // are delivered in order, rather than collapsing them to the latest click.
      const press = s.pressHistory?.find(p => p.serial > pressSerial)
        ?? (s.press && s.press.serial > pressSerial ? s.press : undefined);
      const queued = !!press;
      if (press) pressSerial = press.serial;
      let tx: number;
      let ty: number;
      if (press) {
        tx = press.x + width / 2;
        ty = height / 2 - press.y;
      } else if (s.active) {
        tx = s.x + width / 2;
        ty = height / 2 - s.y;
      } else {
        // Nobody is pointing: a slow wander, so that the scene is alive on its own.
        tx = width * (0.5 + 0.34 * Math.sin(clock * 0.31));
        ty = height * (0.5 + 0.3 * Math.sin(clock * 0.47 + 1.3));
      }
      const contact = press?.contact ?? s.contact;
      if (contact && isControlPoint?.(contact.x + width / 2, height / 2 - contact.y)) {
        tx = contact.x + width / 2;
        ty = height / 2 - contact.y;
      }
      const follow = 1 - Math.exp(-dt * (s.active ? 14 : 2.5));
      out.rawX = tx;
      out.rawY = ty;
      const px = out.x;
      const py = out.y;
      out.x += (tx - out.x) * follow;
      out.y += (ty - out.y) * follow;
      const inv = 1 / Math.max(dt, 1e-3);
      out.vx += ((out.x - px) * inv - out.vx) * 0.25;
      out.vy += ((out.y - py) * inv - out.vy) * 0.25;
      out.active = s.active || queued;
      out.pressed = !!s.pressed && s.active;
      out.clicked = queued || (out.pressed && !wasPressed);
      wasPressed = out.pressed;
      return out;
    },
  };
}

/** Repeatable random numbers (mulberry32). */
export function makeRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
