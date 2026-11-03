import type { PointerState } from './engine';
import { effectClientPoint } from './touchAim';

type PointerLike = {
  type: string;
  clientX: number;
  clientY: number;
  buttons: number;
  pointerType: string;
  pointerId?: number;
};

/**
 * The effects' cursor state for a pointer event over a host element (`rect` is the host's bounding box):
 * coordinates from the host's centre with y up, whether the left button is down (or a finger/pen touches), and
 * what kind of pointer it is. A finger that lifts leaves the card, since a touch has no hover.
 */
export function pointerStateFromEvent(event: PointerLike, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, previous?: PointerState): PointerState {
  const touch = event.pointerType !== 'mouse';
  const ended = event.type === 'pointerup' || event.type === 'pointercancel';
  const point = effectClientPoint(event, rect);
  const x = point.clientX - rect.left - rect.width / 2;
  const y = -(point.clientY - rect.top - rect.height / 2);
  const contact = event.pointerType === 'touch' ? { x: event.clientX - rect.left - rect.width / 2, y: -(event.clientY - rect.top - rect.height / 2) } : undefined;
  const pressed = touch ? !ended : (event.buttons & 1) === 1;
  const press = event.type === 'pointerdown' && pressed ? { serial: (previous?.press?.serial ?? 0) + 1, x, y, contact } : previous?.press;
  return {
    x, y,
    active: !(touch && ended),
    moved: true,
    pressed,
    press,
    pressHistory: press && press !== previous?.press ? [...(previous?.pressHistory ?? []).slice(-31), press] : previous?.pressHistory,
    pointerType: event.pointerType,
    contact,
  };
}
