'use client';

import { useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MutableRefObject } from 'react';
import { useLocale } from 'next-intl';
import type { PointerState } from '../engine';
import { createPointerTracker, makeRandom } from './pointer';
import { createVisibleAnimationLoop } from './visibleAnimationLoop';
import { createFrameMeter, frameLoadColor, frameLoadText, installGlTracking, type FrameMeter } from './frameMeter';
import { SHADER_HEADER, SHADER_MAIN, SHADER_VERTEX } from './shaderLib';
import type { CanvasSceneDef, LoadedSceneDef, SceneDef, SceneParams, ShaderSceneDef } from './types';
import { recordEffectFrame } from '../effectDiagnostics';
import { EffectDebugContext } from '../EffectDebugContext';
import { EffectLoadBadge } from '../EffectPreviewControls';
import { canvasPixelRatio, watchPixelRatio } from './canvasPixelRatio';
import { subscribeLifeStory } from './lifelongSelection';
import { GemChoice } from './GemChoice';
import { WeekBookChoice } from './WeekBookChoice';
import { subscribeWeekBook } from './weekBookState';

type Props = {
  contentVisible?: boolean;
  scene: SceneDef;
  /** Index into the scene's palettes. */
  palette?: number;
  width: number;
  height: number;
  pointerRef: MutableRefObject<PointerState>;
  params: SceneParams;
  /** Drawn on a whole page. */
  body?: boolean;
  region?: 'full' | 'left' | 'right';
  cameraControls?: boolean | 'below-toolbar';
  /** Gallery poster capture: retain the frame until it is copied, then release the context. */
  preview?: boolean;
};

/** A scene of either kind, on a canvas that fills its parent. The size is followed only once it has stopped changing. */
export function SceneEffect(props: Props) {
  if (props.scene.kind === 'lazy') return <LazySceneRunner {...props} />;
  return <LoadedSceneEffect {...props} scene={props.scene} />;
}

function LazySceneRunner(props: Props) {
  const [result, setResult] = useState<{ id: string; scene?: LoadedSceneDef; error?: string } | null>(null);
  useEffect(() => {
    if (props.scene.kind !== 'lazy') return;
    let alive = true;
    const id = props.scene.id;
    props.scene.load().then(scene => { if (alive) setResult({ id, scene }); }).catch(error => {
      console.error(`Failed to load effect ${id}`, error);
      if (alive) setResult({ id, error: 'Не удалось загрузить эффект. Обновите страницу.' });
    });
    return () => { alive = false; };
  }, [props.scene]);
  const current = result?.id === props.scene.id ? result : null;
  return current?.scene ? <LoadedSceneEffect {...props} scene={current.scene} />
    : <span role="status" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#d9e1e8' }}>{current?.error ?? 'Загрузка эффекта…'}</span>;
}

function LoadedSceneEffect(props: Omit<Props, 'scene'> & { scene: LoadedSceneDef }) {
  // The card's size changes many times in a row while a group opens; scenes are rebuilt once it has settled.
  const [settled, setSettled] = useState({ width: props.width, height: props.height });
  useEffect(() => {
    if (settled.width === props.width && settled.height === props.height) return;
    const timer = window.setTimeout(() => setSettled({ width: props.width, height: props.height }), 180);
    return () => window.clearTimeout(timer);
  }, [props.width, props.height, settled]);
  if (props.scene.kind === 'shader') return <ShaderRunner {...props} scene={props.scene} width={settled.width} height={settled.height} />;
  if (props.scene.id === 'late-stories') return <SelectedLifeCanvas {...props} scene={props.scene} width={settled.width} height={settled.height} />;
  return <CanvasRunner {...props} scene={props.scene} width={settled.width} height={settled.height} />;
}

/** Selection also redraws a frozen reduced-motion scene, without turning animation back on. */
function SelectedLifeCanvas(props: Props & { scene: CanvasSceneDef }) {
  const subscribe = useCallback((listener: () => void) => subscribeLifeStory(props.params, listener), [props.params]);
  const snapshot = useCallback(() => props.params.lifeStory, [props.params]);
  const selection = useSyncExternalStore(subscribe, snapshot, snapshot);
  return <CanvasRunner key={selection} {...props} />;
}

/** The load badge (not on a page's background): the meter's reading, four times a second. */
function useLoadBadge(enabled: boolean) {
  const courseDebug = useContext(EffectDebugContext);
  const ref = useRef<HTMLDivElement | null>(null);
  const show = (meter: FrameMeter, canvas: HTMLCanvasElement) => {
    let at = 0, diagnosticAt = 0;
    return () => {
      const now = performance.now();
      recordEffectFrame(canvas, meter.read());
      if(process.env.NODE_ENV !== 'production' && canvas.dataset.gems && now-diagnosticAt>=250){
        canvas.dataset.gemsFrameLoad=JSON.stringify(meter.read());
        diagnosticAt=now;
      }
      if (!ref.current || now - at < 250) return;
      at = now;
      const f = meter.read();
      ref.current.textContent = frameLoadText(f);
      ref.current.style.color = frameLoadColor(f.load);
    };
  };
  const badge = enabled && courseDebug === null ? (
    <EffectLoadBadge ref={ref} />
  ) : null;
  return { badge, show };
}

