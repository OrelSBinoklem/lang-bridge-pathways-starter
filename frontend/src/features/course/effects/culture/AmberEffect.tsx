'use client';
import { profileEffectFrame } from '../effectDiagnostics';


import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useLocale } from 'next-intl';
import type { PointerState } from '../engine';
import { createAmberParams, type AmberParams } from './params';
import { AMBER_LETTERS, AMBER_WORDS, pick, type Bilingual } from './words';
import { hash1 } from './threadDraw';
import { AMBER_FRAGMENT, AMBER_VERTEX } from './amberShader';
import { AmberFallback } from './Amber2DFallback';

export { createAmberParams, type AmberParams } from './params';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Depth sheets for words and inclusions, and one more for the sun spangles. */
const SHEETS = 8;
const TEXTURE_LAYERS = SHEETS + 1;

let webgl2: boolean | null = null;
/** Whether this browser can run the shader version (one throwaway context, asked once). */
function hasWebGL2() {
  if (webgl2 === null) {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    webgl2 = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return webgl2;
}

type Item = {
  text: string;
  meaning: Bilingual | null;
  /** Position on the card, px. */
  x: number;
  y: number;
  /** Depth in the resin, 0 (front) to 1 (back). */
  z: number;
  angle: number;
  size: number;
  letter: boolean;
};

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Amber shader:', gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

/**
 * "Янтарь со словами": the card is a dome of amber seen through a shader (see amberShader.ts): resin that absorbs like
 * amber, cloudy streaks that glow in the light, bubbles, flecks, sun spangles and Latvian words and letters frozen at
 * different depths (deeper ones are dimmer, softer and shift more when the view changes). The cursor is a lamp inside
 * the resin; the nearest word says what it means. Without WebGL 2 a 2D picture of the same idea is drawn instead.
 */
export function AmberEffect(props: {
  width: number;
  height: number;
  pointerRef: MutableRefObject<PointerState>;
  params?: AmberParams;
}) {
  const supported = useMemo(() => hasWebGL2(), []);
  // The card's size changes while a group opens or closes (many times in a row): the picture is rebuilt only once the
  // size has stopped changing, and until then the old one is stretched by the browser.
  const [settled, setSettled] = useState({ width: props.width, height: props.height });
  useEffect(() => {
    if (settled.width === props.width && settled.height === props.height) return;
    const timer = window.setTimeout(() => setSettled({ width: props.width, height: props.height }), 180);
    return () => window.clearTimeout(timer);
  }, [props.width, props.height, settled]);
  return supported ? <AmberGL {...props} width={settled.width} height={settled.height} /> : <AmberFallback {...props} />;
}

function AmberGL({
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
  const glRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const uk = useLocale() === 'uk';

  useEffect(() => {
    const canvas = glRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay || width <= 0 || height <= 0) return;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    const octx = overlay.getContext('2d');
    if (!gl || !octx) return;
    const p = params ?? createAmberParams();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    overlay.width = Math.round(width * dpr);
    overlay.height = Math.round(height * dpr);

    const vs = compile(gl, gl.VERTEX_SHADER, AMBER_VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, AMBER_FRAGMENT);
    if (!vs || !fs) return;
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Amber program:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);
    const u = (name: string) => gl.getUniformLocation(program, name);
    const uRes = u('uRes');
    const uTime = u('uTime');
    const uLamp = u('uLamp');
    const uTilt = u('uTilt');
    const uGlow = u('uGlow');
    const uCloud = u('uCloud');
    const uDepth = u('uDepth');
    const uSparkle = u('uSparkle');
    const uLampSize = u('uLampSize');
    const uBubbles = u('uBubbles');
    const uSss = u('uSss');

    // The sheets: red = words, green = bubbles, blue = flecks (the last sheet: the sun spangles, in red).
    // No more than about 1.3 million pixels a sheet (nine of them live in video memory).
    const layerScale = Math.min(dpr, 1.5, Math.sqrt(1.3e6 / (width * height)));
    const lw = Math.max(64, Math.min(2048, Math.round(width * layerScale)));
    const lh = Math.max(32, Math.min(2048, Math.round(height * layerScale)));
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, lw, lh, TEXTURE_LAYERS, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.uniform1i(u('uLayers'), 0);
    const sheet = document.createElement('canvas');
    sheet.width = lw;
    sheet.height = lh;

    const areaScale = clamp((width * height) / (1100 * 190), 0.5, 4);
    const fontScale = clamp(height / 190, 0.85, 1.35);
    let items: Item[] = [];
    let builtWords = -1;
    let builtInclusions = -1;

    function build() {
      builtWords = p.words;
      builtInclusions = p.inclusions;
      const count = clamp(Math.round(p.words * areaScale), 6, 120);
      items = [];
      const cols = Math.max(2, Math.round(Math.sqrt((count * width) / height)));
      const rows = Math.max(1, Math.ceil(count / cols));
      for (let i = 0; i < count; i += 1) {
        const letter = hash1(i * 13 + 2) < 0.22;
        const z = hash1(i * 7 + 1);
        const meaning = letter ? null : AMBER_WORDS[Math.floor(hash1(i * 5 + 3) * AMBER_WORDS.length)];
        items.push({
          text: letter ? AMBER_LETTERS[Math.floor(hash1(i * 3 + 4) * AMBER_LETTERS.length)] : meaning!.lv,
          meaning,
          x: ((i % cols) + 0.5 + (hash1(i * 19 + 6) - 0.5) * 0.7) / cols * width,
          y: (Math.floor(i / cols) + 0.5 + (hash1(i * 23 + 8) - 0.5) * 0.7) / rows * height,
          z,
          angle: (hash1(i * 29 + 7) - 0.5) * 0.7,
          size: (letter ? 40 : 19) * fontScale * (1.1 - 0.3 * z) * (letter ? 1 : 1 + hash1(i * 11) * 0.3),
          letter,
        });
      }
      paintSheets();
    }

    function paintSheets() {
      const g = sheet.getContext('2d')!;
      const S = lw / width;
      const rnd = (k: number) => hash1(k * 977 + 41);
      for (let layer = 0; layer < TEXTURE_LAYERS; layer += 1) {
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#000';
        g.fillRect(0, 0, lw, lh);
        g.globalCompositeOperation = 'lighter';
        if (layer < SHEETS) {
          const depth = (layer + 0.5) / SHEETS;
          // A baked insect inclusion on two different depth sheets. Wings and veins cost no per-frame geometry.
          if (p.inclusions > .2 && (layer === 2 || layer === 5)) {
            g.save();
            g.translate(lw * (layer === 2 ? .29 : .76), lh * (layer === 2 ? .65 : .34));
            g.rotate(layer === 2 ? -.45 : .6);
            const unit = Math.max(1, Math.min(width, height) / 190) * S;
            g.scale(unit, unit);
            g.fillStyle = 'rgba(0,180,0,.9)'; g.strokeStyle = 'rgba(0,250,0,.9)'; g.lineWidth = .7;
            g.beginPath(); g.ellipse(0, 3, 3, 10, 0, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.arc(0, -9, 3, 0, Math.PI * 2); g.fill();
            for (const side of [-1, 1]) {
              g.fillStyle = 'rgba(0,90,0,.5)';
              g.beginPath(); g.ellipse(side * 10, -2, 7, 15, side * .55, 0, Math.PI * 2); g.fill(); g.stroke();
              for (let vein = 0; vein < 4; vein++) { g.beginPath(); g.moveTo(side * 2, -4); g.lineTo(side * (9 + vein * 2), -13 + vein * 7); g.stroke(); }
              for (let leg = 0; leg < 3; leg++) { g.beginPath(); g.moveTo(side * 2, -3 + leg * 5); g.lineTo(side * 7, -5 + leg * 5); g.lineTo(side * 11, -9 + leg * 8); g.stroke(); }
              g.beginPath(); g.moveTo(side, -10); g.quadraticCurveTo(side * 5, -18, side * 8, -17); g.stroke();
            }
            g.restore();
          }
          // Words and letters (red), softer the deeper they lie.
          for (const it of items) {
            if (Math.min(SHEETS - 1, Math.floor(it.z * SHEETS)) !== layer) continue;
            g.save();
            g.translate(it.x * S, it.y * S);
            g.rotate(it.angle);
            g.font = `${it.letter ? 'italic ' : ''}600 ${it.size * S}px Georgia, "Times New Roman", serif`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            const blur = depth * 3.4 * S;
            if (blur > 0.8) {
              // Blur by stamping the text many times around its place (a shadow-only trick gets clipped by browsers
              // and canvas filters are missing in Safari).
              g.fillStyle = 'rgba(255,0,0,0.07)';
              g.fillText(it.text, 0, 0);
              for (let k = 0; k < 8; k += 1) g.fillText(it.text, Math.cos((k * Math.PI) / 4) * blur * 0.5, Math.sin((k * Math.PI) / 4) * blur * 0.5);
              for (let k = 0; k < 12; k += 1) g.fillText(it.text, Math.cos((k * Math.PI) / 6) * blur, Math.sin((k * Math.PI) / 6) * blur);
            } else {
              g.fillStyle = 'rgb(255,0,0)';
              g.fillText(it.text, 0, 0);
            }
            g.restore();
          }
          // Plant fibres (green): a few thin curved strands and a torn fragment of a leaf, like the trash that gets
          // caught in resin.
          const strands = Math.round(1.2 * p.inclusions * areaScale);
          for (let i = 0; i < strands; i += 1) {
            const x = rnd(layer * 300 + i) * lw;
            const y = rnd(layer * 300 + i + 100) * lh;
            const len = (30 + rnd(layer * 300 + i + 200) * 70) * S;
            const bend = (rnd(layer * 300 + i + 250) - 0.5) * len * 0.8;
            const a = rnd(layer * 300 + i + 280) * Math.PI;
            g.save();
            g.translate(x, y);
            g.rotate(a);
            g.strokeStyle = 'rgb(0,255,0)';
            g.lineCap = 'round';
            g.lineWidth = Math.max(1, (0.8 + rnd(i + layer) * 1.1) * S);
            g.beginPath();
            g.moveTo(0, 0);
            g.quadraticCurveTo(len / 2, bend, len, bend * 0.4);
            g.stroke();
            if (rnd(layer * 300 + i + 290) < 0.3) {
              g.fillStyle = 'rgba(0,200,0,1)';
              g.beginPath();
              g.ellipse(len * 0.55, bend * 0.6, 5 * S, 2 * S, 0.6, 0, Math.PI * 2);
              g.fill();
            }
            g.restore();
          }
        } else if (p.inclusions > 0) {
          // The sun spangles (red): flat discs with a ring and a burst of cracks.
          const count = 2 + Math.round(areaScale);
          for (let i = 0; i < count; i += 1) {
            const x = (0.12 + rnd(i + 3000) * 0.76) * lw;
            const y = (0.22 + rnd(i + 3100) * 0.56) * lh;
            const rx = (18 + rnd(i + 3200) * 28) * S;
            g.save();
            g.translate(x, y);
            g.rotate((rnd(i + 3300) - 0.5) * 0.5);
            g.scale(1, 0.34);
            g.strokeStyle = 'rgba(255,0,0,0.75)';
            g.lineWidth = 1.4 * S;
            g.beginPath();
            g.arc(0, 0, rx, 0, Math.PI * 2);
            g.stroke();
            for (let k = 0; k < 30; k += 1) {
              const a = (k / 30) * Math.PI * 2 + rnd(i * 50 + k) * 0.2;
              const r0 = rx * (0.12 + rnd(i * 60 + k) * 0.22);
              const r1 = rx * (0.7 + rnd(i * 70 + k) * 0.28);
              g.strokeStyle = `rgba(255,0,0,${0.35 + rnd(k + 20) * 0.5})`;
              g.lineWidth = 0.9 * S;
              g.beginPath();
              g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
              g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
              g.stroke();
            }
            g.restore();
          }
        }
        gl!.bindTexture(gl!.TEXTURE_2D_ARRAY, texture);
        gl!.texSubImage3D(gl!.TEXTURE_2D_ARRAY, 0, 0, 0, layer, lw, lh, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, sheet);
      }
    }
    build();

    const lamp = { x: width * 0.5, y: height * 0.45 };
    const view = { x: 0, y: 0 };
    let scale = clamp(p.quality, 0.35, 1);
    let sizedFor = -1;
    let clock = 0;
    /** Seconds since the cursor left the card: the lamp stays put a moment, then drifts off on its own. */
    let away = 0;

    function pill(x: number, y: number, w: number, h: number) {
      const r = h / 2;
      octx!.beginPath();
      octx!.moveTo(x + r, y);
      octx!.lineTo(x + w - r, y);
      octx!.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
      octx!.lineTo(x + r, y + h);
      octx!.arc(x + r, y + r, r, Math.PI / 2, (Math.PI * 3) / 2);
      octx!.closePath();
    }

    /** What the word nearest to the lamp means, written over the picture. */
    function drawCaption(active: boolean) {
      octx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx!.clearRect(0, 0, width, height);
      if (!active) return;
      let best: Item | null = null;
      let bestD = clamp(height * 0.75, 100, 230) * p.lamp * 0.45;
      let bx = 0;
      let by = 0;
      for (const it of items) {
        if (!it.meaning) continue;
        // Where the word appears: it is drawn at its own depth, so a tilt of the view shifts it.
        // A sheet at depth z is met by a ray that has moved sideways by (0.05 * p + tilt) * z * D, in units of half the
        // card's height (see the shader).
        const half = height / 2;
        const px = (it.x - width / 2) / half;
        const py = (height / 2 - it.y) / half;
        const x = it.x + (px * 0.05 + view.x * 0.32 * p.parallax) * it.z * 0.9 * half;
        const y = it.y - (py * 0.05 + view.y * 0.2 * p.parallax) * it.z * 0.9 * half;
        const d = Math.hypot(x - lamp.x, y - lamp.y);
        if (d < bestD) {
          best = it;
          bestD = d;
          bx = x;
          by = y;
        }
      }
      if (!best) return;
      const label = `${best.text} — ${pick(best.meaning!, uk)}`;
      octx!.font = `600 ${clamp(13 * fontScale, 12, 16)}px Georgia, "Times New Roman", serif`;
      const w = octx!.measureText(label).width + 20;
      const h = 24;
      const x = clamp(bx - w / 2, 6, width - w - 6);
      const y = clamp(by + 22, 4, height - h - 4);
      pill(x, y, w, h);
      octx!.fillStyle = 'rgba(52,18,2,0.8)';
      octx!.fill();
      octx!.strokeStyle = 'rgba(255,214,120,0.75)';
      octx!.lineWidth = 1;
      octx!.stroke();
      octx!.fillStyle = '#fff1c8';
      octx!.textBaseline = 'middle';
      octx!.fillText(label, x + 10, y + h / 2 + 0.5);
    }

    function draw(t: number) {
      // At most ~750 000 pixels are shaded, whatever the size of the card.
      const budget = Math.sqrt(750000 / (width * height * dpr * dpr));
      const wanted = Math.max(2, Math.round(width * dpr * Math.min(scale, budget)));
      if (wanted !== sizedFor) {
        sizedFor = wanted;
        canvas!.width = wanted;
        canvas!.height = Math.max(2, Math.round(height * dpr * Math.min(scale, budget)));
      }
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      gl!.uniform1f(uTime, t);
      gl!.uniform3f(uLamp, lamp.x / width, lamp.y / height, 0.3);
      gl!.uniform2f(uTilt, view.x * 0.32 * p.parallax, view.y * 0.2 * p.parallax);
      gl!.uniform1f(uGlow, p.glow);
      gl!.uniform1f(uCloud, p.cloud);
      gl!.uniform1f(uDepth, p.depth);
      gl!.uniform1f(uSparkle, p.sparkle);
      gl!.uniform1f(uBubbles, p.inclusions);
      gl!.uniform1f(uSss, p.sss);
      gl!.uniform1f(uLampSize, (3.4 * clamp(height * 0.75, 100, 230) * p.lamp) / height);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      draw(0);
      return;
    }

    let contextLost = false;
    const onLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
    };
    canvas.addEventListener('webglcontextlost', onLost);

    let rafId = 0;
    let last = 0;
    let slow = 0;
    const loop = profileEffectFrame(canvas, (time: number) => {
      rafId = requestAnimationFrame(loop);
      if (contextLost) return;
      const raw = last ? time - last : 16;
      const dt = Math.min(raw / 1000, 0.05);
      last = time;
      clock += dt;
      // A machine that cannot keep up gets a coarser picture (the resin is soft, it hardly shows).
      if (raw < 250) {
        slow = raw > 34 ? slow + 1 : Math.max(0, slow - 2);
        if (slow > 30 && scale > 0.4) {
          scale *= 0.85;
          slow = 0;
        }
      }
      if (p.words !== builtWords || p.inclusions !== builtInclusions) build();
      const target = clamp(p.quality, 0.35, 1);
      if (target < scale || (slow === 0 && target > scale + 0.001 && raw < 20)) scale += (target - scale) * 0.02;
      const cursor = pointerRef.current;
      let tx: number;
      let ty: number;
      if (cursor.active) {
        away = 0;
        tx = cursor.x + width / 2;
        ty = height / 2 - cursor.y;
      } else {
        // Idle: the lamp rests where the cursor left it for a moment, then eases onto a slow wander through the resin.
        away += dt;
        const wander = Math.min(1, Math.max(0, (away - 1.5) / 2.5));
        const k = wander * wander * (3 - 2 * wander);
        tx = lamp.x + (width * (0.5 + 0.36 * Math.sin(clock * 0.21)) - lamp.x) * k;
        ty = lamp.y + (height * (0.5 + 0.3 * Math.sin(clock * 0.33 + 1)) - lamp.y) * k;
      }
      // Under the cursor the lamp keeps up closely (no lag trail); on its own it moves gently.
      const follow = 1 - Math.exp(-dt * (cursor.active ? 16 : 1.2));
      lamp.x += (tx - lamp.x) * follow;
      lamp.y += (ty - lamp.y) * follow;
      view.x += ((lamp.x / width - 0.5) * 2 - view.x) * Math.min(1, dt * 3);
      view.y += ((lamp.y / height - 0.5) * 2 - view.y) * Math.min(1, dt * 3);
      draw(clock);
      drawCaption(cursor.active);
    });
    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('webglcontextlost', onLost);
      // The context itself stays: the same canvas is used again when the card is resized, and a lost context cannot be.
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
    };
  }, [width, height, pointerRef, params, uk]);

  return (
    <>
      <canvas ref={glRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </>
  );
}
