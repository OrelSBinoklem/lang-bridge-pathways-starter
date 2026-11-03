'use client';
import { profileEffectFrame } from './effectDiagnostics';


import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEffectHost, effectBounds, effectPoint, observeEffectSize } from './EffectHost';
import { createSakuraParams, type SakuraTuningParams } from './SakuraEffect';
import { PAGE_CONTROLS } from './scenes/BodySceneEffect';

type Rgb = [number, number, number];
type Palette = { top: Rgb; horizon: Rgb; distant: Rgb; near: Rgb; meadow: Rgb; light: Rgb };
type Petal = { x: number; y: number; size: number; speed: number; drift: number; phase: number; turn: number; tint: number };
type BlownPetal = Petal & { vx: number; vy: number; spin: number; life: number };
type TreeSegment = { x: number; y: number; endX: number; endY: number; controlX: number; controlY: number; thickness: number; depth: number };
/** `level` is how open the blossom is: 1 in full flower, 0 blown bare; it grows back from `regrowAt` (seconds). */
type TreeFlower = { x: number; y: number; size: number; variant: number; haze: boolean; level: number; regrowAt: number };
type TreeBranch = {
  depth: number;
  pivotX: number;
  pivotY: number;
  phase: number;
  segments: TreeSegment[];
  flowers: TreeFlower[];
  children: TreeBranch[];
};
type RenderBranch = {
  depth: number;
  pivotX: number;
  pivotY: number;
  phase: number;
  canvas: HTMLCanvasElement;
  left: number;
  top: number;
  width: number;
  height: number;
  flowers: TreeFlower[];
  children: RenderBranch[];
};

const BLOSSOM_VARIANTS = 10;
const SPRITE_SIZE = 14;
const MAX_BLOWN = 360;
const REGROW_DELAY = 2.5;
const REGROW_TIME = 10;

/** Grows a stripped blossom back from a bud: nothing at 0, a slight overshoot as it opens, full at 1. */
const budToBloom = (level: number) => (level >= 1 ? 1 : 1 + 2.2 * (level - 1) ** 3 + 1.2 * (level - 1) ** 2);

const PALETTES: Palette[] = [
  { top: [102, 129, 163], horizon: [255, 199, 166], distant: [143, 158, 166], near: [92, 133, 118], meadow: [66, 99, 82], light: [255, 220, 174] },
  { top: [68, 153, 204], horizon: [209, 237, 234], distant: [116, 169, 179], near: [65, 126, 104], meadow: [50, 101, 78], light: [255, 243, 198] },
  { top: [63, 79, 133], horizon: [244, 139, 118], distant: [124, 111, 143], near: [63, 93, 106], meadow: [38, 78, 73], light: [255, 182, 119] },
  { top: [15, 27, 64], horizon: [55, 64, 110], distant: [59, 72, 104], near: [35, 62, 82], meadow: [26, 51, 62], light: [220, 230, 255] },
];