const hashString = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

function CanvasRunner({ scene, palette = 0, width, height, pointerRef, params, body = false, preview = false, cameraControls = true, region, contentVisible }: Props & { scene: CanvasSceneDef }) {
  const locale = useLocale() === 'uk' ? 'uk' : 'ru';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ratioGeneration, setRatioGeneration] = useState(0);
  useEffect(() => {
    // Only native-resolution scenes opt into DPR-only rebuilds; do not change other effects' budgets/lifecycle.
    if(scene.pixelRatioCap !== Infinity) return;
    return watchPixelRatio(() => setRatioGeneration(n => n + 1));
  }, [scene]);
  const { badge, show } = useLoadBadge(!body && !preview);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const dpr = canvasPixelRatio(window.devicePixelRatio, body, scene.pixelRatioCap);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    // `width`/`height` are debounced (see `settled` above) so an expensive scene isn't rebuilt on every tick of a
    // drag-resize — but that leaves the canvas's own backing buffer briefly behind the on-screen box it's stretched
    // to fill, which visibly distorts the picture for as long as the drag plus the debounce takes. Independent of
    // that debounce, keep the buffer itself matched to the box's actual current size so the browser never has to
    // stretch a wrong-shaped bitmap; the content drawn into it still reflects the settled size for a moment, which
    // just reads as a touch off-centre rather than squashed.
    let redrawStatic: (() => void) | undefined;
    const syncBufferToBox = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
        // Assigning the backing-buffer size clears it. Reduced-motion scenes have no RAF to
        // repaint after a scrollbar/layout settles, so explicitly redraw their still frame.
        redrawStatic?.();
      }
    };
    const resizeObserver = new ResizeObserver(syncBufferToBox);
    resizeObserver.observe(canvas);
    if (!body || (process.env.NODE_ENV !== 'production' && scene.id === 'gems')) installGlTracking();
    const meter = createFrameMeter(performance.now());
    const report = show(meter, canvas);
    const colors = scene.palettes[palette % scene.palettes.length];
    const controls: ((x: number, y: number) => boolean)[] = [];
    const instance = scene.create({ width, height, dpr, palette: colors, params, body, cameraControls, region, contentVisible, locale,
      registerPointerControl: hitTest => controls.push(hitTest),
      isVisible: () => canvas.dataset.effectRunning === 'true', rand: makeRandom(hashString(scene.id) + palette) });
    const tracker = createPointerTracker(width, height, pointerRef, (x, y) => !!instance.isControlPoint?.(x, y) || controls.some(hitTest => hitTest(x, y)));
    let clock = 0;
    let ratioRebuildQueued = false;
    const frame = (dt: number) => {
      // Some Chromium zoom/emulation changes do not dispatch resize/media events. Reuse the existing RAF,
      // not an extra loop; queue one rebuild, and never keep presenting a stale-density native canvas.
      if(scene.pixelRatioCap === Infinity && (window.devicePixelRatio || 1) !== dpr) {
        if(!ratioRebuildQueued) {ratioRebuildQueued=true;setRatioGeneration(n => n + 1);}
        return;
      }
      const pointer = tracker.update(dt);
      clock += dt * params.speed;
      instance.update(dt * params.speed, clock, pointer);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      instance.draw(g);
    };
    const stopBookSelection = scene.id === 'week-book' ? subscribeWeekBook(params,() => frame(0)) : () => {};
    if (scene.static || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      redrawStatic = () => frame(0);
      for (let i = 0; i < (scene.warmupFrames ?? 120); i += 1) frame(1 / 30);
      let stopPending = () => {};
      canvas.dataset.effectState = 'static';
      if (instance.ready && !instance.ready()) {
        canvas.dataset.effectState = 'preparing';
        stopPending = createVisibleAnimationLoop(canvas, () => {
          frame(0);
          if (instance.ready?.()) { canvas.dataset.effectState = 'static'; stopPending(); }
        });
      }
      return () => {
        stopBookSelection();
        stopPending();
        delete canvas.dataset.effectState;
        resizeObserver.disconnect();
        instance.dispose?.();
      };
    }
    const stop = createVisibleAnimationLoop(canvas, (dt, time) => {
      meter.begin(time);
      frame(dt);
      meter.end();
      report();
    }, visible => instance.setVisible?.(visible));
    return () => {
      stopBookSelection();
      stop();
      resizeObserver.disconnect();
      instance.dispose?.();
    };
    // (`show` is made anew each render; the badge's element is the same.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, palette, width, height, pointerRef, params, body, cameraControls, region, contentVisible, ratioGeneration, locale]);
  return (
    <>
      <canvas ref={canvasRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {scene.id === 'gems' && <GemChoice params={params} />}
      {scene.id === 'week-book' && !preview && <WeekBookChoice params={params} compact={!body || height < 320} uk={locale === 'uk'} />}
      {badge}
    </>
  );
}

