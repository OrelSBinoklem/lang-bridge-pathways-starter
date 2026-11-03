'use client';
import { profileEffectFrame } from '../effectDiagnostics';


import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useLocale } from 'next-intl';
import type { PointerState } from '../engine';
import { createEmbroideryParams, type EmbroideryParams } from './params';
import { MOTIF_SIZE, DIVIDER, THREAD_COLORS, zigzagHeight, embroideryPattern, type ThreadKey, type EmbroideryComposition } from './motifs';
import { MOTIF_WORDS, pick } from './words';
import { drawThread, hash1, mix, type Rgb } from './threadDraw';
import { paintCloth } from './clothTexture';
import { createRope, ropeCurve, stepRope, DEFAULT_ROPE } from './rope';
import { makeSparkleSprite } from './sprites';
import { stitchBrushRadius, inStitchBrush, createStitchTraversal, stepStitchNeedle } from './stitchBrush';

export { createEmbroideryParams, type EmbroideryParams } from './params';

const CLOTH: Rgb = [150, 38, 52];
const WHITE: Rgb = [255, 250, 238];
const DARK: Rgb = [18, 5, 9];
/** Rows of stitches in one belt: margin, zigzag border, gap, motif (11), the word, border, margin. */
const BELT_ROWS = 23;
const MOTIF_ROW = 5;
const PITCH = 16;
const STITCH_SECONDS = 0.3;
const WORD_SECONDS = 6;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth01 = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

type Cell = {
  id: number;
  /** Stable name of the cell, so that a finished stitch survives the effect being remounted. */
  key: string;
  x: number;
  y: number;
  color: ThreadKey;
  motif: number;
  done: boolean;
  active: boolean;
};

type MotifInstance = {
  word: number;
  centreX: number;
  centreY: number;
  labelY: number;
  cells: number[];
  remaining: number;
  /** Clock time the motif was finished; -1e9 = long ago, NaN = not finished. */
  finishedAt: number;
  hover: number;
};

type Layout = {
  cell: number;
  cells: Cell[];
  motifs: MotifInstance[];
  stripes: number[];
  bucket: number;
  buckets: Map<number, number[]>;
};

/** The whole belt for a card of this size: every stitch that can be sewn, the motifs, the stripes of the selvedge. */
function buildLayout(width: number, height: number, composition: EmbroideryComposition): Layout {
  const bands = Math.max(1, Math.round(height / 190));
  const bandH = height / bands;
  const cell = clamp(Math.floor(bandH / BELT_ROWS), 4, 9);
  const offY = (bandH - BELT_ROWS * cell) / 2;
  const cols = Math.floor(width / cell);
  const padX = (width - cols * cell) / 2;
  const slots = Math.max(1, Math.floor((cols - 4 + 5) / PITCH));
  const left = Math.floor((cols - (slots * PITCH - 5)) / 2);
  const cells: Cell[] = [];
  const motifs: MotifInstance[] = [];
  const stripes: number[] = [];

  const add = (band: number, key: string, col: number, beltRow: number, color: ThreadKey, motif: number) => {
    cells.push({
      id: cells.length,
      key: `${composition === 'left' || composition === 'full' && col < cols / 2 ? 'left:' : ''}${band}:${key}`,
      x: padX + col * cell,
      y: band * bandH + offY + beltRow * cell,
      color,
      motif,
      done: false,
      active: false,
    });
  };

  for (let band = 0; band < bands; band += 1) {
    stripes.push(band * bandH + 4, (band + 1) * bandH - 4);
    for (let col = 1; col < cols - 1; col += 1) {
      const h = zigzagHeight(col);
      for (let r = 0; r < h; r += 1) {
        const color: ThreadKey = r === h - 1 ? 'G' : 'W';
        add(band, `t${col}.${r}`, col, 1 + r, color, -1);
        add(band, `u${col}.${r}`, col, BELT_ROWS - 2 - r, color, -1);
      }
    }
    for (let s = 0; s < slots; s += 1) {
      const { motif: pattern, word: motifIndex } = embroideryPattern(s, band, slots, composition);
      const col0 = left + s * PITCH;
      const instance: MotifInstance = {
        word: motifIndex,
        centreX: padX + (col0 + MOTIF_SIZE / 2) * cell,
        centreY: band * bandH + offY + (MOTIF_ROW + MOTIF_SIZE / 2) * cell,
        labelY: band * bandH + offY + (MOTIF_ROW + MOTIF_SIZE + 1.8) * cell,
        cells: [],
        remaining: 0,
        finishedAt: Number.NaN,
        hover: 0,
      };
      const index = motifs.length;
      for (const c of pattern.cells) {
        instance.cells.push(cells.length);
        add(band, `m${s}.${motifIndex}.${c.col}.${c.row}`, col0 + c.col, MOTIF_ROW + c.row, c.color, index);
      }
      if (s < slots - 1) {
        for (const [dx, dy] of DIVIDER) add(band, `d${s}.${dx}.${dy}`, col0 + MOTIF_SIZE + 2 + dx, MOTIF_ROW + 5 + dy, 'G', -1);
      }
      instance.remaining = instance.cells.length;
      motifs.push(instance);
    }
  }

  const bucket = cell * 4;
  const buckets = new Map<number, number[]>();
  for (const c of cells) {
    const key = Math.floor((c.x + cell / 2) / bucket) + Math.floor((c.y + cell / 2) / bucket) * 4096;
    const list = buckets.get(key);
    if (list) list.push(c.id);
    else buckets.set(key, [c.id]);
  }
  return { cell, cells, motifs, stripes, bucket, buckets };
}

