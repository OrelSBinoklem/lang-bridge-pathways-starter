/** Hand-drawn anime emotion marks (canvas 2D, no emoji fonts) used as camera-facing sprites around the cat. */
import * as THREE from 'three';
import type { SpriteKind } from './catPose';

const SIZE = 128;
type Draw = (g: CanvasRenderingContext2D) => void;

function outlined(g: CanvasRenderingContext2D, fill: string | CanvasGradient, line = '#151827', width = 7) {
  g.lineJoin = 'round'; g.lineWidth = width; g.strokeStyle = line; g.stroke(); g.fillStyle = fill; g.fill();
}
function drop(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  g.beginPath(); g.moveTo(x, y - s); g.bezierCurveTo(x + s * 0.2, y - s * 0.4, x + s * 0.75, y + s * 0.05, x + s * 0.62, y + s * 0.45);
  g.arc(x, y + s * 0.42, s * 0.62, 0.05, Math.PI - 0.05); g.bezierCurveTo(x - s * 0.75, y + s * 0.05, x - s * 0.2, y - s * 0.4, x, y - s);
  outlined(g, color, '#1b2a4a', 6);
  g.beginPath(); g.ellipse(x - s * 0.22, y + s * 0.28, s * 0.12, s * 0.22, -0.4, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
}
function label(g: CanvasRenderingContext2D, text: string, size: number, fill: string, x = SIZE / 2, y = SIZE / 2) {
  g.font = `900 ${size}px "Arial Black", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = '#151827'; g.strokeText(text, x, y); g.fillStyle = fill; g.fillText(text, x, y);
}
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, rr = i % 2 ? r * 0.28 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); outlined(g, fill, '#3a2a10', 5);
}

const DRAW: Record<SpriteKind, Draw> = {
  heart: g => {
    g.beginPath(); g.moveTo(64, 108); g.bezierCurveTo(10, 72, 14, 22, 44, 22); g.bezierCurveTo(56, 22, 62, 30, 64, 40);
    g.bezierCurveTo(66, 30, 72, 22, 84, 22); g.bezierCurveTo(114, 22, 118, 72, 64, 108); g.closePath();
    const gr = g.createLinearGradient(0, 22, 0, 108); gr.addColorStop(0, '#ff7aa2'); gr.addColorStop(1, '#e0245e');
    outlined(g, gr, '#5a1028', 7);
    g.beginPath(); g.ellipse(44, 42, 9, 13, -0.6, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill();
  },
  anger: g => {
    g.lineCap = 'round';
    for (const [a] of [[0], [Math.PI / 2], [Math.PI], [Math.PI * 1.5]]) {
      g.save(); g.translate(64, 64); g.rotate(a + Math.PI / 4); g.beginPath(); g.moveTo(10, -30); g.quadraticCurveTo(12, -12, 30, -10);
      g.lineWidth = 22; g.strokeStyle = '#151827'; g.stroke(); g.lineWidth = 12; g.strokeStyle = '#ff3b3b'; g.stroke(); g.restore();
    }
  },
  sweat: g => drop(g, 64, 50, 42, '#8fd3ff'),
  tear: g => drop(g, 64, 52, 36, '#7cc8ff'),
  exclaim: g => {
    g.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8, r = i % 2 ? 40 : 60; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
    g.closePath(); outlined(g, '#ffe14d', '#3a2a10', 6); label(g, '!', 70, '#ff4d3a', 64, 68);
  },
  question: g => label(g, '?', 92, '#ffffff', 64, 66),
  sparkle: g => { star(g, 58, 60, 46, '#fff6b0'); star(g, 100, 28, 18, '#ffffff'); },
  zzz: g => { label(g, 'Z', 54, '#cfe0ff', 46, 80); label(g, 'z', 40, '#cfe0ff', 86, 40); },
  note: g => {
    g.beginPath(); g.ellipse(46, 92, 20, 14, -0.45, 0, Math.PI * 2); g.rect(58, 22, 9, 70); g.moveTo(58, 22); g.quadraticCurveTo(96, 30, 100, 62); g.quadraticCurveTo(88, 44, 67, 44);
    outlined(g, '#7a5cff', '#160f33', 7);
  },
  gloom: g => {
    g.lineCap = 'round';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(20 + i * 22, 10); g.lineTo(20 + i * 22, 70 + (i % 2) * 30); g.lineWidth = 9; g.strokeStyle = 'rgba(92,70,170,.85)'; g.stroke(); }
  },
  dots: g => {
    g.beginPath(); g.ellipse(64, 60, 54, 38, 0, 0, Math.PI * 2); outlined(g, '#ffffff', '#151827', 6);
    g.beginPath(); g.arc(20, 108, 8, 0, Math.PI * 2); outlined(g, '#ffffff', '#151827', 5);
    for (const x of [40, 64, 88]) { g.beginPath(); g.arc(x, 60, 7, 0, Math.PI * 2); g.fillStyle = '#151827'; g.fill(); }
  },
};

const cache = new Map<SpriteKind, THREE.Texture>();
export function spriteTexture(kind: SpriteKind): THREE.Texture {
  const hit = cache.get(kind);
  if (hit) return hit;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
  const g = canvas.getContext('2d')!;
  DRAW[kind](g);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(kind, texture);
  return texture;
}
export function disposeSpriteTextures() { cache.forEach(t => t.dispose()); cache.clear(); }

/** A soft pink blush with anime hatching, for the cheeks. */
export function blushTexture(): THREE.Texture {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
  const g = canvas.getContext('2d')!;
  const gr = g.createRadialGradient(64, 32, 4, 64, 32, 60); gr.addColorStop(0, 'rgba(255,120,160,.9)'); gr.addColorStop(1, 'rgba(255,120,160,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
  g.strokeStyle = 'rgba(255,90,140,.95)'; g.lineWidth = 5; g.lineCap = 'round';
  for (const x of [42, 60, 78]) { g.beginPath(); g.moveTo(x + 8, 18); g.lineTo(x - 4, 46); g.stroke(); }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
