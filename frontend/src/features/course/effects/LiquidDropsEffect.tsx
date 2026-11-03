'use client';
import { profileEffectFrame } from './effectDiagnostics';


import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EffectTuningPanel } from './tuning/EffectTuningPanel';
import {
  createLiquidDropsParams,
  liquidDropsImage,
  liquidDropsSceneIndex,
  type LiquidDropsParams,
} from './liquidDrops/params';
import { createDropGrid, packDropGrid, restDropGrid, stepDropGrid, type DropGrid } from './liquidDrops/physics';
import { BACKGROUND_FRAGMENT, BLUR_FRAGMENT, MAIN_FRAGMENT, VERTEX_SHADER } from './liquidDrops/shaders';
import styles from './liquid-drops.module.css';
import { useEffectHost, effectPoint } from './EffectHost';

export type { LiquidDropsParams } from './liquidDrops/params';

const notify = () => {};
const MIN_CELL_PX = 22;
const MAX_BUFFER_PIXELS = 16_000_000;

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!match) return [1, 1, 1];
  return [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255];
}

/**
 * Whole-page liquid-glass background: a grid of small drops (30 columns by default) over a picture,
 * refracting it like glass. Drops fuse into one another (the "merge" setting), and a bigger drop
 * follows the pointer and drags the nearby ones along.
 *
 * Three passes per frame: the picture, its frosted copy, then the glass. See liquidDrops/shaders.ts.
 */