function random(seed: number) {
  let value = seed;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(a: number, b: number, t: number) { return Math.round(a + (b - a) * t); }
function rgb(color: Rgb, alpha = 1) { return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`; }
export function paletteAt(phase: number): Palette {
  const at = ((phase % 1) + 1) % 1 * 4;
  const a = PALETTES[Math.floor(at)];
  const b = PALETTES[(Math.floor(at) + 1) % 4];
  const t = at - Math.floor(at);
  return Object.fromEntries((Object.keys(a) as (keyof Palette)[]).map(key => [
    key, a[key].map((channel, i) => mix(channel, b[key][i], t)) as Rgb,
  ])) as Palette;
}

function localTimePhase(date: Date) {
  let hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  if (hour < 5) hour += 24;
  const marks = [[5, 0], [10, 0.25], [17, 0.5], [21, 0.75], [29, 1]];
  for (let i = 0; i < marks.length - 1; i++) {
    if (hour <= marks[i + 1][0]) {
      const t = (hour - marks[i][0]) / (marks[i + 1][0] - marks[i][0]);
      return marks[i][1] + t * (marks[i + 1][1] - marks[i][1]);
    }
  }
  return 0;
}

export function currentPhase(params: SakuraTuningParams, elapsed: number) {
  if (params.timeMode === 'auto') return localTimePhase(new Date());
  if (params.timeMode === 'cycle') return (elapsed / Math.max(20, params.cycleSeconds)) % 1;
  return { dawn: 0, day: 0.25, dusk: 0.5, night: 0.75 }[params.timeMode] ?? 0;
}

function drawBlossom(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rand: () => number) {
  const turn = rand() * Math.PI * 2;
  const shade = rand();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.fillStyle = shade < 0.28 ? '#fff0f4' : shade < 0.72 ? '#ffd2e3' : '#f5a9c7';
  ctx.strokeStyle = 'rgba(148,64,94,.32)';
  ctx.lineWidth = Math.max(0.45, size * 0.11);
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI * 2 / 5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-size * 0.52, -size * 0.24, -size * 0.48, -size * 0.92, -size * 0.08, -size);
    ctx.lineTo(0, -size * 0.83);
    ctx.lineTo(size * 0.08, -size);
    ctx.bezierCurveTo(size * 0.48, -size * 0.92, size * 0.52, -size * 0.24, 0, 0);
    ctx.fill();
    if (size > 3) {
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.16);
      ctx.lineTo(0, -size * 0.72);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.fillStyle = '#f7d27c';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function buildTreeLayers(width: number, height: number, dpr: number, params: SakuraTuningParams): RenderBranch[] {
  const rand = random(1778);
  const detail = Math.max(0.3, Math.min(2, params.blossomDensity));
  const scale = Math.min(width / 1050, 1.8);
  const flowerSize = Math.max(4.5, Math.min(10, 5.5 * scale)) * params.blossomSize;
  const branch = (depth: number, x: number, y: number): TreeBranch => ({
    depth, pivotX: x, pivotY: y, phase: rand() * Math.PI * 2,
    segments: [], flowers: [], children: [],
  });

  function grow(x: number, y: number, angle: number, length: number, thickness: number, depth: number, group: TreeBranch) {
    const bend = (rand() - 0.5) * length * 0.22;
    const endX = x + Math.cos(angle) * length;
    const endY = y + Math.sin(angle) * length;
    const controlX = (x + endX) * 0.5 + bend;
    const controlY = (y + endY) * 0.5;
    group.segments.push({ x, y, endX, endY, controlX, controlY, thickness, depth });
    if (depth >= 2) {
      const count = Math.round((depth === 5 ? 6 : depth === 4 ? 4 : depth === 3 ? 3 : 2) * detail);
      for (let i = 0; i < count; i++) {
        const along = 0.32 + rand() * 0.72;
        const offset = (rand() - 0.5) * length * 0.7;
        group.flowers.push({
          x: x + (endX - x) * along + offset,
          y: y + (endY - y) * along + (rand() - 0.5) * length * 0.56,
          size: flowerSize * (0.65 + rand() * 0.65),
          variant: Math.floor(rand() * BLOSSOM_VARIANTS),
          haze: group.flowers.length % 3 === 0,
          level: 1,
          regrowAt: 0,
        });
      }
    }
    if (depth >= 5 || length < 9) return;
    const count = depth === 0 ? 4 : depth === 2 ? 4 : depth < 3 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * (depth < 2 ? 0.43 : 0.57);
      const attach = depth === 0 ? 0.46 + i * 0.15 : 0.55 + rand() * 0.43;
      const remaining = 1 - attach;
      const childX = remaining * remaining * x + 2 * remaining * attach * controlX + attach * attach * endX;
      const childY = remaining * remaining * y + 2 * remaining * attach * controlY + attach * attach * endY;
      const child = depth < 2 ? branch(depth + 1, childX, childY) : group;
      if (child !== group) group.children.push(child);
      grow(childX, childY, angle + spread + (rand() - 0.5) * 0.35,
        length * (0.62 + rand() * 0.13), thickness * 0.65, depth + 1, child);
    }
  }

  const right = branch(0, width * 0.82, height * 1.05);
  const left = branch(0, -width * 0.05, height * 0.82);
  grow(right.pivotX, right.pivotY, -1.7, height * 0.47 * params.treeScale, Math.max(9, height * 0.035 * params.treeScale), 0, right);
  grow(left.pivotX, left.pivotY, -0.9, height * 0.30 * params.treeScale, Math.max(5, height * 0.014 * params.treeScale), 0, left);

  function cache(group: TreeBranch): RenderBranch {
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const segment of group.segments) {
      const pad = segment.thickness / 2 + 2;
      minX = Math.min(minX, segment.x - pad, segment.endX - pad, segment.controlX - pad);
      minY = Math.min(minY, segment.y - pad, segment.endY - pad, segment.controlY - pad);
      maxX = Math.max(maxX, segment.x + pad, segment.endX + pad, segment.controlX + pad);
      maxY = Math.max(maxY, segment.y + pad, segment.endY + pad, segment.controlY + pad);
    }
    for (const flower of group.flowers) {
      const pad = flower.size * 3.2;
      minX = Math.min(minX, flower.x - pad);
      minY = Math.min(minY, flower.y - pad);
      maxX = Math.max(maxX, flower.x + pad);
      maxY = Math.max(maxY, flower.y + pad);
    }
    const left = Math.floor(minX - 2);
    const top = Math.floor(minY - 2);
    const layerWidth = Math.ceil(maxX + 2) - left;
    const layerHeight = Math.ceil(maxY + 2) - top;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(layerWidth * dpr);
    canvas.height = Math.ceil(layerHeight * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, -left * dpr, -top * dpr);
    ctx.lineCap = 'round';
    for (const segment of group.segments) {
      ctx.strokeStyle = segment.depth < 2 ? '#523b43' : '#66505a';
      ctx.lineWidth = segment.thickness;
      ctx.beginPath();
      ctx.moveTo(segment.x, segment.y);
      ctx.quadraticCurveTo(segment.controlX, segment.controlY, segment.endX, segment.endY);
      ctx.stroke();
      if (segment.thickness > 3) {
        ctx.strokeStyle = 'rgba(220,174,166,.26)';
        ctx.lineWidth = segment.thickness * 0.18;
        ctx.beginPath();
        ctx.moveTo(segment.x - segment.thickness * 0.2, segment.y);
        ctx.quadraticCurveTo(segment.controlX - segment.thickness * 0.2, segment.controlY, segment.endX - segment.thickness * 0.2, segment.endY);
        ctx.stroke();
      }
    }
    // Only the wood is baked: the blossoms are drawn every frame, so a click can blow them off and they can grow back.
    return {
      depth: group.depth, pivotX: group.pivotX, pivotY: group.pivotY, phase: group.phase,
      canvas, left, top, width: layerWidth, height: layerHeight,
      flowers: group.flowers,
      children: group.children.map(cache),
    };
  }

  return [cache(right), cache(left)];
}

/** Blossom sprites in a few turns and shades, and the soft pink haze behind every third blossom. */
function createBlossomSprites(dpr: number) {
  const rand = random(1779);
  const px = Math.ceil(SPRITE_SIZE * 2.4 * dpr);
  const blossoms = Array.from({ length: BLOSSOM_VARIANTS }, () => {
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBlossom(ctx, SPRITE_SIZE * 1.2, SPRITE_SIZE * 1.2, SPRITE_SIZE, rand);
    return canvas;
  });
  const haze = document.createElement('canvas');
  haze.width = 32;
  haze.height = 32;
  const hctx = haze.getContext('2d')!;
  const gradient = hctx.createRadialGradient(16, 16, 12, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,180,207,.09)');
  gradient.addColorStop(1, 'rgba(255,180,207,0)');
  hctx.fillStyle = gradient;
  hctx.fillRect(0, 0, 32, 32);
  return { blossoms, haze };
}

type BlossomPass = {
  sprites: ReturnType<typeof createBlossomSprites>;
  time: number;
  dt: number;
  dpr: number;
  /** A click to blow blossoms off at, in page pixels, or null. */
  click: { x: number; y: number } | null;
  radius: number;
  blow: (x: number, y: number, nx: number, ny: number, strength: number, count: number) => void;
};

function drawTreeBranches(ctx: CanvasRenderingContext2D, branches: RenderBranch[], elapsed: number, params: SakuraTuningParams, reduced: boolean, pass: BlossomPass) {
  const t = elapsed * params.gustSpeed;
  const gust = 0.55 + 0.45 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1.3);
  const { sprites, time, dt, dpr, click, radius } = pass;
  function draw(branch: RenderBranch) {
    ctx.save();
    if (branch.depth > 0 && !reduced) {
      const depthFactor = (branch.depth + 1) / 3;
      const angle = params.windStrength * depthFactor *
        (0.16 * gust + 0.08 * Math.sin(t * 2.3 + branch.phase));
      ctx.translate(branch.pivotX, branch.pivotY);
      ctx.rotate(angle);
      ctx.translate(-branch.pivotX, -branch.pivotY);
    }
    ctx.drawImage(branch.canvas, branch.left, branch.top, branch.width, branch.height);
    // Where this branch's blossoms are on the page right now (it sways), for the click.
    const m = click ? ctx.getTransform() : null;
    for (const flower of branch.flowers) {
      if (flower.level < 1 && time >= flower.regrowAt) flower.level = Math.min(1, flower.level + dt / REGROW_TIME);
      if (m && click && flower.level > 0.1) {
        const x = (m.a * flower.x + m.c * flower.y + m.e) / dpr;
        const y = (m.b * flower.x + m.d * flower.y + m.f) / dpr;
        const dx = x - click.x;
        const dy = y - click.y;
        const distance = Math.hypot(dx, dy);
        if (distance < radius) {
          const strength = Math.sqrt(1 - distance / radius);
          const lost = flower.level * strength;
          flower.level -= lost;
          flower.regrowAt = time + REGROW_DELAY + Math.random() * 5;
          pass.blow(x, y, distance > 0.001 ? dx / distance : -1, distance > 0.001 ? dy / distance : 0, strength, 1 + Math.round(lost * 1.6));
        }
      }
    }
    for (const flower of branch.flowers) {
      if (!flower.haze) continue;
      const grown = budToBloom(flower.level);
      if (grown < 0.05) continue;
      const r = flower.size * 2.8 * grown;
      ctx.drawImage(sprites.haze, flower.x - r, flower.y - r, r * 2, r * 2);
    }
    for (const flower of branch.flowers) {
      const grown = budToBloom(flower.level);
      if (grown < 0.02) continue;
      const s = (flower.size / SPRITE_SIZE) * grown;
      ctx.drawImage(sprites.blossoms[flower.variant], flower.x - SPRITE_SIZE * 1.2 * s, flower.y - SPRITE_SIZE * 1.2 * s, SPRITE_SIZE * 2.4 * s, SPRITE_SIZE * 2.4 * s);
    }
    for (const child of branch.children) draw(child);
    ctx.restore();
  }
  for (const branch of branches) draw(branch);
}

export function drawLandscape(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number, palette: Palette) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, rgb(palette.top));
  sky.addColorStop(0.68, rgb(palette.horizon));
  sky.addColorStop(1, rgb(palette.near));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const night = Math.max(0, 1 - Math.min(Math.abs(phase - 0.75), 1 - Math.abs(phase - 0.75)) * 4);
  const stars = random(422);
  ctx.fillStyle = `rgba(239,244,255,${night * 0.72})`;
  for (let i = 0; i < 145; i++) {
    const x = stars() * width;
    const y = stars() * height * 0.58;
    const radius = 0.5 + stars() * 1.3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const orbX = width * (phase < 0.75 ? 0.18 + phase * 0.9 : 0.78);
  const orbY = height * (phase < 0.75 ? 0.30 - Math.sin(phase / 0.75 * Math.PI) * 0.19 : 0.20);
  const orbR = Math.max(24, Math.min(width, height) * 0.04);
  const halo = ctx.createRadialGradient(orbX, orbY, orbR * 0.2, orbX, orbY, orbR * 5);
  halo.addColorStop(0, rgb(palette.light, 0.65));
  halo.addColorStop(1, rgb(palette.light, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(orbX - orbR * 5, orbY - orbR * 5, orbR * 10, orbR * 10);
  ctx.fillStyle = rgb(palette.light, phase > 0.68 ? 0.78 : 0.96);
  ctx.beginPath();
  ctx.arc(orbX, orbY, orbR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = rgb(palette.distant);
  ctx.beginPath();
  ctx.moveTo(0, height * 0.68);
  for (let x = 0; x <= width + 10; x += width / 16) {
    ctx.lineTo(x, height * (0.60 + 0.055 * Math.sin(x / width * 10 + 1) + 0.025 * Math.sin(x / width * 23)));
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.fill();

  const mist = ctx.createLinearGradient(0, height * 0.57, 0, height * 0.82);
  mist.addColorStop(0, rgb(palette.horizon, 0));
  mist.addColorStop(0.6, rgb(palette.horizon, 0.17));
  mist.addColorStop(1, rgb(palette.horizon, 0));
  ctx.fillStyle = mist;
  ctx.fillRect(0, height * 0.57, width, height * 0.25);

  ctx.fillStyle = rgb(palette.near);
  ctx.beginPath();
  ctx.moveTo(0, height * 0.81);
  ctx.bezierCurveTo(width * 0.23, height * 0.70, width * 0.38, height * 0.78, width * 0.54, height * 0.76);
  ctx.bezierCurveTo(width * 0.73, height * 0.69, width * 0.84, height * 0.76, width, height * 0.71);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.fill();

  const ground = ctx.createLinearGradient(0, height * 0.8, 0, height);
  ground.addColorStop(0, rgb(palette.near, 0));
  ground.addColorStop(1, rgb(palette.meadow));
  ctx.fillStyle = ground;
  ctx.fillRect(0, height * 0.78, width, height * 0.22);
  const grass = random(1766);
  ctx.strokeStyle = rgb(palette.light, 0.15);
  ctx.lineWidth = 1;
  for (let i = 0; i < Math.min(300, width / 4); i++) {
    const x = grass() * width;
    const y = height * (0.88 + grass() * 0.12);
    const length = 4 + grass() * 12;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + length * 0.4, y - length * 0.5, x + length * 0.3, y - length);
    ctx.stroke();
  }
}

function drawPetal(ctx: CanvasRenderingContext2D, petal: Petal, params: SakuraTuningParams) {
  const size = petal.size * params.petalSize;
  ctx.save();
  ctx.translate(petal.x, petal.y);
  ctx.rotate(petal.turn);
  ctx.scale(0.45 + Math.abs(Math.cos(petal.phase)) * 0.55, 1);
  ctx.fillStyle = petal.tint > 0.72 ? 'rgba(255,238,244,.93)' : petal.tint > 0.35 ? 'rgba(255,204,225,.88)' : 'rgba(246,157,190,.86)';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.46);
  ctx.bezierCurveTo(size * 0.58, -size * 0.42, size * 0.58, size * 0.2, 0, size * 0.55);
  ctx.bezierCurveTo(-size * 0.58, size * 0.2, -size * 0.58, -size * 0.42, 0, -size * 0.46);
  ctx.fill();
  ctx.restore();
}

export function BodySakuraEffect({ params }: { params?: SakuraTuningParams }) {
  const host = useEffectHost();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef({ x: -1000, y: -1000, active: false });
  const clickRef = useRef<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [fallback] = useState(createSakuraParams);
  const active = params ?? fallback;

  useEffect(() => {
    if (!host) document.body.classList.add('scene-body-active', 'scene-sakura-active');
    const measure = () => { const { width, height } = effectBounds(host); setSize({ width, height }); };
    const move = (event: PointerEvent) => { const point = effectPoint(host, event); pointerRef.current = { x: point.x, y: point.y, active: point.inside }; };
    const leave = () => { pointerRef.current.active = false; };
    // A press anywhere but on a button, link or control blows the blossoms near it off the branches.
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || (event.target instanceof Element && event.target.closest(PAGE_CONTROLS))) return;
      const point = effectPoint(host, event);
      if (point.inside) clickRef.current = { x: point.x, y: point.y };
    };
    const stopResize = observeEffectSize(host, measure);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('blur', leave);
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      if (!host) document.body.classList.remove('scene-body-active', 'scene-sakura-active');
      stopResize();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('blur', leave);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, [host]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.width || !size.height) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = size;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75, Math.max(1, Math.sqrt(12_000_000 / (width * height))));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let treeBranches: RenderBranch[] = [];
    let treeKey = '';
    const rand = random(4104);
    const petals: Petal[] = Array.from({ length: 400 }, () => ({
      x: rand() * width, y: rand() * height, size: 0.6 + rand() * 1.3,
      speed: 0.6 + rand() * 0.9, drift: 0.4 + rand() * 0.9,
      phase: rand() * Math.PI * 2, turn: rand() * Math.PI * 2, tint: rand(),
    }));
    const sprites = createBlossomSprites(dpr);
    const blown: BlownPetal[] = [];
    const blow = (x: number, y: number, nx: number, ny: number, strength: number, count: number) => {
      for (let i = 0; i < count && blown.length < MAX_BLOWN; i++) {
        const speed = (70 + rand() * 220) * strength + 40;
        blown.push({
          x, y, size: 0.6 + rand() * 1.2, speed: 0, drift: 0, phase: rand() * Math.PI * 2, turn: rand() * Math.PI * 2, tint: rand(),
          vx: nx * speed + (rand() - 0.5) * 80, vy: ny * speed + (rand() - 0.7) * 80, spin: (rand() - 0.5) * 8, life: 1,
        });
      }
    };
    let last = performance.now();
    let cycleStart = last;
    let lastMode = active.timeMode;
    let raf = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const render = profileEffectFrame(canvas, (now: number) => {
      raf = requestAnimationFrame(render);
      if (document.hidden || now - last < (reduced ? 100 : 33)) return;
      const dt = Math.min((now - last) / 1000, 0.08);
      last = now;
      const key = `${active.treeScale}:${active.blossomSize}:${active.blossomDensity}`;
      if (key !== treeKey) {
        treeBranches = buildTreeLayers(width, height, dpr, active);
        treeKey = key;
      }
      if (active.timeMode !== lastMode) {
        if (active.timeMode === 'cycle') cycleStart = now;
        lastMode = active.timeMode;
      }
      const elapsed = (now - cycleStart) / 1000;
      const phase = currentPhase(active, elapsed);
      const palette = paletteAt(phase);
      drawLandscape(ctx, width, height, phase, palette);
      const click = clickRef.current;
      clickRef.current = null;
      drawTreeBranches(ctx, treeBranches, elapsed, active, reduced, {
        sprites, time: now / 1000, dt, dpr, click, radius: Math.max(90, Math.min(200, Math.min(width, height) * 0.2)), blow,
      });
      const shade = Math.max(0, 1 - Math.min(Math.abs(phase - 0.75), 1 - Math.abs(phase - 0.75)) * 3);
      ctx.fillStyle = `rgba(15,22,48,${shade * 0.18})`;
      ctx.fillRect(0, 0, width, height);
      const count = Math.min(400, Math.max(0, Math.round(active.petalCount)));
      const gust = 0.75 + Math.sin(elapsed * active.gustSpeed * 0.7) * 0.25;
      const cursor = pointerRef.current;
      for (let i = 0; i < count; i++) {
        const petal = petals[i];
        if (!reduced) {
          petal.x -= (active.petalDrift * petal.drift * gust + active.windStrength * 15) * dt;
          petal.y += (active.petalFall * petal.speed + Math.sin(elapsed * 1.5 + petal.phase) * 8) * dt;
          petal.phase += dt * (1.2 + petal.speed);
          petal.turn += dt * (petal.drift - 0.6);
          if (cursor.active) {
            const dx = petal.x - cursor.x;
            const dy = petal.y - cursor.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0 && dist < 120) {
              const force = (1 - dist / 120) ** 2 * 180 * dt;
              petal.x += dx / dist * force;
              petal.y += dy / dist * force;
            }
          }
          if (petal.x < -30 || petal.y > height + 30) {
            petal.x = width + rand() * width * 0.25;
            petal.y = -height * 0.15 + rand() * height * 0.65;
          }
        }
        drawPetal(ctx, petal, active);
      }
      // Blown petals: flung out fast, then caught by the wind and slowed to the drift of the others.
      const relax = 1 - Math.exp(-1.3 * dt);
      for (let i = blown.length - 1; i >= 0; i--) {
        const petal = blown[i];
        petal.vx += (-(active.petalDrift * gust + active.windStrength * 15) - petal.vx) * relax;
        petal.vy += (active.petalFall * 1.2 - petal.vy) * relax * 0.8;
        petal.x += petal.vx * dt;
        petal.y += (petal.vy + Math.sin(elapsed * 3 + petal.phase) * 14) * dt;
        petal.phase += dt * 4;
        petal.turn += petal.spin * dt;
        petal.life -= dt / 8;
        if (petal.life <= 0 || petal.x < -30 || petal.y > height + 30) {
          blown.splice(i, 1);
          continue;
        }
        drawPetal(ctx, petal, active);
      }
    });
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [size, active]);

  if (typeof document === 'undefined' || size.width === 0) return null;
  return createPortal(
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>,
    host ?? document.body,
  );
}
