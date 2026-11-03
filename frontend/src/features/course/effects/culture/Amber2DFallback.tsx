'use client';
import { profileEffectFrame } from '../effectDiagnostics';


import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useLocale } from 'next-intl';
import type { PointerState } from '../engine';
import { createAmberParams, type AmberParams } from './params';
import { AMBER_LETTERS, AMBER_WORDS, pick, type Bilingual } from './words';
import { hash1 } from './threadDraw';
import { makeSparkleSprite } from './sprites';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth01 = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

type Sprite = { canvas: HTMLCanvasElement; w: number; h: number };

/** Text drawn into a small canvas, sharp or blurred (the blur is drawn as a shadow, which every browser can do). */
function textSprite(text: string, px: number, fill: string, blur: number, italic: boolean, dpr: number): Sprite {
  const font = `${italic ? 'italic ' : ''}600 ${px}px Georgia, "Times New Roman", serif`;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = font;
  const textWidth = Math.ceil(probe.measureText(text).width);
  const pad = Math.ceil(blur * 3 + 4);
  const w = textWidth + pad * 2;
  const h = Math.ceil(px * 1.4) + pad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * dpr);
  canvas.height = Math.ceil(h * dpr);
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  g.font = font;
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  if (blur > 0) {
    // Draw the text far off to the side and let only its shadow land on the canvas.
    g.shadowColor = fill;
    g.shadowBlur = blur * 2;
    g.shadowOffsetX = 2000;
    g.fillStyle = fill;
    g.fillText(text, w / 2 - 2000, h / 2);
    g.fillText(text, w / 2 - 2000, h / 2);
  } else {
    g.fillStyle = fill;
    g.fillText(text, w / 2, h / 2);
  }
  return { canvas, w, h };
}

type Item = {
  text: string;
  meaning: Bilingual | null;
  x: number;
  y: number;
  z: number;
  angle: number;
  phase: number;
  /** Dark, blurred a little, blurred more, and the lit copy that glows under the lamp. */
  dark: [Sprite, Sprite, Sprite];
  lit: Sprite;
};

