'use client';
import { profileEffectFrame } from '../effectDiagnostics';


import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useLocale } from 'next-intl';
import type { PointerState } from '../engine';
import { createSongFireParams, type SongFireParams } from './params';
import { FIRE_LINES, pick } from './words';
import { hash1 } from './threadDraw';
import { makeGlowSprite } from './sprites';
import { getSongFireLayout } from './songFireLayout';

export { createSongFireParams, type SongFireParams } from './params';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth01 = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

type Flame = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number };
type Ember = { x: number; y: number; vx: number; vy: number; life: number; max: number; phase: number };
type Letter = {
  ch: string;
  tx: number;
  ty: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** waiting, rising toward its place, placed, flying away. */
  state: 0 | 1 | 2 | 3;
  age: number;
  placedAt: number;
  phase: number;
};

const MAX_FLAMES = 130;
const MAX_EMBERS = 70;

/** The static night: sky, stars, hills, a forest, a crowd of singers. Drawn once. */
function paintNight(canvas: HTMLCanvasElement, width: number, height: number, dpr: number, ground: number, fireX: number, stars: number, decor: Decor) {
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  const sky = g.createLinearGradient(0, 0, 0, ground);
  sky.addColorStop(0, '#080720');
  sky.addColorStop(0.55, '#231240');
  sky.addColorStop(0.9, '#5c2438');
  sky.addColorStop(1, '#8a3a2c');
  g.fillStyle = sky;
  g.fillRect(0, 0, width, height);
  const rnd = (k: number) => hash1(k * 1013 + 7);
  const starCount = Math.round((width * ground) / 5200 * stars);
  for (let i = 0; i < starCount; i += 1) {
    const y = rnd(i + 10) ** 1.6 * ground * 0.8;
    const a = 0.25 + rnd(i + 20) * 0.6;
    g.fillStyle = `rgba(255,244,220,${a})`;
    g.beginPath();
    g.arc(rnd(i) * width, y, 0.4 + rnd(i + 30) * 0.9, 0, Math.PI * 2);
    g.fill();
  }
  // The moon, with a halo and a few thin clouds across it.
  const moonX = width * 0.75;
  const moonY = ground * 0.24;
  const moonR = clamp(ground * 0.075, 9, 17);
  const halo = g.createRadialGradient(moonX, moonY, moonR * 0.6, moonX, moonY, moonR * 6);
  halo.addColorStop(0, 'rgba(255,240,205,0.32)');
  halo.addColorStop(1, 'rgba(255,240,205,0)');
  g.fillStyle = halo;
  g.fillRect(moonX - moonR * 6, moonY - moonR * 6, moonR * 12, moonR * 12);
  g.fillStyle = '#f7ecd0';
  g.beginPath();
  g.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(190,170,140,0.35)';
  for (const [dx, dy, r] of [[-0.35, -0.2, 0.28], [0.3, 0.25, 0.2], [0.1, -0.45, 0.14], [-0.2, 0.4, 0.16]]) {
    g.beginPath();
    g.arc(moonX + dx * moonR, moonY + dy * moonR, r * moonR, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(70,40,90,0.5)';
  for (const [dx, dy, w] of [[-1.6, 0.35, 5], [1.2, -0.3, 4]]) {
    g.beginPath();
    g.ellipse(moonX + dx * moonR, moonY + dy * moonR, moonR * w, moonR * 0.28, -0.05, 0, Math.PI * 2);
    g.fill();
  }
  // Hills, far to near, with a thin rim of the fire's light on the crests nearest to it.
  const hill = (color: string, base: number, amp: number, freq: number, phase: number) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, ground);
    for (let x = 0; x <= width; x += 10) g.lineTo(x, ground - base - amp * Math.sin(x * freq + phase) - amp * 0.5 * Math.sin(x * freq * 2.7 + phase * 2));
    g.lineTo(width, ground);
    g.fill();
  };
  hill('#3a1f44', 26, 12, 0.008, 1);
  hill('#2a1734', 16, 12, 0.011, 4);
  // A band of mist lying in the valley.
  const mist = g.createLinearGradient(0, ground - 34, 0, ground);
  mist.addColorStop(0, 'rgba(150,120,170,0)');
  mist.addColorStop(1, 'rgba(150,120,170,0.16)');
  g.fillStyle = mist;
  g.fillRect(0, ground - 34, width, 34);
  // The forest: three ranks of spruces, the nearest the darkest and tallest.
  for (let layer = 0; layer < 3; layer += 1) {
    g.fillStyle = ['#2a1838', '#1a1024', '#0b0710'][layer];
    for (let x = -10; x < width + 10; x += 6 + layer * 2) {
      const h = (10 + rnd(x * 3 + layer * 999) * 18) * (0.9 + layer * 0.3);
      const y = ground + 3;
      g.beginPath();
      g.moveTo(x - 4.5 - layer, y);
      g.lineTo(x, y - h);
      g.lineTo(x + 4.5 + layer, y);
      g.fill();
    }
  }
  // Ground.
  const soil = g.createLinearGradient(0, ground, 0, height);
  soil.addColorStop(0, '#120a10');
  soil.addColorStop(1, '#07040a');
  g.fillStyle = soil;
  g.fillRect(0, ground, width, Math.max(0, height - ground));

  // Poles with a string of lights (the bulbs are drawn every frame) and a line of bunting in the colours of the flag.
  g.lineCap = 'round';
  g.strokeStyle = '#0a060c';
  g.lineWidth = 2;
  for (const pole of decor.poles) {
    g.beginPath();
    g.moveTo(pole.x, ground + 6);
    g.lineTo(pole.x, pole.top - 2);
    g.stroke();
  }
  const catenary = (x1: number, x2: number, y: number, sag: number, t: number) => y + sag * 4 * t * (1 - t) + 0 * (x2 - x1);
  for (let i = 0; i < decor.poles.length - 1; i += 1) {
    const a = decor.poles[i];
    const b = decor.poles[i + 1];
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(10,6,12,0.9)';
    for (const [drop, sag] of [[0, decor.sag], [decor.flagDrop, decor.sag * 0.9]]) {
      g.beginPath();
      for (let k = 0; k <= 24; k += 1) {
        const t = k / 24;
        const x = a.x + (b.x - a.x) * t;
        const y = catenary(a.x, b.x, a.top + drop, sag, t);
        if (k === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    const flags = Math.max(2, Math.round((b.x - a.x) / 14));
    for (let k = 0; k < flags; k += 1) {
      const t = (k + 0.5) / flags;
      const x = a.x + (b.x - a.x) * t;
      const y = catenary(a.x, b.x, a.top + decor.flagDrop, decor.sag * 0.9, t);
      g.fillStyle = k % 2 === 0 ? '#9c2f3c' : '#e6dbc6';
      g.beginPath();
      g.moveTo(x - 5, y);
      g.lineTo(x + 5, y);
      g.lineTo(x, y + 10);
      g.closePath();
      g.fill();
      g.fillStyle = k % 2 === 0 ? 'rgba(240,200,120,0.8)' : 'rgba(156,47,60,0.8)';
      g.fillRect(x - 0.7, y + 2.5, 1.4, 1.4);
    }
  }

  // The choir: small figures, warmly lit the nearer they stand to the fire, some in wreaths, some with arms raised.
  for (let i = 0; i < Math.round(width / 15); i += 1) {
    const x = 10 + i * 15 + rnd(i + 500) * 8;
    if (Math.abs(x - fireX) < 26) continue;
    const s = 0.8 + rnd(i + 600) * 0.5;
    const y = ground + 5 + rnd(i + 700) * 9;
    const lit = clamp(1 - Math.abs(x - fireX) / (width * 0.45), 0, 1) ** 1.6;
    const body = `rgb(${Math.round(16 + 120 * lit)},${Math.round(9 + 46 * lit)},${Math.round(14 + 20 * lit)})`;
    g.fillStyle = body;
    g.strokeStyle = body;
    g.beginPath();
    g.arc(x, y - 11 * s, 2.6 * s, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(x - 3.4 * s, y);
    g.lineTo(x - 2.2 * s, y - 9 * s);
    g.lineTo(x + 2.2 * s, y - 9 * s);
    g.lineTo(x + 3.4 * s, y);
    g.fill();
    if (rnd(i + 800) < 0.3) {
      g.lineWidth = 1.2 * s;
      g.beginPath();
      g.moveTo(x - 2 * s, y - 8 * s);
      g.lineTo(x - 5 * s, y - 15 * s);
      g.moveTo(x + 2 * s, y - 8 * s);
      g.lineTo(x + 5 * s, y - 15 * s);
      g.stroke();
    }
    if (rnd(i + 900) < 0.55) {
      // A wreath of oak leaves and flowers.
      g.strokeStyle = `rgba(${Math.round(90 + 100 * lit)},${Math.round(130 + 60 * lit)},${Math.round(60 + 30 * lit)},0.95)`;
      g.lineWidth = 1.1 * s;
      g.beginPath();
      g.arc(x, y - 12.6 * s, 2.9 * s, Math.PI * 1.05, Math.PI * 1.95);
      g.stroke();
      g.fillStyle = `rgba(255,${Math.round(220 + 30 * lit)},${Math.round(150 + 40 * lit)},0.9)`;
      g.fillRect(x - 1.4 * s, y - 15.4 * s, 1.1 * s, 1.1 * s);
      g.fillRect(x + 1 * s, y - 15.3 * s, 1.1 * s, 1.1 * s);
    }
  }
}

/** Poles and their strings of lights, laid out the same way for the still picture and for the lights that flicker. */
export type Decor = {
  poles: Array<{ x: number; top: number }>;
  bulbs: Array<{ x: number; y: number; phase: number; tone: number }>;
  sag: number;
  flagDrop: number;
};

export function layoutDecor(width: number, ground: number, fireX: number): Decor {
  const top = ground - clamp(ground * 0.4, 50, 100);
  const sag = clamp(ground * 0.09, 8, 20);
  const flagDrop = clamp(ground * 0.09, 10, 18);
  const xs = [0.1, 0.32, 0.54].map((f) => width * f).filter((x) => Math.abs(x - fireX) > 80);
  const poles = xs.map((x) => ({ x, top }));
  const bulbs: Decor['bulbs'] = [];
  for (let i = 0; i < poles.length - 1; i += 1) {
    const a = poles[i];
    const b = poles[i + 1];
    const n = Math.max(3, Math.round((b.x - a.x) / 24));
    for (let k = 1; k < n; k += 1) {
      const t = k / n;
      bulbs.push({ x: a.x + (b.x - a.x) * t, y: a.top + sag * 4 * t * (1 - t) + 3, phase: hash1(i * 50 + k) * 6.28, tone: (i + k) % 4 });
    }
  }
  return { poles, bulbs, sag, flagDrop };
}

/**
 * "Костёр Праздника песни": a night, a choir in silhouette, a bonfire made of glowing particles. The fire's sparks
 * carry letters: they rise, find their places and spell a line in Latvian (with the translation below it), hold it,
 * and fly away as sparks again. The cursor is the wind: it leans the flames and blows sparks away.
 */
export function SongFireEffect({
  width,
  height,
  pointerRef,
  params,
  fullscreen = false,
}: {
  width: number;
  height: number;
  pointerRef: MutableRefObject<PointerState>;
  params?: SongFireParams;
  fullscreen?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uk = useLocale() === 'uk';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const p = params ?? createSongFireParams();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const { ground, fireX, fireY } = getSongFireLayout(width, height, fullscreen);
    const night = document.createElement('canvas');
    let builtStars = -1;
    const glowOrange = makeGlowSprite([255, 140, 40], 64, 0.2);
    const glowYellow = makeGlowSprite([255, 214, 110], 64, 0.3);
    const glowRed = makeGlowSprite([220, 60, 24], 64, 0.15);
    const glowLetter = makeGlowSprite([255, 170, 70], 64, 0.3);
    const glowBulbs = [makeGlowSprite([255, 214, 140], 32), makeGlowSprite([255, 110, 90], 32), makeGlowSprite([150, 220, 255], 32), makeGlowSprite([255, 190, 90], 32)];
    const glowFly = makeGlowSprite([200, 255, 120], 32, 0.2);
    const glowLantern = makeGlowSprite([255, 150, 60], 64, 0.3);

    // The night's small lives: lights on the poles, fireflies, sky lanterns, and now and then a shooting star.
    const decor = layoutDecor(width, ground, fireX);
    const flyCount = clamp(Math.round(width / 26), 14, 60);
    const flies = Array.from({ length: flyCount }, (_, i) => ({
      x: hash1(i * 3 + 1) * width,
      y: ground - 6 - hash1(i * 5 + 2) * ground * 0.55,
      phase: hash1(i * 7 + 3) * 6.28,
      speed: 0.12 + hash1(i * 11) * 0.22,
      range: 8 + hash1(i * 13) * 22,
    }));
    const lanterns = Array.from({ length: clamp(Math.round(width / 170), 3, 8) }, (_, i) => ({
      x: 40 + hash1(i * 17 + 5) * (width - 80),
      y: ground + 6 - hash1(i * 19 + 7) * ground * 0.7,
      vy: 8 + hash1(i * 23) * 8,
      sway: hash1(i * 29) * 6.28,
      size: 0.8 + hash1(i * 31) * 0.6,
    }));
    let shootTimer = 5;
    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;

    const flames: Flame[] = [];
    const embers: Ember[] = [];
    let flameAcc = 0;
    let emberAcc = 0;
    const fontSize = clamp(ground * 0.16, 17, 30);
    let letters: Letter[] = [];
    let lineIndex = 0;
    let phase: 'building' | 'holding' | 'leaving' = 'building';
    let phaseTime = 0;
    let emitAcc = 0;
    let order: number[] = [];
    let emitted = 0;
    let clock = 0;

    function startLine(index: number) {
      const line = FIRE_LINES[index % FIRE_LINES.length].lv;
      let size = fontSize;
      ctx!.font = `600 ${size}px Georgia, "Times New Roman", serif`;
      const maxWidth = Math.min(width * 0.52, 620);
      const full = ctx!.measureText(line).width;
      if (full > maxWidth) {
        size = (size * maxWidth) / full;
        ctx!.font = `600 ${size}px Georgia, "Times New Roman", serif`;
      }
      const total = ctx!.measureText(line).width;
      const left = clamp(width * 0.4 - total / 2, 200, Math.max(200, width - total - 200));
      const y = ground * 0.3 + 6;
      letters = [];
      for (let i = 0; i < line.length; i += 1) {
        if (line[i] === ' ') continue;
        const before = ctx!.measureText(line.slice(0, i)).width;
        const w = ctx!.measureText(line[i]).width;
        letters.push({ ch: line[i], tx: left + before + w / 2, ty: y, x: fireX, y: fireY, vx: 0, vy: 0, state: 0, age: 0, placedAt: 0, phase: hash1(i * 7 + index * 131) * 6.28 });
      }
      order = letters.map((_, i) => i).sort((a, b) => hash1(a * 17 + index * 31) - hash1(b * 17 + index * 31));
      emitted = 0;
      emitAcc = 0;
      phase = 'building';
      phaseTime = 0;
    }
    startLine(0);

    // Flames are sized by the scene: a taller card gets a bigger fire.
    const fireScale = clamp(ground / 150, 0.8, 1.7);

    function spawnFlame() {
      const spread = 34 * p.flame * fireScale;
      flames.push({
        x: fireX + (Math.random() - 0.5) * spread,
        y: fireY - 2 - Math.random() * 4,
        vx: (Math.random() - 0.5) * 12,
        vy: -(60 + Math.random() * 50) * p.flame * fireScale,
        life: 0,
        max: 0.8 + Math.random() * 0.7,
        size: (24 + Math.random() * 24) * p.flame * fireScale,
      });
    }

    function spawnEmber(power = 1) {
      embers.push({
        x: fireX + (Math.random() - 0.5) * 22 * p.flame,
        y: fireY - 12,
        vx: (Math.random() - 0.5) * 50,
        vy: -(70 + Math.random() * 110) * power,
        life: 0,
        max: 1.4 + Math.random() * 1.6,
        phase: Math.random() * 6.28,
      });
    }

    let windPush = 0;
    let lastCursor: { x: number; y: number } | null = null;
    let cursorSpeed = 0;

    function step(dt: number) {
      clock += dt;
      const cursor = pointerRef.current;
      // The wind: the flames lean away from the cursor, and a fast cursor blows harder.
      let target = 0;
      if (cursor.active) {
        const cx = cursor.x + width / 2;
        const cy = height / 2 - cursor.y;
        target = clamp((fireX - cx) / (width * 0.6), -1, 1) * p.wind * 55;
        if (lastCursor) cursorSpeed += (Math.hypot(cx - lastCursor.x, cy - lastCursor.y) / Math.max(dt, 1e-3) - cursorSpeed) * 0.2;
        lastCursor = { x: cx, y: cy };
      } else {
        lastCursor = null;
        cursorSpeed *= 0.9;
      }
      windPush += (target + Math.sin(clock * 0.8) * 6 - windPush) * Math.min(1, dt * 3);
      const gust = clamp(cursorSpeed / 900, 0, 1) * p.wind;

      flameAcc += dt * 95 * p.flame;
      while (flameAcc >= 1 && flames.length < MAX_FLAMES) {
        flameAcc -= 1;
        spawnFlame();
      }
      flameAcc = Math.min(flameAcc, 1);
      emberAcc += dt * 9 * p.sparks * (1 + gust * 3);
      while (emberAcc >= 1 && embers.length < MAX_EMBERS) {
        emberAcc -= 1;
        spawnEmber(1 + gust);
      }
      emberAcc = Math.min(emberAcc, 1);

      for (let i = flames.length - 1; i >= 0; i -= 1) {
        const f = flames[i];
        f.life += dt;
        if (f.life >= f.max) {
          flames.splice(i, 1);
          continue;
        }
        const k = f.life / f.max;
        // Flames pull in toward the middle as they rise, flicker sideways, and lean with the wind.
        f.vx += ((fireX - f.x) * 1.4 + Math.sin(clock * 9 + i) * 26 + windPush * 1.6 * k) * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }
      for (let i = embers.length - 1; i >= 0; i -= 1) {
        const e = embers[i];
        e.life += dt;
        if (e.life >= e.max || e.y < -10) {
          embers.splice(i, 1);
          continue;
        }
        e.vx += (windPush * 1.8 + Math.sin(clock * 3 + e.phase) * 40) * dt;
        e.vy += 26 * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      }

      // Sky lanterns drift up and sway; when one leaves the sky another lights on the ground.
      for (const l of lanterns) {
        l.y -= l.vy * dt;
        l.x += Math.sin(clock * 0.5 + l.sway) * 6 * dt + windPush * 0.05 * dt;
        if (l.y < -20) {
          l.y = ground + 8;
          l.x = 40 + Math.random() * (width - 80);
        }
      }
      shootTimer -= dt;
      if (shootTimer <= 0 && !shoot) {
        shoot = { x: width * (0.55 + Math.random() * 0.4), y: Math.random() * ground * 0.3, vx: -(380 + Math.random() * 160), vy: 120 + Math.random() * 80, life: 0 };
        shootTimer = 8 + Math.random() * 8;
      }
      if (shoot) {
        shoot.life += dt;
        shoot.x += shoot.vx * dt;
        shoot.y += shoot.vy * dt;
        if (shoot.life > 0.7) shoot = null;
      }

      // The letters.
      phaseTime += dt;
      if (phase === 'building') {
        emitAcc += dt * 5.5 * p.letters;
        while (emitAcc >= 1 && emitted < order.length) {
          emitAcc -= 1;
          const l = letters[order[emitted]];
          l.state = 1;
          l.x = fireX + (Math.random() - 0.5) * 16;
          l.y = fireY - 14;
          l.vx = (Math.random() - 0.5) * 60;
          l.vy = -(90 + Math.random() * 60);
          l.age = 0;
          emitted += 1;
        }
        let placed = 0;
        for (const l of letters) {
          if (l.state === 1) {
            l.age += dt;
            // Rise like a spark for a moment, then steer for the place.
            const steer = smooth01((l.age - 0.35) / 0.9);
            const ax = (l.tx - l.x) * (2 + steer * 22) + windPush * 0.5 * (1 - steer) + Math.sin(clock * 5 + l.phase) * 30 * (1 - steer);
            const ay = (l.ty - l.y) * (2 + steer * 22) - 40 * (1 - steer);
            l.vx += ax * dt;
            l.vy += ay * dt;
            const damp = Math.exp(-dt * (1.2 + steer * 7));
            l.vx *= damp;
            l.vy *= damp;
            l.x += l.vx * dt;
            l.y += l.vy * dt;
            if (steer > 0.99 && Math.hypot(l.tx - l.x, l.ty - l.y) < 1.2 && Math.hypot(l.vx, l.vy) < 14) {
              l.state = 2;
              l.placedAt = clock;
              l.x = l.tx;
              l.y = l.ty;
            }
          }
          if (l.state === 2) placed += 1;
        }
        if (placed === letters.length) {
          phase = 'holding';
          phaseTime = 0;
        }
      } else if (phase === 'holding') {
        if (phaseTime > p.hold) {
          phase = 'leaving';
          phaseTime = 0;
          for (const l of letters) {
            l.state = 3;
            l.vx = (Math.random() - 0.3) * 70 + windPush;
            l.vy = -(30 + Math.random() * 70);
          }
        }
      } else {
        for (const l of letters) {
          l.vx += (Math.sin(clock * 3 + l.phase) * 40 + windPush * 1.5) * dt;
          l.x += l.vx * dt;
          l.y += l.vy * dt;
        }
        if (phaseTime > 1.6) {
          lineIndex += 1;
          startLine(lineIndex);
        }
      }
    }

    function render() {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (p.stars !== builtStars) {
        builtStars = p.stars;
        paintNight(night, width, height, dpr, ground, fireX, p.stars, decor);
      }
      ctx!.drawImage(night, 0, 0, width, height);
      const flicker = 0.85 + 0.15 * Math.sin(clock * 11) * Math.sin(clock * 4.3);

      ctx!.globalCompositeOperation = 'lighter';
      // The fire's light on the ground and the trees.
      const light = ctx!.createRadialGradient(fireX, fireY - 10, 0, fireX, fireY - 10, ground * 0.9);
      light.addColorStop(0, `rgba(255,150,50,${0.42 * flicker})`);
      light.addColorStop(0.4, `rgba(220,80,30,${0.16 * flicker})`);
      light.addColorStop(1, 'rgba(120,30,10,0)');
      ctx!.fillStyle = light;
      ctx!.fillRect(0, 0, width, height);

      for (const f of flames) {
        const k = f.life / f.max;
        const s = f.size * (1 - k * 0.65) * 2;
        const sprite = k < 0.25 ? glowYellow : k < 0.65 ? glowOrange : glowRed;
        ctx!.globalAlpha = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * 0.5;
        ctx!.drawImage(sprite, f.x - s / 2, f.y - s / 2, s, s);
      }
      // A white-hot core.
      ctx!.globalAlpha = 0.34 * flicker;
      const core = 28 * p.flame * fireScale;
      ctx!.drawImage(glowYellow, fireX - core, fireY - core * 1.2, core * 2, core * 1.7);

      for (const e of embers) {
        const k = e.life / e.max;
        const tw = 0.6 + 0.4 * Math.sin(clock * 20 + e.phase);
        ctx!.globalAlpha = (1 - k) * tw;
        ctx!.fillStyle = k < 0.4 ? '#ffe9a8' : '#ff9a3c';
        ctx!.fillRect(e.x - 0.8, e.y - 0.8, 1.6, 1.6);
        ctx!.globalAlpha = (1 - k) * 0.35;
        ctx!.fillRect(e.x - e.vx * 0.03 - 0.5, e.y - e.vy * 0.03 - 0.5, 1, 1);
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = 'source-over';

      // Sky lanterns: a small paper box, lit from inside.
      for (const l of lanterns) {
        const w = 8 * l.size;
        const h = 11 * l.size;
        const fade = clamp((l.y + 20) / 50, 0, 1) * clamp((ground + 10 - l.y) / 20, 0, 1);
        ctx!.globalAlpha = 0.95 * fade;
        const paper = ctx!.createLinearGradient(0, l.y - h / 2, 0, l.y + h / 2);
        paper.addColorStop(0, '#ffcf80');
        paper.addColorStop(1, '#ff7a30');
        ctx!.fillStyle = paper;
        ctx!.beginPath();
        ctx!.moveTo(l.x - w * 0.42, l.y - h / 2);
        ctx!.lineTo(l.x + w * 0.42, l.y - h / 2);
        ctx!.lineTo(l.x + w / 2, l.y + h / 2);
        ctx!.lineTo(l.x - w / 2, l.y + h / 2);
        ctx!.closePath();
        ctx!.fill();
      }
      ctx!.globalCompositeOperation = 'lighter';
      for (const l of lanterns) {
        const fade = clamp((l.y + 20) / 50, 0, 1) * clamp((ground + 10 - l.y) / 20, 0, 1);
        const gs = 46 * l.size;
        ctx!.globalAlpha = 0.55 * fade * (0.85 + 0.15 * Math.sin(clock * 6 + l.sway));
        ctx!.drawImage(glowLantern, l.x - gs / 2, l.y - gs / 2, gs, gs);
      }
      // The lights on the poles, each flickering on its own.
      for (const b of decor.bulbs) {
        ctx!.globalAlpha = 0.45 + 0.4 * Math.sin(clock * 2.6 + b.phase);
        ctx!.drawImage(glowBulbs[b.tone], b.x - 9, b.y - 9, 18, 18);
        ctx!.globalAlpha = 0.9;
        ctx!.fillStyle = '#fff4d8';
        ctx!.fillRect(b.x - 0.8, b.y - 0.8, 1.6, 1.6);
      }
      // Fireflies of St John's night.
      for (const f of flies) {
        const x = f.x + Math.sin(clock * f.speed + f.phase) * f.range + Math.sin(clock * 0.7 + f.phase * 2) * 4;
        const y = f.y + Math.cos(clock * f.speed * 1.3 + f.phase) * f.range * 0.5;
        const pulse = Math.max(0, Math.sin(clock * 1.6 + f.phase * 3));
        ctx!.globalAlpha = pulse ** 2 * 0.95;
        ctx!.drawImage(glowFly, x - 6, y - 6, 12, 12);
      }
      if (shoot) {
        const k = shoot.life / 0.7;
        const tail = 70;
        const nx = shoot.vx / Math.hypot(shoot.vx, shoot.vy);
        const ny = shoot.vy / Math.hypot(shoot.vx, shoot.vy);
        const streak = ctx!.createLinearGradient(shoot.x, shoot.y, shoot.x - nx * tail, shoot.y - ny * tail);
        streak.addColorStop(0, 'rgba(255,248,230,0.95)');
        streak.addColorStop(1, 'rgba(255,248,230,0)');
        ctx!.globalAlpha = 1 - k;
        ctx!.strokeStyle = streak;
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        ctx!.moveTo(shoot.x, shoot.y);
        ctx!.lineTo(shoot.x - nx * tail, shoot.y - ny * tail);
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = 'source-over';

      // Logs.
      ctx!.fillStyle = '#1c0e08';
      ctx!.save();
      ctx!.translate(fireX, fireY + 2);
      for (const a of [-0.32, 0.32]) {
        ctx!.save();
        ctx!.rotate(a);
        ctx!.fillRect(-26 * p.flame * fireScale, -3.5 * fireScale, 52 * p.flame * fireScale, 7 * fireScale);
        ctx!.restore();
      }
      ctx!.restore();

      // The letters.
      let lineFont = fontSize;
      ctx!.font = `600 ${lineFont}px Georgia, "Times New Roman", serif`;
      const line = FIRE_LINES[lineIndex % FIRE_LINES.length];
      const maxWidth = Math.min(width * 0.52, 620);
      const full = ctx!.measureText(line.lv).width;
      if (full > maxWidth) lineFont = (lineFont * maxWidth) / full;
      ctx!.font = `600 ${lineFont}px Georgia, "Times New Roman", serif`;
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      for (const l of letters) {
        if (l.state === 0) continue;
        let alpha = 1;
        if (l.state === 3) alpha = clamp(1 - phaseTime / 1.5, 0, 1);
        const glow = l.state === 2 ? 0.5 + 0.5 * Math.exp(-(clock - l.placedAt) * 1.6) : 0.9;
        ctx!.globalCompositeOperation = 'lighter';
        ctx!.globalAlpha = alpha * glow * 0.5;
        const gs = lineFont * 2.1;
        ctx!.drawImage(glowLetter, l.x - gs / 2, l.y - gs / 2, gs, gs);
        ctx!.globalCompositeOperation = 'source-over';
        ctx!.globalAlpha = alpha;
        ctx!.shadowColor = 'rgba(255,150,50,0.9)';
        ctx!.shadowBlur = 7;
        ctx!.fillStyle = l.state === 2 ? '#ffeec2' : '#ffd27a';
        ctx!.fillText(l.ch, l.x, l.y + (l.state === 2 ? Math.sin(clock * 2 + l.phase) * 0.4 : 0));
        ctx!.shadowBlur = 0;
      }
      ctx!.globalAlpha = 1;
      // The translation, once the line is complete.
      const showTranslation = phase === 'holding' ? smooth01(phaseTime / 0.8) : phase === 'leaving' ? 1 - smooth01(phaseTime / 0.8) : 0;
      if (showTranslation > 0.01 && letters.length > 0) {
        const left = letters[0].tx;
        const right = letters[letters.length - 1].tx;
        ctx!.font = `italic 500 ${lineFont * 0.66}px Georgia, "Times New Roman", serif`;
        ctx!.globalAlpha = showTranslation * 0.9;
        ctx!.fillStyle = '#f4e6cc';
        ctx!.shadowColor = 'rgba(0,0,0,0.7)';
        ctx!.shadowBlur = 4;
        ctx!.fillText(pick(line, uk), (left + right) / 2, letters[0].ty + lineFont * 1.25);
        ctx!.shadowBlur = 0;
        ctx!.globalAlpha = 1;
      }
      ctx!.textAlign = 'start';
    }

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      for (let i = 0; i < 90; i += 1) step(1 / 30);
      for (const l of letters) {
        l.state = 2;
        l.x = l.tx;
        l.y = l.ty;
        l.placedAt = -10;
      }
      phase = 'holding';
      phaseTime = 1;
      render();
      return;
    }

    let rafId = 0;
    let last = 0;
    const loop = profileEffectFrame(canvas, (time: number) => {
      rafId = requestAnimationFrame(loop);
      const dt = last ? Math.min((time - last) / 1000, 0.05) : 0.016;
      last = time;
      step(dt);
      render();
    });
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [width, height, pointerRef, params, uk, fullscreen]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}