/** Cross stitches that were finished, kept while the page is open so that switching effects does not unpick them. */
const stitchedKeys = new Set<string>();

type Stitch = { cell: Cell; t: number; travelling: boolean };

/** The two ends of one stroke of a cross stitch, a little different every time, as by hand. */
function strokeEnds(cell: Cell, size: number, stroke: 0 | 1) {
  const inset = size * 0.14;
  const j = (k: number) => (hash1(cell.id * 8 + stroke * 3 + k) - 0.5) * size * 0.12;
  return stroke === 0
    ? { ax: cell.x + inset + j(0), ay: cell.y + size - inset + j(1), bx: cell.x + size - inset + j(2), by: cell.y + inset + j(3) }
    : { ax: cell.x + inset + j(0), ay: cell.y + inset + j(1), bx: cell.x + size - inset + j(2), by: cell.y + size - inset + j(3) };
}

const scratch = new Float32Array(32);

/** Writes the stroke from its start to `upTo` (0..1) into `scratch` as a slightly bowed curve; returns the point count. */
function strokePoints(cell: Cell, size: number, stroke: 0 | 1, upTo: number) {
  const { ax, ay, bx, by } = strokeEnds(cell, size, stroke);
  const bow = (hash1(cell.id * 5 + stroke + 40) - 0.5) * size * 0.16;
  const mx = (ax + bx) / 2 - (by - ay) * (bow / size);
  const my = (ay + by) / 2 + (bx - ax) * (bow / size);
  const steps = 8;
  let n = 0;
  for (let k = 0; k <= steps; k += 1) {
    const t = (k / steps) * upTo;
    const u = 1 - t;
    scratch[n * 2] = u * u * ax + 2 * u * t * mx + t * t * bx;
    scratch[n * 2 + 1] = u * u * ay + 2 * u * t * my + t * t * by;
    n += 1;
  }
  return n;
}

function threadStyle(cell: Cell, size: number, p: EmbroideryParams) {
  const tone = 0.93 + 0.14 * hash1(cell.id * 3 + 1);
  const base = THREAD_COLORS[cell.color];
  const color: Rgb = tone < 1 ? mix(base, DARK, 1 - tone) : mix(base, WHITE, (tone - 1) * 1.4);
  return {
    color,
    width: size * 0.4 * p.thread * (0.92 + 0.16 * hash1(cell.id * 3 + 2)),
    twist: p.twist,
    fuzz: p.fuzz,
    seed: cell.id + 1,
    shadow: 1,
  };
}

