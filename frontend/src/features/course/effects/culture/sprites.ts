/** Small pre-rendered sprites shared by the "Культура и язык" effects. */

/** A soft four-pointed sparkle (white, for 'lighter' compositing). */
export function makeSparkleSprite(size = 64): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) return c;
  const mid = size / 2;
  const glow = g.createRadialGradient(mid, mid, 0, mid, mid, mid * 0.5);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[size, 3], [3, size]]) {
    const beam = g.createLinearGradient(0, 0, w > h ? size : 0, w > h ? 0 : size);
    beam.addColorStop(0, 'rgba(255,255,255,0)');
    beam.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    beam.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = beam;
    g.fillRect(mid - w / 2, mid - h / 2, w, h);
  }
  return c;
}

/** A soft round glow of one colour, for 'lighter' compositing. */
export function makeGlowSprite(rgb: [number, number, number], size = 64, hardness = 0.25): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) return c;
  const mid = size / 2;
  const grad = g.createRadialGradient(mid, mid, 0, mid, mid, mid);
  grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`);
  grad.addColorStop(hardness, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.55)`);
  grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}
