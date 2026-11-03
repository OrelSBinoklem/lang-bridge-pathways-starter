import type { ScenePointer } from './types';
import { skylinePinballLayout } from './pinballSkylineLayout';
import type { createPinballSkylineRenderer } from './pinballSkylineRenderer';

/** Heavy renderer/physics loads only for this selected effect, never for the classic archive or a gallery poster. */
export function createPinballSkyline(width: number, height: number, onHit: (color: [number, number, number]) => void, expanded = false) {
  const rect = skylinePinballLayout(width, height, expanded);
  let inner: ReturnType<typeof createPinballSkylineRenderer> | null = null, disposed = false, failed = false;
  import('./pinballSkylineRenderer').then(module => {
    if (!disposed) inner = module.createPinballSkylineRenderer(width, height, onHit, expanded);
  }).catch(error => { if (!disposed) { failed = true; console.error('Skyline pinball could not initialize', error); } });
  return {
    ready() { return inner !== null || failed; },
    update(dt: number, pointer: ScenePointer, enabled: boolean) {
      return inner?.update(dt, pointer, enabled) ?? (pointer.active && pointer.rawX >= rect.x && pointer.rawX <= rect.x + rect.width && pointer.rawY >= rect.y && pointer.rawY <= rect.y + rect.height);
    },
    draw(g: CanvasRenderingContext2D) {
      if (inner) inner.draw(g);
      else { g.save(); g.fillStyle = '#c0e4f6'; g.font = '13px sans-serif'; g.textAlign = 'center'; g.fillText(failed ? 'Не удалось загрузить пинбол' : 'Собираем мастерскую…', rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width); g.restore(); }
    },
    dispose() { disposed = true; inner?.dispose(); inner = null; },
  };
}