/** A whole cross stitch, or the part of it sewn so far (`progress` 0..1 over both strokes), onto any context. */
function drawStitch(ctx: CanvasRenderingContext2D, cell: Cell, size: number, p: EmbroideryParams, progress: number) {
  const style = threadStyle(cell, size, p);
  for (const stroke of [0, 1] as const) {
    const part = clamp(progress * 2 - stroke, 0, 1);
    if (part <= 0) continue;
    const ends = strokeEnds(cell, size, stroke);
    // The thread goes into a little hole in the cloth at both ends.
    ctx.fillStyle = 'rgba(14,2,6,0.55)';
    ctx.beginPath();
    ctx.arc(ends.ax, ends.ay, style.width * 0.55, 0, Math.PI * 2);
    ctx.fill();
    if (part >= 1) {
      ctx.beginPath();
      ctx.arc(ends.bx, ends.by, style.width * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    const n = strokePoints(cell, size, stroke, part);
    drawThread(ctx, scratch, n, style);
  }
}

/** The head of the needle while it sews a stitch: where the thread comes out now. */
function stitchHead(cell: Cell, size: number, progress: number) {
  const stroke: 0 | 1 = progress < 0.5 ? 0 : 1;
  const part = clamp(progress * 2 - stroke, 0, 1);
  const n = strokePoints(cell, size, stroke, part);
  return { x: scratch[(n - 1) * 2], y: scratch[(n - 1) * 2 + 1] };
}

const NEEDLE_LENGTH = 50;

/** Where the eye of a needle is, the point the thread hangs from. */
function needleEye(tipX: number, tipY: number, tilt: number) {
  const dx = Math.sin(tilt);
  const dy = -Math.cos(tilt);
  return { x: tipX + dx * (NEEDLE_LENGTH - 6), y: tipY + dy * (NEEDLE_LENGTH - 6) };
}

function drawNeedle(ctx: CanvasRenderingContext2D, tipX: number, tipY: number, tilt: number, lift: number) {
  const length = NEEDLE_LENGTH;
  const dx = Math.sin(tilt);
  const dy = -Math.cos(tilt);
  const ex = tipX + dx * length;
  const ey = tipY + dy * length;
  ctx.save();
  ctx.lineCap = 'round';
  // Its shadow on the cloth: further away and softer when the needle is lifted.
  ctx.strokeStyle = `rgba(12,2,6,${0.3 - lift * 0.12})`;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(tipX + 3 + lift * 8, tipY + 4 + lift * 9);
  ctx.lineTo(ex + 3 + lift * 8, ey + 4 + lift * 9);
  ctx.stroke();
  const steel = ctx.createLinearGradient(tipX - 2, 0, tipX + 2, 0);
  steel.addColorStop(0, '#8d97a1');
  steel.addColorStop(0.45, '#eef2f5');
  steel.addColorStop(1, '#6b747d');
  ctx.strokeStyle = steel;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(tipX - 0.5, tipY - 3);
  ctx.lineTo(ex - 0.5, ey);
  ctx.stroke();
  // The eye.
  const eyeX = ex - dx * 6;
  const eyeY = ey - dy * 6;
  ctx.fillStyle = '#1a0d10';
  ctx.beginPath();
  ctx.ellipse(eyeX, eyeY, 0.8, 2.3, tilt, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A pill-shaped rounded rectangle path. */
function pillPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.closePath();
}

/**
 * "Вышитый пояс": a belt of red woolen cloth that the cursor embroiders. The needle follows the cursor and sews
 * cross stitches in a stable zigzag inside the cursor brush, one at a time; the thread hangs from above
 * on a rope of Verlet points and sags and swings as the needle moves; the pattern (a star, the sun, the moon, an
 * oak, a bird, a heart) grows, and a finished motif shows its word in Latvian and in the reader's language.
 * Thread is drawn as thread: rim, body, twist of the plies, highlight, stray fibres, a shadow on the cloth.
 */
export function EmbroideryEffect({
  width,
  height,
  pointerRef,
  params,
  composition = 'card',
}: {
  width: number;
  height: number;
  pointerRef: MutableRefObject<PointerState>;
  params?: EmbroideryParams;
  composition?: EmbroideryComposition;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uk = useLocale() === 'uk';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const p = params ?? createEmbroideryParams();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const layout = buildLayout(width, height, composition);
    const { cell: size, cells, motifs } = layout;
    const cloth = document.createElement('canvas');
    const stitched = document.createElement('canvas');
    const sparkle = makeSparkleSprite();
    let clothBrightness = -1;

    function paintBase() {
      clothBrightness = p.cloth;
      paintCloth(cloth, { width, height, dpr, base: CLOTH, brightness: p.cloth, stripes: layout.stripes });
      const g = cloth.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The pattern shows through as faint dots where nothing is sewn yet.
      g.fillStyle = 'rgba(255,240,225,0.13)';
      for (const c of cells) {
        if (c.motif < 0) continue;
        g.beginPath();
        g.arc(c.x + size / 2, c.y + size / 2, Math.max(0.7, size * 0.1), 0, Math.PI * 2);
        g.fill();
      }
    }
    paintBase();
    stitched.width = cloth.width;
    stitched.height = cloth.height;
    const layerCtx = stitched.getContext('2d')!;
    layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const finish = (c: Cell, clock: number) => {
      c.done = true;
      c.active = false;
      stitchedKeys.add(c.key);
      drawStitch(layerCtx, c, size, p, 1);
      if (c.motif >= 0) {
        const m = motifs[c.motif];
        m.remaining -= 1;
        if (m.remaining === 0 && Number.isNaN(m.finishedAt)) m.finishedAt = clock;
      }
    };
    // Whatever was sewn before (this page visit) is sewn again at once.
    for (const c of cells) if (stitchedKeys.has(c.key)) finish(c, -1e9);

    const active: Stitch[] = [];
    const traversal = createStitchTraversal<Cell>();
    const unpickAll = () => {
      layerCtx.clearRect(0, 0, width, height);
      stitchedKeys.clear();
      for (const c of cells) {
        c.done = false;
        c.active = false;
      }
      for (const m of motifs) {
        m.remaining = m.cells.length;
        m.finishedAt = Number.NaN;
      }
      active.length = 0;
      traversal.clear();
    };

    const rope = createRope(26, width * 0.62, -24, width / 2, height / 2);
    const curve = new Float32Array(26 * 3 * 2 + 4);
    const ropeColor: Rgb = [...THREAD_COLORS.G];
    const needle = { x: width / 2, y: height / 2, vx: 0, tilt: 0 };
    const glints: Array<{ x: number; y: number; t0: number; size: number }> = [];
    let seenReset = p.resetTick;
    let clock = 0;

    function brushCandidates(x: number, y: number, radius: number): Cell[] {
      const b = layout.bucket;
      const span = Math.ceil(radius / b);
      const bx = Math.floor(x / b);
      const by = Math.floor(y / b);
      const candidates: Cell[] = [];
      for (let gy = by - span; gy <= by + span; gy += 1) {
        for (let gx = bx - span; gx <= bx + span; gx += 1) {
          const list = layout.buckets.get(gx + gy * 4096);
          if (!list) continue;
          for (const id of list) {
            candidates.push(cells[id]);
          }
        }
      }
      return candidates;
    }

    function drawLabel(m: MotifInstance, alpha: number) {
      if (alpha <= 0.02) return;
      const word = MOTIF_WORDS[m.word];
      const fontSize = clamp(size * 1.75, 11, 17);
      const lv = word.lv;
      const tr = pick(word, uk);
      ctx!.font = `700 ${fontSize}px Georgia, "Times New Roman", serif`;
      const wLv = ctx!.measureText(lv).width;
      ctx!.font = `italic 500 ${fontSize * 0.92}px Georgia, "Times New Roman", serif`;
      const wTr = ctx!.measureText(` — ${tr}`).width;
      const total = wLv + wTr;
      const h = fontSize * 1.7;
      const x0 = clamp(m.centreX - total / 2, 6, width - total - 6);
      const y0 = m.labelY - h / 2;
      ctx!.save();
      ctx!.globalAlpha = alpha;
      ctx!.fillStyle = 'rgba(38,6,14,0.72)';
      pillPath(ctx!, x0 - 9, y0, total + 18, h);
      ctx!.fill();
      ctx!.strokeStyle = 'rgba(228,178,70,0.7)';
      ctx!.lineWidth = 1;
      ctx!.stroke();
      ctx!.textBaseline = 'middle';
      ctx!.font = `700 ${fontSize}px Georgia, "Times New Roman", serif`;
      ctx!.fillStyle = '#f2c766';
      ctx!.fillText(lv, x0, m.labelY + 0.5);
      ctx!.font = `italic 500 ${fontSize * 0.92}px Georgia, "Times New Roman", serif`;
      ctx!.fillStyle = '#f6efe0';
      ctx!.fillText(` — ${tr}`, x0 + wLv, m.labelY + 0.5);
      ctx!.restore();
    }

    function render(t: number) {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.drawImage(cloth, 0, 0, width, height);
      ctx!.drawImage(stitched, 0, 0, width, height);
      for (const s of active) drawStitch(ctx!, s.cell, size, p, s.t / STITCH_SECONDS);

      if (p.words) {
        for (const m of motifs) {
          if (m.remaining > 0) continue;
          // The word shows for a few seconds after the motif is finished, and whenever the needle is over it.
          const since = t - m.finishedAt;
          const fresh = since >= 0 && since < WORD_SECONDS ? smooth01(since / 0.7) * (1 - smooth01(since - (WORD_SECONDS - 1))) : 0;
          drawLabel(m, Math.max(fresh, m.hover));
        }
      }
      // Glints that run over a motif when it is finished.
      ctx!.globalCompositeOperation = 'lighter';
      for (let i = glints.length - 1; i >= 0; i -= 1) {
        const g = glints[i];
        const age = t - g.t0;
        if (age > 0.9) {
          glints.splice(i, 1);
          continue;
        }
        if (age < 0) continue;
        const k = Math.sin((age / 0.9) * Math.PI);
        const s = g.size * (0.5 + k);
        ctx!.globalAlpha = k * 0.9;
        ctx!.drawImage(sparkle, g.x - s / 2, g.y - s / 2, s, s);
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = 'source-over';
    }

    function drawThreadAndNeedle(lift: number, dt: number) {
      const eye = needleEye(needle.x, needle.y, needle.tilt);
      stepRope(rope, width * 0.62, -24, eye.x, eye.y, dt, { ...DEFAULT_ROPE, time: clock });
      const n = ropeCurve(rope, curve);
      drawThread(ctx!, curve, n, { color: ropeColor, width: clamp(size * 0.42, 2.4, 4) * p.thread, twist: p.twist, fuzz: p.fuzz, seed: 991, shadow: 1 });
      drawNeedle(ctx!, needle.x, needle.y, needle.tilt, lift);
    }

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let last = 0;
    const loop = profileEffectFrame(canvas, (time: number) => {
      rafId = requestAnimationFrame(loop);
      const dt = last ? Math.min((time - last) / 1000, 0.05) : 0.016;
      last = time;
      clock += dt;
      if (p.resetTick !== seenReset) {
        seenReset = p.resetTick;
        unpickAll();
      }
      if (p.cloth !== clothBrightness) {
        paintBase();
        // The pattern's dots were painted with the cloth; the finished stitches sit on their own layer.
      }

      // Only the actual cursor selects stitches; the needle's visual lag must not expand the brush.
      const cursor = pointerRef.current;
      const pointerOn = cursor.active;
      const px = cursor.x + width / 2;
      const py = height / 2 - cursor.y;
      let targetX = needle.x;
      let targetY = needle.y;
      const reach = stitchBrushRadius(size, p.reach);
      const brush = { x: px, y: py, active: pointerOn };
      const rate = pointerOn ? p.stitchRate : 0;

      // A fast cursor move must not finish queued stitches outside its six-node brush.
      for (let i = active.length - 1; i >= 0; i--) {
        const cell = active[i].cell;
        if (!inStitchBrush(cell, size, brush, reach)) {
          cell.active = false;
          active.splice(i, 1);
        }
      }
      if (!pointerOn) traversal.clear();

      // One needle, one stitch: finish it before selecting the next node in the retained zigzag.
      if (!active.length && rate > 0) {
        const next = traversal.next(() => brushCandidates(px, py, reach), size, brush, reach, needle);
        if (next) {
          next.active = true;
          active.push({ cell: next, t: 0, travelling: true });
          ropeColor[0] = ropeColor[0] * 0.4 + THREAD_COLORS[next.color][0] * 0.6;
          ropeColor[1] = ropeColor[1] * 0.4 + THREAD_COLORS[next.color][1] * 0.6;
          ropeColor[2] = ropeColor[2] * 0.4 + THREAD_COLORS[next.color][2] * 0.6;
        } else {
          targetX = px;
          targetY = py;
        }
      }
      for (let i = active.length - 1; i >= 0; i -= 1) {
        const s = active[i];
        const start = stitchHead(s.cell, size, 0);
        if (s.travelling && (reduceMotion || Math.hypot(needle.x - start.x, needle.y - start.y) <= size * .12)) s.travelling = false;
        // No thread appears ahead of the needle while it is travelling to the node.
        if (!s.travelling) s.t += reduceMotion ? STITCH_SECONDS : dt * rate * STITCH_SECONDS;
        if (s.t >= STITCH_SECONDS) {
          const m = s.cell.motif >= 0 ? motifs[s.cell.motif] : null;
          const before = m ? m.remaining : 0;
          const end = stitchHead(s.cell, size, 1);
          targetX = end.x;
          targetY = end.y;
          finish(s.cell, clock);
          active.splice(i, 1);
          if (m && before > 0 && m.remaining === 0) {
            for (let k = 0; k < 14; k += 1) {
              const c = cells[m.cells[Math.floor(hash1(clock * 1000 + k * 13) * m.cells.length)]];
              glints.push({ x: c.x + size / 2, y: c.y + size / 2, t0: clock + hash1(k * 7 + 3) * 0.6, size: size * (2.6 + hash1(k) * 2) });
            }
          }
        }
      }

      // The needle follows: the cursor, or the head of the stitch it is sewing.
      let lift = pointerOn ? 0.6 : 0.4;
      if (active.length > 0) {
        const s = active[active.length - 1];
        const head = stitchHead(s.cell, size, s.t / STITCH_SECONDS);
        targetX = head.x;
        targetY = head.y;
        lift = 0.1;
      }
      const before = needle.x;
      if (!reduceMotion && (active[0]?.travelling || (!active.length && pointerOn))) {
        const position = stepStitchNeedle(needle, { x: targetX, y: targetY }, size, rate, dt);
        needle.x = position.x;
        needle.y = position.y;
      } else {
        const follow = reduceMotion ? 1 : 1 - Math.exp(-dt * (active.length > 0 ? 34 : 16));
        needle.x += (targetX - needle.x) * follow;
        needle.y += (targetY - needle.y) * follow;
      }
      needle.vx += ((needle.x - before) / Math.max(dt, 1e-3) - needle.vx) * 0.2;
      needle.tilt += (clamp(needle.vx * 0.0016, -0.45, 0.45) - needle.tilt) * 0.15;

      // Hovering a finished motif shows its word.
      for (const m of motifs) {
        const near = m.remaining === 0 && Math.abs(needle.x - m.centreX) < size * 6.5 && Math.abs(needle.y - m.centreY) < size * 8;
        m.hover += ((near && pointerOn ? 1 : 0) - m.hover) * Math.min(1, dt * 8);
      }

      render(clock);
      if (!reduceMotion) drawThreadAndNeedle(lift, dt);
    });
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [width, height, pointerRef, params, uk, composition]);

  return <canvas ref={canvasRef} data-embroidery-composition={composition} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}