export function LiquidDropsEffect({ initialParams, params }: { initialParams?: Partial<LiquidDropsParams>; params?: LiquidDropsParams }) {
  const host = useEffectHost();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);
  const tuning = useMemo(
    () => ({ kind: 'liquid-drops' as const, params: params ?? createLiquidDropsParams(initialParams) }),
    [initialParams, params],
  );

  useEffect(() => {
    // The body portal must not participate in server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !canvasRef.current) return;
    let disposed = false;
    let release = () => {};
    // Lets course-path.module.css make the page card see-through while the glass is running.
    if (!host) document.body.classList.add('liquid-drops-active');

    void (async () => {
      const THREE = await import('three');
      if (disposed) return;
      const canvas = canvasRef.current!;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: 'high-performance' });
      } catch (error) {
        console.warn('Liquid drops: WebGL unavailable; the CSS gradient stays as the background.', error);
        return;
      }

      const p = tuning.params;
      const camera = new THREE.Camera();
      const geometry = new THREE.PlaneGeometry(2, 2);
      const makeScene = (material: InstanceType<typeof THREE.ShaderMaterial>) => {
        const scene = new THREE.Scene();
        scene.add(new THREE.Mesh(geometry, material));
        return scene;
      };

      const blankTexture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
      blankTexture.needsUpdate = true;
      // The picture under the glass for photo scenes and the visitor's own image.
      let imageTexture: InstanceType<typeof THREE.Texture> | null = null;
      let imageRequested = '';
      let imageReady = '';
      let imageVersion = 0;
      // The scene actually drawn: a photo scene keeps showing the previous one until its picture has loaded.
      let usedScene = 0;

      const bgMaterial = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: BACKGROUND_FRAGMENT,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uResolution: { value: new THREE.Vector2(1, 1) },
          uTime: { value: 0 },
          uScene: { value: 0 },
          uBrightness: { value: 1 },
          uSaturation: { value: 1 },
          uCustom: { value: blankTexture },
          uCustomAspect: { value: 1 },
          uCustomFocus: { value: new THREE.Vector2(0.5, 0.5) },
        },
      });
      const blurMaterial = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: BLUR_FRAGMENT,
        depthTest: false,
        depthWrite: false,
        uniforms: { uTex: { value: blankTexture }, uStep: { value: new THREE.Vector2() } },
      });
      const dropsPlaceholder = new THREE.DataTexture(new Float32Array([0, 0, 1, 1]), 1, 1, THREE.RGBAFormat, THREE.FloatType);
      dropsPlaceholder.needsUpdate = true;
      const mainMaterial = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: MAIN_FRAGMENT,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uBg: { value: blankTexture },
          uBlur: { value: blankTexture },
          uDrops: { value: dropsPlaceholder },
          uSize: { value: new THREE.Vector2(1, 1) },
          uCell: { value: 64 },
          uGrid: { value: new THREE.Vector2(1, 1) },
          uRad: { value: 1 },
          uReach: { value: 1 },
          uIso: { value: 0.8 },
          uPtr: { value: new THREE.Vector3() },
          uPtrReach: { value: 1 },
          uPtrAmp: { value: 1 },
          uThick: { value: 0.5 },
          uRefFactor: { value: 1.5 },
          uRefDist: { value: 0.25 },
          uLens: { value: 0.02 },
          uDisp: { value: 0.5 },
          uFrInt: { value: 0.5 },
          uFrRange: { value: 0.16 },
          uGlare: { value: 0.6 },
          uGlareAngle: { value: 0.7 },
          uTint: { value: new THREE.Vector4(1, 1, 1, 0) },
          uFrost: { value: 0.4 },
          uShadow: { value: 0.3 },
        },
      });
      const bgScene = makeScene(bgMaterial);
      const blurScene = makeScene(blurMaterial);
      const mainScene = makeScene(mainMaterial);
      const targetOptions = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
      const rtBg = new THREE.WebGLRenderTarget(2, 2, targetOptions);
      const rtHalf = new THREE.WebGLRenderTarget(2, 2, targetOptions);
      const rtBlur = new THREE.WebGLRenderTarget(2, 2, targetOptions);

      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      const u = mainMaterial.uniforms;

      // Layout: the grid reaches one cell past the screen on every side, so the glass never thins
      // out at the borders.
      let width = 1;
      let height = 1;
      let pixelRatio = 1;
      let cell = 64;
      let grid: DropGrid = createDropGrid(3, 3);
      let dropTexture = dropsPlaceholder;
      let dropData = new Float32Array(12);
      let gridKey = '';
      let bufferKey = '';
      let bgKey = '';
      // Lowered automatically when frames keep coming slowly (a weak GPU or a very large screen).
      let quality = 1;
      let slowFrames = 0;
      let frameKey = '';
      let time = 0;
      let last = 0;
      let frame = 0;

      // Pointer, in CSS pixels with y pointing up.
      let pointerX = 0;
      let pointerY = 0;
      let pointerActive = false;
      let smoothX = 0;
      let smoothY = 0;
      let presence = 0;
      let pointerMoved = false;

      const applyLayout = () => {
        width = Math.max(1, canvas.clientWidth);
        height = Math.max(1, canvas.clientHeight);
        const budget = Math.sqrt(MAX_BUFFER_PIXELS / (width * height));
        pixelRatio = Math.max(0.5, Math.min(devicePixelRatio || 1, p.pixelRatioCap, budget, renderer.capabilities.maxTextureSize / Math.max(width, height)) * quality);
        const columns = Math.max(6, Math.min(Math.round(p.columns), Math.floor(width / MIN_CELL_PX)));

        const nextBufferKey = `${width}x${height}|${pixelRatio}|${p.bgScale}`;
        if (nextBufferKey !== bufferKey) {
          bufferKey = nextBufferKey;
          renderer.setPixelRatio(pixelRatio);
          renderer.setSize(width, height, false);
          canvas.dataset.renderResolution = `${canvas.width}x${canvas.height}`;
          const bgWidth = Math.max(2, Math.round(width * pixelRatio * p.bgScale));
          const bgHeight = Math.max(2, Math.round(height * pixelRatio * p.bgScale));
          rtBg.setSize(bgWidth, bgHeight);
          rtHalf.setSize(Math.max(2, bgWidth >> 1), Math.max(2, bgHeight >> 1));
          rtBlur.setSize(Math.max(2, bgWidth >> 1), Math.max(2, bgHeight >> 1));
          bgMaterial.uniforms.uResolution.value.set(bgWidth, bgHeight);
          bgKey = '';
        }

        const nextGridKey = `${width}x${height}|${columns}`;
        if (nextGridKey === gridKey) return;
        gridKey = nextGridKey;

        cell = width / columns;
        const totalCols = columns + 2;
        const totalRows = Math.ceil(height / cell) + 2;
        grid = createDropGrid(totalCols, totalRows);
        dropTexture.dispose();
        dropData = new Float32Array(totalCols * totalRows * 4);
        dropTexture = new THREE.DataTexture(dropData, totalCols, totalRows, THREE.RGBAFormat, THREE.FloatType);
        dropTexture.minFilter = THREE.NearestFilter;
        dropTexture.magFilter = THREE.NearestFilter;
        dropTexture.needsUpdate = true;
        u.uDrops.value = dropTexture;
        u.uGrid.value.set(totalCols, totalRows);
        u.uCell.value = cell;
        u.uSize.value.set(width, height);
        frameKey = '';
      };

      const syncImage = (wanted: { src: string; focusY: number } | null) => {
        const source = wanted?.src ?? '';
        if (source === imageRequested) return;
        imageRequested = source;
        if (!wanted) {
          // Painted scenes need no picture; give the GPU memory of the last one back.
          imageTexture?.dispose();
          imageTexture = null;
          imageReady = '';
          bgMaterial.uniforms.uCustom.value = blankTexture;
          return;
        }
        new THREE.TextureLoader().load(
          source,
          (loaded) => {
            if (disposed || source !== imageRequested) {
              loaded.dispose();
              return;
            }
            imageTexture?.dispose();
            imageTexture = loaded;
            const image = loaded.image as { width: number; height: number };
            bgMaterial.uniforms.uCustom.value = loaded;
            bgMaterial.uniforms.uCustomAspect.value = image.width / Math.max(1, image.height);
            bgMaterial.uniforms.uCustomFocus.value.set(0.5, wanted.focusY);
            imageReady = source;
            imageVersion += 1;
          },
          undefined,
          (error) => console.warn('Liquid drops: the picture failed to load.', source, error),
        );
      };

      const move = (event: PointerEvent) => {
        const point = effectPoint(host, event);
        if (!point.inside) { pointerActive = false; return; }
        if (event.pointerType === 'touch' && !pointerActive) return;
        pointerActive = true;
        pointerMoved = true;
        pointerX = point.x;
        pointerY = height - point.y;
      };
      const down = (event: PointerEvent) => {
        const point = effectPoint(host, event);
        if (!point.inside) return;
        if (event.pointerType !== 'touch') return;
        pointerActive = true;
        pointerMoved = true;
        pointerX = point.x;
        pointerY = height - point.y;
      };
      const leave = () => {
        pointerActive = false;
        pointerMoved = true;
      };

      const render = profileEffectFrame(canvas, (now: number) => {
        frame = requestAnimationFrame(render);
        const rawDelta = last ? now - last : 0;
        const dt = Math.min(rawDelta / 1000, 0.05);
        last = now;
        if (document.hidden) return;
        // Stalls (a switched tab, a debugger) are not a sign of a weak GPU; steady slow frames are.
        if (rawDelta > 0 && rawDelta < 250) {
          slowFrames = rawDelta > 30 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
          if (slowFrames > 45 && quality > 0.6) {
            quality *= 0.85;
            slowFrames = 0;
          }
        }

        applyLayout();
        const wanted = liquidDropsImage(p.scene, p.customImage);
        syncImage(wanted);
        const wantedIndex = liquidDropsSceneIndex(p.scene);
        if (wantedIndex !== 4) usedScene = wantedIndex;
        else if (wanted && wanted.src === imageReady) usedScene = 4;
        const still = reducedMotion.matches;
        if (!still) time += dt * p.motion;

        // A fully static setup (reduced motion) only needs a new frame when something changed.
        const key = still ? JSON.stringify(p) + `|${width}x${height}|${imageVersion}` : '';
        if (still && !pointerMoved && key === frameKey) return;
        frameKey = key;
        pointerMoved = false;

        // Pointer drop: follows the pointer with a little lag (more of it when the jelly is wobbly).
        const follow = p.cursor && !still && pointerActive;
        const rate = Math.max(2, 18 - 12 * p.jelly);
        if (follow) {
          if (presence < 0.02) {
            smoothX = pointerX;
            smoothY = pointerY;
          }
          const k = 1 - Math.exp(-dt * rate);
          smoothX += (pointerX - smoothX) * k;
          smoothY += (pointerY - smoothY) * k;
        }
        presence += ((follow ? 1 : 0) - presence) * (1 - Math.exp(-dt * (follow ? 9 : 5)));
        const pointerCell = { x: smoothX / cell + 1, y: smoothY / cell + 1, presence };

        if (still) {
          restDropGrid(grid, { jitter: p.jitter, variation: p.variation });
          packDropGrid(grid, dropData);
          dropTexture.needsUpdate = true;
        } else {
          stepDropGrid(grid, {
            dt,
            time,
            breathe: p.breathe,
            jitter: p.jitter,
            variation: p.variation,
            pointer: presence > 0.001 ? pointerCell : null,
            pullRadius: p.pullRadius,
            pullStrength: p.pullStrength,
            jelly: p.jelly,
          });
          packDropGrid(grid, dropData);
          dropTexture.needsUpdate = true;
        }

        // The field: single-drop radius r0 fixes the iso level; "merge" widens the reach of each drop.
        // With drops one cell apart, a reach of ~0.85 keeps them apart, ~0.95 joins them with necks,
        // ~1.05 leaves only small holes at the corners and ~1.3 fuses everything into one film.
        const r0 = p.dropSize;
        const reach = r0 * 1.3 + p.merge * (1.3 - r0 * 1.3);
        u.uReach.value = reach;
        u.uIso.value = (1 - (r0 / reach) ** 2) ** 3;
        u.uRad.value = Math.min(3, Math.max(1, Math.ceil(reach)));
        const rc = Math.max(p.cursorSize, r0);
        const reachCursor = rc + (reach - r0);
        u.uPtr.value.set(pointerCell.x, pointerCell.y, presence);
        u.uPtrReach.value = reachCursor;
        u.uPtrAmp.value = u.uIso.value / (1 - (rc / reachCursor) ** 2) ** 3;

        u.uThick.value = Math.max(0.02, p.thickness);
        u.uRefFactor.value = Math.max(1.05, p.refraction);
        u.uRefDist.value = p.refDistance;
        // The slider runs 0..1.5 but the useful strength is a tenth of that.
        u.uLens.value = p.lens * 0.1;
        u.uDisp.value = p.dispersion;
        u.uFrInt.value = p.fresnel;
        u.uFrRange.value = Math.max(0.01, p.fresnelRange);
        u.uGlare.value = p.glare;
        u.uGlareAngle.value = (p.glareAngle * Math.PI) / 180;
        const [tr, tg, tb] = hexToRgb(p.tintColor);
        u.uTint.value.set(tr, tg, tb, p.tint);
        u.uFrost.value = p.frost;
        u.uShadow.value = p.shadow;

        // The picture and its frosted copy: skipped while nothing about them can have changed.
        const animated = !still && p.motion > 0;
        const nextBgKey = `${usedScene}|${p.brightness}|${p.saturation}|${p.blur}|${imageVersion}`;
        if (animated || nextBgKey !== bgKey) {
          bgKey = nextBgKey;
          bgMaterial.uniforms.uTime.value = time;
          bgMaterial.uniforms.uScene.value = usedScene;
          bgMaterial.uniforms.uBrightness.value = p.brightness;
          bgMaterial.uniforms.uSaturation.value = p.saturation;
          renderer.setRenderTarget(rtBg);
          renderer.render(bgScene, camera);

          const radius = Math.max(0, p.blur) * cell * pixelRatio * p.bgScale;
          const stepX = radius / 6 / rtBg.width;
          const stepY = radius / 6 / rtBg.height;
          blurMaterial.uniforms.uTex.value = rtBg.texture;
          blurMaterial.uniforms.uStep.value.set(stepX, 0);
          renderer.setRenderTarget(rtHalf);
          renderer.render(blurScene, camera);
          blurMaterial.uniforms.uTex.value = rtHalf.texture;
          blurMaterial.uniforms.uStep.value.set(0, stepY);
          renderer.setRenderTarget(rtBlur);
          renderer.render(blurScene, camera);
        }
        u.uBg.value = rtBg.texture;
        u.uBlur.value = rtBlur.texture;

        renderer.setRenderTarget(null);
        renderer.render(mainScene, camera);
      });

      const contextLost = (event: Event) => {
        event.preventDefault();
        cancelAnimationFrame(frame);
        console.warn('Liquid drops: WebGL context lost; the CSS gradient stays as the background.');
      };
      const contextRestored = () => {
        gridKey = '';
        bufferKey = '';
        bgKey = '';
        last = 0;
        frame = requestAnimationFrame(render);
      };

      const resizeObserver = new ResizeObserver(() => applyLayout());
      resizeObserver.observe(canvas);
      addEventListener('pointermove', move, { passive: true });
      addEventListener('pointerdown', down, { passive: true });
      addEventListener('pointerup', leave);
      addEventListener('pointercancel', leave);
      addEventListener('blur', leave);
      document.documentElement.addEventListener('pointerleave', leave);
      canvas.addEventListener('webglcontextlost', contextLost);
      canvas.addEventListener('webglcontextrestored', contextRestored);
      applyLayout();
      frame = requestAnimationFrame(render);

      release = () => {
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        removeEventListener('pointermove', move);
        removeEventListener('pointerdown', down);
        removeEventListener('pointerup', leave);
        removeEventListener('pointercancel', leave);
        removeEventListener('blur', leave);
        document.documentElement.removeEventListener('pointerleave', leave);
        canvas.removeEventListener('webglcontextlost', contextLost);
        canvas.removeEventListener('webglcontextrestored', contextRestored);
        geometry.dispose();
        bgMaterial.dispose();
        blurMaterial.dispose();
        mainMaterial.dispose();
        rtBg.dispose();
        rtHalf.dispose();
        rtBlur.dispose();
        blankTexture.dispose();
        dropsPlaceholder.dispose();
        dropTexture.dispose();
        imageTexture?.dispose();
        renderer.dispose();
      };
    })().catch((error) => console.warn('Liquid drops failed to initialize.', error));

    return () => {
      disposed = true;
      release();
      if (!host) document.body.classList.remove('liquid-drops-active');
    };
  }, [mounted, tuning, host]);

  if (!mounted) return null;
  return (
    <>
      {createPortal(
        <div className={styles.backdrop} aria-hidden="true">
          <canvas ref={canvasRef} data-course-liquid-drops="" />
        </div>,
        host ?? document.body,
      )}
      <EffectTuningPanel tuning={tuning} onChange={notify} />
    </>
  );
}
