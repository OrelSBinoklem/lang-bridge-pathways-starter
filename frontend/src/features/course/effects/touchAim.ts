export type EffectPointerInput = { clientX: number; clientY: number; pointerType?: string; pointerId?: number; type?: string };
type Bounds = { left: number; top: number; width: number; height: number };
const gestures = new Map<number, 'above' | 'below'>();
const points = new WeakMap<object, { clientX: number; clientY: number }>();
export const TOUCH_AIM_OFFSET = 52;

/** Effects look ahead of a finger. Real controls still receive the original browser event. */
export function effectClientPoint(event: EffectPointerInput, bounds?: Bounds) {
  if (event.pointerType !== 'touch' || typeof window === 'undefined') return { clientX: event.clientX, clientY: event.clientY };
  let point = points.get(event);
  if (!point) {
    const id = event.pointerId ?? 0;
    let side = event.type === 'pointerdown' ? 'above' : gestures.get(id) ?? 'above';
    const edge = Math.min(TOUCH_AIM_OFFSET + 16, window.innerHeight * .25);
    if (event.clientY < edge) side = 'below';
    else if (event.clientY > window.innerHeight - edge) side = 'above';
    gestures.set(id, side);
    if (gestures.size > 8) gestures.delete(gestures.keys().next().value!);
    point = { clientX: event.clientX, clientY: Math.max(2, Math.min(window.innerHeight - 2, event.clientY + (side === 'above' ? -TOUCH_AIM_OFFSET : TOUCH_AIM_OFFSET))) };
    points.set(event, point);
    if (event.type === 'pointerup' || event.type === 'pointercancel') gestures.delete(id);
  }
  // An offset must not push a finger that is inside a small card outside its effect.
  if (bounds && event.clientX >= bounds.left && event.clientX <= bounds.left + bounds.width
    && event.clientY >= bounds.top && event.clientY <= bounds.top + bounds.height) {
    const pad = Math.min(2, bounds.height / 2);
    return { ...point, clientY: Math.max(bounds.top + pad, Math.min(bounds.top + bounds.height - pad, point.clientY)) };
  }
  return point;
}