const hex = (css: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(css.trim());
  const n = m ? parseInt(m[1], 16) : 0x888888;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

function compile(gl: WebGL2RenderingContext, type: number, source: string, label: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(`Scene "${label}" shader:`, gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function ShaderRunner({ scene, palette = 0, width, height, pointerRef, params, body = false, preview = false }: Props & { scene: ShaderSceneDef }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { badge, show } = useLoadBadge(!body && !preview);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    if (!body) installGlTracking();
    const meter = createFrameMeter(performance.now());
    const report = show(meter, canvas);
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: preview });
    if (!gl) return;
    // Strict Mode replays effects on the same canvas. Only release a genuinely unmounted poster.
    const releasePreview = () => {
      if (preview) window.setTimeout(() => { if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext(); }, 0);
    };
    const vs = compile(gl, gl.VERTEX_SHADER, SHADER_VERTEX, scene.id);
    const fs = compile(gl, gl.FRAGMENT_SHADER, SHADER_HEADER + scene.fragment + SHADER_MAIN, scene.id);
    if (!vs || !fs) { if (vs) gl.deleteShader(vs); if (fs) gl.deleteShader(fs); return; }
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(`Scene "${scene.id}" program:`, gl.getProgramInfoLog(program));
      gl.deleteShader(vs); gl.deleteShader(fs); gl.deleteProgram(program);
      return;
    }
    gl.deleteShader(vs); gl.deleteShader(fs);
    gl.useProgram(program);
    const loc = (name: string) => gl.getUniformLocation(program, name);
    const uRes = loc('uRes');
    const uTime = loc('uTime');
    const uPointer = loc('uPointer');
    const uVel = loc('uVel');
    const uPal = loc('uPal');
    const uK = loc('uK');
    const uTrail = loc('uTrail');
    const colors = scene.palettes[palette % scene.palettes.length];
    const flat = new Float32Array(12);
    for (let i = 0; i < 4; i += 1) flat.set(hex(colors[i % colors.length]), i * 3);
    gl.uniform3fv(uPal, flat);

    const dpr = Math.min(window.devicePixelRatio || 1, scene.pixelRatioCap ?? 1.5);
    const budget = scene.pixelBudget ?? (body ? 600000 : 750000);
    let scale = scene.adaptiveQuality === false ? 1.5 : Math.min(1, params.quality);
    let sizedFor = '';
    const tracker = createPointerTracker(width, height, pointerRef);
    const trail = new Float32Array(36).fill(-1);
    for (let i = 0; i < 12; i += 1) trail[i * 3 + 2] = -1;
    let trailTimer = 0;
    let clock = 0;

    const draw = (dt: number) => {
      const pointer = tracker.update(dt);
      clock += dt;
      // The trail: a new point every 45 ms, older ones age.
      trailTimer += dt;
      for (let i = 0; i < 12; i += 1) if (trail[i * 3 + 2] >= 0) trail[i * 3 + 2] += dt;
      if (trailTimer > 0.045) {
        trailTimer = 0;
        trail.copyWithin(3, 0, 33);
        trail[0] = pointer.x / width;
        trail[1] = pointer.y / height;
        trail[2] = 0;
      }
      const cap = Math.sqrt(budget / (width * height * dpr * dpr));
      const factor = Math.min(scale, params.quality, cap);
      const w = Math.max(2, Math.round(width * dpr * factor));
      const h = Math.max(2, Math.round(height * dpr * factor));
      const key = `${w}x${h}`;
      if (key !== sizedFor) {
        sizedFor = key;
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTime, clock);
      gl.uniform4f(uPointer, pointer.x / width, pointer.y / height, pointer.active ? 1 : 0, pointer.pressed ? 1 : 0);
      gl.uniform2f(uVel, pointer.vx / width, -pointer.vy / height);
      gl.uniform4f(uK, params.speed, params.intensity, params.react, params.hue);
      gl.uniform3fv(uTrail, trail);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      clock = 6;
      draw(0.016);
      return () => { gl.deleteProgram(program); releasePreview(); };
    }
    let slow = 0;
    let lastFrameTime: number | null = null;
    let lost = false;
    const onLost = (event: Event) => {
      event.preventDefault();
      lost = true;
    };
    canvas.addEventListener('webglcontextlost', onLost);
    const stop = createVisibleAnimationLoop(canvas, (dt, time) => {
      if (lost) return;
      const raw = lastFrameTime === null ? 1000 / 60 : time - lastFrameTime;
      lastFrameTime = time;
      if (raw < 250) {
        slow = raw > 34 ? slow + 1 : Math.max(0, slow - 2);
        if (scene.adaptiveQuality !== false && slow > 30 && scale > 0.4) {
          scale *= 0.85;
          slow = 0;
        }
      }
      meter.begin(time);
      draw(dt);
      meter.end();
      report();
    });
    return () => {
      stop();
      canvas.removeEventListener('webglcontextlost', onLost);
      gl.deleteProgram(program);
      releasePreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, palette, width, height, pointerRef, params, body, preview]);
  return (
    <>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {badge}
    </>
  );
}
