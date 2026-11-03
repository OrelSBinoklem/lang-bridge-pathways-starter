/** Small helpers for the 2D scenes. */
export const TAU = Math.PI * 2;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** '#rrggbb' + alpha as a CSS colour. */
export function rgba(hex: string, alpha = 1): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x888888;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x888888;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mixes two '#rrggbb' colours. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(lerp(ar, br, t))}${h(lerp(ag, bg, t))}${h(lerp(ab, bb, t))}`;
}

/** A vertical gradient over the whole picture. */
export function fillGradient(g: CanvasRenderingContext2D, w: number, h: number, top: string, bottom: string) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

/** A soft round glow (draw with 'lighter' for light). */
export function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, hex: string, alpha = 1) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, rgba(hex, alpha));
  grad.addColorStop(1, rgba(hex, 0));
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

export function pill(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = Math.min(h / 2, w / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  g.lineTo(x + r, y + h);
  g.arc(x + r, y + r, r, Math.PI / 2, (Math.PI * 3) / 2);
  g.closePath();
}

export function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.beginPath();
  g.moveTo(x, y + s * 0.35);
  g.bezierCurveTo(x - s * 0.9, y - s * 0.3, x - s * 0.4, y - s * 0.95, x, y - s * 0.4);
  g.bezierCurveTo(x + s * 0.4, y - s * 0.95, x + s * 0.9, y - s * 0.3, x, y + s * 0.35);
  g.closePath();
}

export const FONT_SERIF = 'Georgia, "Times New Roman", serif';
export const FONT_SANS = '"Segoe UI", system-ui, -apple-system, Arial, sans-serif';
