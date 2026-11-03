'use client';
import { profileEffectFrame } from './effectDiagnostics';


import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { PointerState } from './engine';

const CELL = 2;
const MIN_COLS = 60;
const MAX_COLS = 360;
const MIN_ROWS = 30;
const MAX_ROWS = 180;
const DAMPING = 0.985;
const SPLASH_MIN_DISTANCE = 3;
const SPLASH_STRENGTH = 4.5;
const SPLASH_RADIUS = 4;
/** Fixed-timestep rate for the height-field step, independent of the render/rAF frame rate. */
const SIM_HZ = 50;
const SIM_DT = 1 / SIM_HZ;
/** Ambient "raindrops" so the water keeps moving even without cursor interaction. */
const RAINDROPS_PER_SECOND = 1;
const RAINDROP_PRESSURE_MIN = 1;
const RAINDROP_PRESSURE_MAX = 3;

const BG_SRC = '/course/effects/water-bg.jpg';
/** Background is sampled at a finer grid than the simulation so refraction offsets aren't blocky. */
const BG_SCALE = 3;
const REFRACT_PX = 10;

function clampByte(v: number): number {
  return Math.min(255, Math.max(0, v));
}

/**
 * Classic 2-buffer height-field ripple (https://code.almeros.com/code-examples/water-effect-canvas/),
 * stepped on a fixed timestep (decoupled from the render frame rate, like the reference's "FPS Water"
 * cap) and rendered into a low-res <canvas> that CSS stretches to fill. Height gradients refract a
 * real sunlit shallow-water photo (sampled into an offscreen buffer once) instead of a flat color.
 */
export function WaterRippleEffect({ width, height, pointerRef }: { width: number; height: number; pointerRef: MutableRefObject<PointerState> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (width <= 0 || height <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cols = Math.max(MIN_COLS, Math.min(MAX_COLS, Math.round(width / CELL)));
    const rows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, Math.round(height / CELL)));
    canvas.width = cols;
    canvas.height = rows;
    const imageData = ctx.createImageData(cols, rows);
    const data = imageData.data;

    const bgCols = cols * BG_SCALE;
    const bgRows = rows * BG_SCALE;
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = bgCols;
    bgCanvas.height = bgRows;
    const bgCtx = bgCanvas.getContext('2d');
    let bgData: Uint8ClampedArray | null = null;

    let cur = new Float32Array(cols * rows);
    let prev = new Float32Array(cols * rows);
    let lastSplash: { x: number; y: number } | null = null;
    let rafId = 0;
    let cancelled = false;
    let lastTime = 0;
    let accumulator = 0;
    let rainTimer = 1 / RAINDROPS_PER_SECOND;

    function splash(px: number, py: number, strength = SPLASH_STRENGTH) {
      const gx = Math.round((px / width) * cols);
      const gy = Math.round((py / height) * rows);
      for (let oy = -SPLASH_RADIUS; oy <= SPLASH_RADIUS; oy++) {
        for (let ox = -SPLASH_RADIUS; ox <= SPLASH_RADIUS; ox++) {
          const x = gx + ox;
          const y = gy + oy;
          if (x < 1 || x >= cols - 1 || y < 1 || y >= rows - 1) continue;
          const d = Math.hypot(ox, oy);
          const falloff = Math.max(0, 1 - d / (SPLASH_RADIUS + 0.6));
          cur[y * cols + x] -= strength * falloff;
        }
      }
    }

    function sampleBg(bx: number, by: number): [number, number, number] {
      const x = Math.max(0, Math.min(bgCols - 1, Math.round(bx)));
      const y = Math.max(0, Math.min(bgRows - 1, Math.round(by)));
      const i = (y * bgCols + x) * 4;
      const d = bgData!;
      return [d[i], d[i + 1], d[i + 2]];
    }

    function stepSimulation(dt: number) {
      const cursor = pointerRef.current;
      if (cursor.active) {
        const px = cursor.x + width / 2;
        const py = height / 2 - cursor.y;
        if (!lastSplash || Math.hypot(px - lastSplash.x, py - lastSplash.y) > SPLASH_MIN_DISTANCE) {
          splash(px, py);
          lastSplash = { x: px, y: py };
        }
      } else {
        lastSplash = null;
      }

      rainTimer -= dt;
      if (rainTimer <= 0) {
        rainTimer = (1 / RAINDROPS_PER_SECOND) * (0.6 + Math.random() * 0.8);
        const pressure = RAINDROP_PRESSURE_MIN + Math.random() * (RAINDROP_PRESSURE_MAX - RAINDROP_PRESSURE_MIN);
        splash((0.12 + Math.random() * 0.76) * width, (0.12 + Math.random() * 0.76) * height, pressure * 1.5);
      }

      for (let y = 1; y < rows - 1; y++) {
        const row = y * cols;
        for (let x = 1; x < cols - 1; x++) {
          const i = row + x;
          let v = (cur[i - 1] + cur[i + 1] + cur[i - cols] + cur[i + cols]) / 2 - prev[i];
          v *= DAMPING;
          prev[i] = v;
        }
      }
      const swap = cur;
      cur = prev;
      prev = swap;
    }

    function render() {
      let p = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const hl = x > 0 ? cur[i - 1] : cur[i];
          const hr = x < cols - 1 ? cur[i + 1] : cur[i];
          const hu = y > 0 ? cur[i - cols] : cur[i];
          const hd = y < rows - 1 ? cur[i + cols] : cur[i];
          const dx = (hr - hl) * 0.5;
          const dy = (hd - hu) * 0.5;
          const [cr, cg, cb] = sampleBg(x * BG_SCALE + BG_SCALE / 2 + dx * REFRACT_PX, y * BG_SCALE + BG_SCALE / 2 + dy * REFRACT_PX);
          const light = Math.min(1.25, Math.max(0.75, 1 + dy * 0.05 - dx * 0.02));
          data[p++] = clampByte(cr * light);
          data[p++] = clampByte(cg * light);
          data[p++] = clampByte(cb * light);
          data[p++] = 255;
        }
      }
      ctx!.putImageData(imageData, 0, 0);
    }

    const loop = profileEffectFrame(canvas, (time: number) => {
      rafId = requestAnimationFrame(loop);
      if (!bgData) return;
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
      lastTime = time;

      accumulator += dt;
      let steps = 0;
      while (accumulator >= SIM_DT && steps < 8) {
        stepSimulation(SIM_DT);
        accumulator -= SIM_DT;
        steps++;
      }
      render();
    });

    const img = new Image();
    img.onload = () => {
      if (cancelled || !bgCtx) return;
      const scale = Math.max(bgCols / img.width, bgRows / img.height);
      const sw = bgCols / scale;
      const sh = bgRows / scale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      bgCtx.drawImage(img, sx, sy, sw, sh, 0, 0, bgCols, bgRows);
      bgData = bgCtx.getImageData(0, 0, bgCols, bgRows).data;
    };
    img.src = BG_SRC;

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [width, height, pointerRef]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}