/** The amber itself: gradient, clouds, flow lines, bubbles, flecks, sun spangles, a glassy rim. Drawn once. */
function paintAmber(canvas: HTMLCanvasElement, width: number, height: number, dpr: number, inclusions: number) {
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  const body = g.createLinearGradient(0, 0, width, height);
  body.addColorStop(0, '#f6c766');
  body.addColorStop(0.35, '#e79a26');
  body.addColorStop(0.7, '#c8710f');
  body.addColorStop(1, '#8e4308');
  g.fillStyle = body;
  g.fillRect(0, 0, width, height);
  const rnd = (k: number) => hash1(k * 977 + 13);
  // Clouds: big soft patches, lighter and darker.
  for (let i = 0; i < 46; i += 1) {
    const x = rnd(i) * width;
    const y = rnd(i + 100) * height;
    const r = (0.08 + rnd(i + 200) * 0.22) * Math.max(width, height * 2.4);
    const light = rnd(i + 300) > 0.5;
    const cloud = g.createRadialGradient(x, y, 0, x, y, r);
    cloud.addColorStop(0, light ? 'rgba(255,224,140,0.16)' : 'rgba(110,44,4,0.16)');
    cloud.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = cloud;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Flow lines of the resin: long curves, very faint.
  g.lineCap = 'round';
  for (let i = 0; i < 16; i += 1) {
    const y0 = rnd(i + 400) * height;
    g.strokeStyle = rnd(i + 500) > 0.5 ? 'rgba(255,230,160,0.07)' : 'rgba(90,30,0,0.07)';
    g.lineWidth = 10 + rnd(i + 600) * 40;
    g.beginPath();
    g.moveTo(-20, y0);
    g.bezierCurveTo(width * 0.3, y0 + (rnd(i + 700) - 0.5) * height, width * 0.6, y0 + (rnd(i + 800) - 0.5) * height, width + 20, y0 + (rnd(i + 900) - 0.5) * height * 0.6);
    g.stroke();
  }
  const scale = Math.max(0.5, (width * height) / (1100 * 190));
  // Bubbles.
  const bubbles = Math.round(70 * inclusions * Math.min(scale, 3));
  for (let i = 0; i < bubbles; i += 1) {
    const x = rnd(i + 1000) * width;
    const y = rnd(i + 1100) * height;
    const r = 0.8 + rnd(i + 1200) ** 2 * 3.6;
    const bubble = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    bubble.addColorStop(0, 'rgba(255,240,200,0.55)');
    bubble.addColorStop(0.7, 'rgba(255,200,110,0.12)');
    bubble.addColorStop(1, 'rgba(120,50,0,0.4)');
    g.fillStyle = bubble;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Flecks of bark and dust.
  g.fillStyle = 'rgba(70,24,0,0.55)';
  const flecks = Math.round(90 * inclusions * Math.min(scale, 3));
  for (let i = 0; i < flecks; i += 1) {
    g.beginPath();
    g.ellipse(rnd(i + 2000) * width, rnd(i + 2100) * height, 0.4 + rnd(i + 2200) * 1.4, 0.3 + rnd(i + 2300) * 0.8, rnd(i + 2400) * 3, 0, Math.PI * 2);
    g.fill();
  }
  // Sun spangles: flat discs of tiny cracks that catch the light.
  const spangles = inclusions > 0 ? 2 + Math.round(scale) : 0;
  for (let i = 0; i < spangles; i += 1) {
    const x = (0.12 + rnd(i + 3000) * 0.76) * width;
    const y = (0.2 + rnd(i + 3100) * 0.6) * height;
    const rx = 18 + rnd(i + 3200) * 26;
    g.save();
    g.translate(x, y);
    g.rotate((rnd(i + 3300) - 0.5) * 0.5);
    g.scale(1, 0.32);
    g.strokeStyle = 'rgba(255,236,170,0.5)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(0, 0, rx, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 0.8;
    for (let k = 0; k < 26; k += 1) {
      const a = (k / 26) * Math.PI * 2 + rnd(i * 50 + k) * 0.2;
      const r0 = rx * (0.15 + rnd(i * 60 + k) * 0.2);
      g.strokeStyle = `rgba(255,${226 + Math.round(rnd(k) * 20)},${150 + Math.round(rnd(k + 9) * 40)},${0.25 + rnd(k + 20) * 0.3})`;
      g.beginPath();
      g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      g.lineTo(Math.cos(a) * rx * (0.7 + rnd(i * 70 + k) * 0.28), Math.sin(a) * rx * (0.7 + rnd(i * 70 + k) * 0.28));
      g.stroke();
    }
    g.restore();
  }
  // The glassy skin: a dark edge, a bright bevel along the top and left.
  const edge = g.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.45, width / 2, height / 2, Math.max(width, height) * 0.65);
  edge.addColorStop(0, 'rgba(60,20,0,0)');
  edge.addColorStop(1, 'rgba(60,20,0,0.5)');
  g.fillStyle = edge;
  g.fillRect(0, 0, width, height);
  const bevel = g.createLinearGradient(0, 0, 0, Math.min(height, 46));
  bevel.addColorStop(0, 'rgba(255,246,210,0.42)');
  bevel.addColorStop(1, 'rgba(255,246,210,0)');
  g.fillStyle = bevel;
  g.fillRect(0, 0, width, Math.min(height, 46));
  const bevelLeft = g.createLinearGradient(0, 0, 26, 0);
  bevelLeft.addColorStop(0, 'rgba(255,240,200,0.3)');
  bevelLeft.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = bevelLeft;
  g.fillRect(0, 0, 26, height);
}

/**
 * The 2D version of "Янтарь со словами" (used when WebGL 2 is missing): the card is a slab of Baltic amber with Latvian words and letters frozen in it at different
 * depths (deeper ones are dimmer, blurred and move less when the cursor moves). The cursor carries a warm lamp:
 * words in its light come into focus, glow and drift toward it, cracks sparkle, and the nearest word shows what it
 * means. When the cursor is away the lamp wanders by itself.
 */
export function AmberFallback({
  width,
  height,
  pointerRef,
  params,
}: {
  width: number;
  height: number;
  pointerRef: MutableRefObject<PointerState>;
  params?: AmberParams;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uk = useLocale() === 'uk';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const p = params ?? createAmberParams();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const base = document.createElement('canvas');
    let builtInclusions = -1;
    let builtWords = -1;
    let items: Item[] = [];
    const sparkle = makeSparkleSprite();
    const scale = clamp(height / 190, 0.85, 1.35);

    // Bright points in the cracks (where the spangles are, and a few more): they twinkle under the lamp.
    const glints = Array.from({ length: 40 }, (_, i) => ({ x: hash1(i * 31 + 5) * width, y: hash1(i * 17 + 9) * height, phase: hash1(i) * 6.28 }));

    function build() {
      builtInclusions = p.inclusions;
      builtWords = p.words;
      paintAmber(base, width, height, dpr, p.inclusions);
      const count = clamp(Math.round((p.words * width * height) / (1100 * 190)), 6, 120);
      items = [];
      // A jittered grid, so that words spread over the slab instead of clumping.
      const cols = Math.max(2, Math.round(Math.sqrt((count * width) / height)));
      const rows = Math.max(1, Math.ceil(count / cols));
      for (let i = 0; i < count; i += 1) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const isLetter = hash1(i * 13 + 2) < 0.22;
        const z = hash1(i * 7 + 1);
        const meaning = isLetter ? null : AMBER_WORDS[Math.floor(hash1(i * 5 + 3) * AMBER_WORDS.length)];
        const text = isLetter ? AMBER_LETTERS[Math.floor(hash1(i * 3 + 4) * AMBER_LETTERS.length)] : meaning!.lv;
        const px = (isLetter ? 36 : 17) * scale * (1.15 - 0.4 * z) * (isLetter ? 1 : 1 + hash1(i * 11) * 0.35);
        const dark = (blur: number) => textSprite(text, px, 'rgba(70,24,4,0.9)', blur, isLetter, dpr);
        items.push({
          text,
          meaning,
          x: ((col + 0.5 + (hash1(i * 19 + 6) - 0.5) * 0.7) / cols) * width,
          y: ((row + 0.5 + (hash1(i * 23 + 8) - 0.5) * 0.7) / rows) * height,
          z,
          angle: (hash1(i * 29 + 7) - 0.5) * 0.7,
          phase: hash1(i * 37 + 9) * 6.28,
          dark: [dark(0), dark(1.6), dark(3.4)],
          lit: textSprite(text, px, '#fff3c8', 0, isLetter, dpr),
        });
      }
    }
    build();

    const lamp = { x: width * 0.5, y: height * 0.45, tx: width * 0.5, ty: height * 0.45 };
    const parallax = { x: 0, y: 0 };
    let clock = 0;

    function pill(x: number, y: number, w: number, h: number) {
      const r = h / 2;
      ctx!.beginPath();
      ctx!.moveTo(x + r, y);
      ctx!.lineTo(x + w - r, y);
      ctx!.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
      ctx!.lineTo(x + r, y + h);
      ctx!.arc(x + r, y + r, r, Math.PI / 2, (Math.PI * 3) / 2);
      ctx!.closePath();
    }

    function render(t: number, pointerOn: boolean) {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.drawImage(base, 0, 0, width, height);
      const radius = clamp(height * 0.75, 100, 230) * p.lamp;

      // The lamp's light on the amber.
      ctx!.globalCompositeOperation = 'lighter';
      const halo = ctx!.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, radius * 1.3);
      halo.addColorStop(0, `rgba(255,236,170,${0.5 * p.glow})`);
      halo.addColorStop(0.35, `rgba(255,190,80,${0.22 * p.glow})`);
      halo.addColorStop(1, 'rgba(255,150,40,0)');
      ctx!.fillStyle = halo;
      ctx!.fillRect(0, 0, width, height);
      ctx!.globalCompositeOperation = 'source-over';

      // The words, farthest first.
      let nearest: Item | null = null;
      let nearestD = radius * 0.5;
      let nearestX = 0;
      let nearestY = 0;
      const order = [...items].sort((a, b) => b.z - a.z);
      for (const it of order) {
        const drift = 1 - it.z * 0.5;
        const ox = it.x + Math.sin(t * 0.13 + it.phase) * 9 * drift - parallax.x * (1 - it.z) * 26 * p.parallax;
        const oy = it.y + Math.cos(t * 0.11 + it.phase * 1.3) * 6 * drift - parallax.y * (1 - it.z) * 16 * p.parallax;
        const dist = Math.hypot(ox - lamp.x, oy - lamp.y);
        const k = smooth01(1 - dist / radius);
        const x = ox + (lamp.x - ox) * 0.05 * k;
        const y = oy + (lamp.y - oy) * 0.05 * k;
        const angle = it.angle + Math.sin(t * 0.2 + it.phase) * 0.06;
        const level = k > 0.5 ? 0 : it.z > 0.66 ? 2 : it.z > 0.33 ? 1 : 0;
        const sprite = it.dark[level];
        ctx!.save();
        ctx!.translate(x, y);
        ctx!.rotate(angle);
        ctx!.globalAlpha = (0.78 - it.z * 0.42) * (1 - k * 0.3);
        ctx!.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h / 2, sprite.w, sprite.h);
        if (k > 0.02) {
          ctx!.globalCompositeOperation = 'lighter';
          ctx!.globalAlpha = k * 0.95 * p.glow;
          ctx!.drawImage(it.lit.canvas, -it.lit.w / 2, -it.lit.h / 2, it.lit.w, it.lit.h);
        }
        ctx!.restore();
        if (it.meaning && dist < nearestD) {
          nearest = it;
          nearestD = dist;
          nearestX = x;
          nearestY = y;
        }
      }
      ctx!.globalAlpha = 1;

      // Cracks that sparkle in the lamp's light.
      if (p.sparkle > 0) {
        ctx!.globalCompositeOperation = 'lighter';
        for (const gl of glints) {
          const k = smooth01(1 - Math.hypot(gl.x - lamp.x, gl.y - lamp.y) / radius);
          if (k < 0.05) continue;
          const tw = 0.5 + 0.5 * Math.sin(t * 4 + gl.phase);
          const size = (8 + 16 * k) * (0.6 + tw * 0.6);
          ctx!.globalAlpha = k * tw * 0.9 * p.sparkle;
          ctx!.drawImage(sparkle, gl.x - size / 2, gl.y - size / 2, size, size);
        }
        ctx!.globalAlpha = 1;
        ctx!.globalCompositeOperation = 'source-over';
      }

      // What the nearest word means.
      if (nearest && pointerOn) {
        const it: Item = nearest;
        const label = `${it.text} — ${pick(it.meaning!, uk)}`;
        ctx!.font = `600 ${clamp(13 * scale, 12, 16)}px Georgia, "Times New Roman", serif`;
        const w = ctx!.measureText(label).width + 20;
        const h = 24;
        const x = clamp(nearestX - w / 2, 6, width - w - 6);
        const y = clamp(nearestY + 20, 4, height - h - 4);
        pill(x, y, w, h);
        ctx!.fillStyle = 'rgba(52,18,2,0.78)';
        ctx!.fill();
        ctx!.strokeStyle = 'rgba(255,214,120,0.7)';
        ctx!.lineWidth = 1;
        ctx!.stroke();
        ctx!.fillStyle = '#fff1c8';
        ctx!.textBaseline = 'middle';
        ctx!.fillText(label, x + 10, y + h / 2 + 0.5);
      }

      // A broad glare across the glassy surface that slides with the lamp.
      ctx!.globalCompositeOperation = 'lighter';
      const gx = width * 0.2 + (lamp.x / width) * width * 0.6;
      const glare = ctx!.createLinearGradient(gx - 70, 0, gx + 70, height * 0.6);
      glare.addColorStop(0, 'rgba(255,240,200,0)');
      glare.addColorStop(0.5, `rgba(255,240,200,${0.09 * p.glow})`);
      glare.addColorStop(1, 'rgba(255,240,200,0)');
      ctx!.fillStyle = glare;
      ctx!.fillRect(0, 0, width, height);
      ctx!.globalCompositeOperation = 'source-over';
    }

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      render(0, false);
      return;
    }

    let rafId = 0;
    let last = 0;
    const loop = profileEffectFrame(canvas, (time: number) => {
      rafId = requestAnimationFrame(loop);
      const dt = last ? Math.min((time - last) / 1000, 0.05) : 0.016;
      last = time;
      clock += dt;
      if (p.inclusions !== builtInclusions || p.words !== builtWords) build();
      const cursor = pointerRef.current;
      if (cursor.active) {
        lamp.tx = cursor.x + width / 2;
        lamp.ty = height / 2 - cursor.y;
      } else {
        // Idle: the lamp wanders slowly over the slab.
        lamp.tx = width * (0.5 + 0.36 * Math.sin(clock * 0.21));
        lamp.ty = height * (0.5 + 0.3 * Math.sin(clock * 0.33 + 1));
      }
      const follow = 1 - Math.exp(-dt * (cursor.active ? 9 : 2));
      lamp.x += (lamp.tx - lamp.x) * follow;
      lamp.y += (lamp.ty - lamp.y) * follow;
      const sx = (lamp.x / width - 0.5) * 2;
      const sy = (lamp.y / height - 0.5) * 2;
      parallax.x += (sx - parallax.x) * Math.min(1, dt * 3);
      parallax.y += (sy - parallax.y) * Math.min(1, dt * 3);
      render(clock, cursor.active);
    });
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [width, height, pointerRef, params, uk]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}
