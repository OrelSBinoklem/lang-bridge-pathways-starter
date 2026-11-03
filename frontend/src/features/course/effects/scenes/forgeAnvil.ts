import type { CanvasSceneDef } from './types';
import { TAU, clamp, rgba } from './kit';

/**
 * "Masters of crafts and adventures": a blacksmith's anvil in a dark smithy. The bar on it glows by its temperature
 * — the colour of a black body (Tanner Helland's fit of Planck's law) and a brightness that climbs steeply with heat —
 * white-yellow fresh from the forge, cooling to orange, cherry red, dull red and dark steel; then it goes back into the
 * forge (the fire flares) and comes out hot again. The hammer follows the cursor and strikes on a click (on its own a
 * steady rhythm): scale flies off in a shower of sparks that cool as they fly and bounce off the floor, the bar spreads
 * a little under each blow, and the hot metal lights the anvil, the hammer and the wall around it.
 */

/** Black-body colour for a temperature in kelvin, as [r, g, b] 0…1 (Tanner Helland's fit). */
function blackbody(kelvin: number): [number, number, number] {
  const t = kelvin / 100;
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255];
}
/** How bright hot steel looks: nothing below ~800 K, then climbing steeply (visible radiance rises far faster than T⁴). */
const glowOf = (kelvin: number) => clamp((kelvin - 780) / 700, 0, 1.4) ** 2.2;
const css = (c: [number, number, number], k = 1, a = 1) =>
  `rgba(${Math.round(clamp(c[0] * k, 0, 1) * 255)},${Math.round(clamp(c[1] * k, 0, 1) * 255)},${Math.round(clamp(c[2] * k, 0, 1) * 255)},${a})`;

type Spark = { x: number; y: number; px: number; py: number; vx: number; vy: number; heat: number; life: number; age: number };

export const FORGE_ANVIL: CanvasSceneDef = {
  kind: 'canvas',
  id: 'forge',
  label: 'Кузница',
  palettes: [['#0d0906', '#3a2418', '#ff8a2a', '#ffd48a']],
  create(c) {
    const W = c.width;
    const H = c.height;
    const S = c.dpr;
    const rand = c.rand;
    const u = clamp(H / 150, 0.8, 3);
    const floorY = H * 0.9;
    const anvil = { x: W * (c.body ? 0.5 : 0.62), top: H * 0.52, w: Math.min(W * 0.24, H * 1.0) };
    const forge = { x: Math.min(W - H * 0.35, anvil.x + anvil.w * 1.25), y: H * 0.7, w: H * 0.55 };

    // The smithy, painted once: rough stone wall, the floor, the anvil's steel shape.
    const make = () => {
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(W * S));
      cv.height = Math.max(1, Math.round(H * S));
      const g = cv.getContext('2d')!;
      g.scale(S, S);
      return { cv, g };
    };
    const room = make();
    {
      const g = room.g;
      g.fillStyle = '#120c09';
      g.fillRect(0, 0, W, H);
      const stone = 16 * u;
      for (let row = 0, y = 0; y < floorY; y += stone * 0.8, row += 1) {
        for (let x = (row % 2) * -stone * 0.6; x < W; x += stone * (1 + rand() * 0.5)) {
          const w = stone * (0.9 + rand() * 0.6);
          const v = 0.8 + rand() * 0.4;
          g.fillStyle = `rgb(${Math.round(30 * v)},${Math.round(23 * v)},${Math.round(19 * v)})`;
          g.beginPath();
          g.roundRect(x + 1, y + 1, w - 2, stone * 0.8 - 2, 3 * u);
          g.fill();
        }
      }
      const floor = g.createLinearGradient(0, floorY, 0, H);
      floor.addColorStop(0, '#1d140f');
      floor.addColorStop(1, '#0a0705');
      g.fillStyle = floor;
      g.fillRect(0, floorY, W, H - floorY);
    }
    // The anvil: horn to the left, face on top, waist and a heavy foot.
    const anvilPath = (g: CanvasRenderingContext2D) => {
      const { x, top, w } = anvil;
      const h = floorY - top;
      g.beginPath();
      g.moveTo(x - w * 0.62, top + h * 0.02);
      g.quadraticCurveTo(x - w * 0.45, top - h * 0.02, x - w * 0.3, top);
      g.lineTo(x + w * 0.5, top);
      g.lineTo(x + w * 0.5, top + h * 0.22);
      g.lineTo(x + w * 0.2, top + h * 0.3);
      g.lineTo(x + w * 0.14, top + h * 0.72);
      g.lineTo(x + w * 0.36, top + h * 0.86);
      g.lineTo(x + w * 0.36, floorY);
      g.lineTo(x - w * 0.36, floorY);
      g.lineTo(x - w * 0.36, top + h * 0.86);
      g.lineTo(x - w * 0.14, top + h * 0.72);
      g.lineTo(x - w * 0.2, top + h * 0.3);
      g.quadraticCurveTo(x - w * 0.5, top + h * 0.2, x - w * 0.62, top + h * 0.02);
      g.closePath();
    };

    let temp = 1450;
    let reheating = 0;
    let spread = 0;
    const hammer = { x: anvil.x, angle: 0.9, swing: 0, strikeAt: -1 };
    let auto = 0.6;
    let flash = 0;
    let shake = 0;
    const sparks: Spark[] = [];
    let clock = 0;

    const strike = () => {
      if (hammer.swing > 0) return;
      hammer.swing = 0.001;
    };
    const impact = (x: number, y: number) => {
      flash = 1;
      shake = 1;
      spread = Math.min(1, spread + 0.06);
      temp = Math.min(1500, temp + 15);
      const hot = glowOf(temp);
      const n = Math.round(30 + 70 * clamp(hot, 0.2, 1));
      for (let i = 0; i < n; i += 1) {
        const a = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.6;
        const v = (120 + rand() * 300) * u;
        sparks.push({ x, y, px: x, py: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, heat: temp - rand() * 200, life: 0.6 + rand() * 0.9, age: 0 });
      }
    };

    return {
      update(dt, t, p) {
        const step = Math.min(dt, 0.05) * clamp(c.params.speed, 0.2, 3);
        clock += step;
        // Cooling: fast while white-hot (radiation), slower as it dulls.
        if (reheating > 0) {
          reheating -= step;
          if (reheating <= 0) {
            temp = 1480;
            spread = 0;
          }
        } else {
          temp -= step * (temp - 300) * 0.045 * (temp / 1200) ** 3 * 3;
          if (temp < 860) reheating = 1.4;
        }
        // The hammer: follows the cursor over the anvil, strikes on a click; on its own, a steady rhythm.
        const tx = p.active ? clamp(p.x, anvil.x - anvil.w * 0.3, anvil.x + anvil.w * 0.4) : anvil.x + Math.sin(clock * 0.6) * anvil.w * 0.12;
        hammer.x += (tx - hammer.x) * Math.min(1, step * 12);
        if (p.active && p.clicked && c.params.react > 0 && reheating <= 0) strike();
        if (!p.active && reheating <= 0) {
          auto -= step;
          if (auto <= 0) {
            strike();
            auto = 0.75 + rand() * 0.25;
          }
        }
        if (hammer.swing > 0) {
          hammer.swing += step / 0.32;
          // Down fast (the first third), then back up.
          const k = hammer.swing;
          hammer.angle = k < 0.35 ? 0.9 - (k / 0.35) ** 2 * 0.9 : 0.9 * clamp((k - 0.35) / 0.65, 0, 1) ** 0.6;
          if (k >= 0.35 && hammer.strikeAt < 0) {
            hammer.strikeAt = clock;
            impact(hammer.x, anvil.top - H * 0.035);
          }
          if (k >= 1) {
            hammer.swing = 0;
            hammer.strikeAt = -1;
            hammer.angle = 0.9;
          }
        }
        flash = Math.max(0, flash - step * 7);
        shake = Math.max(0, shake - step * 9);
        for (let i = sparks.length - 1; i >= 0; i -= 1) {
          const s = sparks[i];
          s.px = s.x;
          s.py = s.y;
          s.age += step;
          s.vy += 520 * u * step;
          s.vx *= 1 - 0.8 * step;
          s.x += s.vx * step;
          s.y += s.vy * step;
          s.heat -= step * 700;
          if (s.y > floorY && s.vy > 0) {
            s.y = floorY;
            s.vy *= -0.35;
            s.vx *= 0.6;
          }
          if (s.age > s.life || s.heat < 800) sparks.splice(i, 1);
        }
        void t;
      },
      draw(g) {
        const intensity = clamp(c.params.intensity, 0.3, 2);
        const jitter = shake * 1.5 * u;
        g.save();
        g.translate((rand() - 0.5) * jitter, (rand() - 0.5) * jitter);
        g.drawImage(room.cv, 0, 0, W, H);
        const hot = glowOf(temp) * (reheating > 0 ? 0 : 1);
        const col = blackbody(temp);
        const fire = 0.7 + 0.3 * Math.sin(clock * 11) * Math.sin(clock * 7.3) + (reheating > 0 ? 0.8 : 0);
        // Light on the wall and floor: the forge's fire and the hot bar.
        g.globalCompositeOperation = 'lighter';
        const lightAt = (x: number, y: number, r: number, color: string) => {
          const gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, color);
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        };
        lightAt(forge.x, forge.y, H * 1.1, `rgba(255,110,30,${(0.22 * fire * intensity).toFixed(3)})`);
        if (hot > 0) lightAt(anvil.x, anvil.top - H * 0.04, H * (0.6 + 0.4 * hot), css(col, 1, 0.3 * hot * intensity));
        if (flash > 0) lightAt(hammer.x, anvil.top, H * 1.2, `rgba(255,200,120,${(0.35 * flash * intensity).toFixed(3)})`);
        g.globalCompositeOperation = 'source-over';
        // The forge: a stone hearth with glowing coals and flames.
        {
          const { x, y, w } = forge;
          g.fillStyle = '#2a1d16';
          g.beginPath();
          g.roundRect(x - w / 2, y, w, floorY - y, 4 * u);
          g.fill();
          g.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 9; i += 1) {
            const cx = x - w * 0.38 + (i / 8) * w * 0.76;
            const flick = 0.6 + 0.4 * Math.sin(clock * (5 + i) + i * 2.1);
            lightAt(cx, y + 3 * u, 12 * u * (0.7 + flick * 0.5), `rgba(255,${Math.round(90 + 90 * flick)},30,${(0.55 * intensity).toFixed(3)})`);
          }
          for (let i = 0; i < 6; i += 1) {
            const k = (clock * (1.2 + i * 0.13) + i * 0.37) % 1;
            const fx = x + Math.sin(i * 3.1 + clock * 2) * w * 0.25;
            const fy = y - k * H * 0.35 * fire;
            lightAt(fx, fy, (18 - k * 12) * u, `rgba(255,${Math.round(160 - k * 100)},40,${((1 - k) * 0.45 * intensity).toFixed(3)})`);
          }
          g.globalCompositeOperation = 'source-over';
        }
        // The anvil: dark steel, its face and edges catching the light of the bar.
        anvilPath(g);
        const steel = g.createLinearGradient(0, anvil.top, 0, floorY);
        steel.addColorStop(0, '#3a3c42');
        steel.addColorStop(0.3, '#1e1f23');
        steel.addColorStop(1, '#101114');
        g.fillStyle = steel;
        g.fill();
        g.save();
        g.clip();
        g.globalCompositeOperation = 'lighter';
        lightAt(anvil.x, anvil.top, anvil.w * 0.7, css(col, 1, 0.35 * hot * intensity));
        lightAt(forge.x - forge.w * 0.3, forge.y, anvil.w, `rgba(255,120,40,${(0.12 * fire * intensity).toFixed(3)})`);
        g.restore();
        g.strokeStyle = css(col, 1, 0.25 + 0.5 * hot);
        g.lineWidth = 1.2 * u;
        g.beginPath();
        g.moveTo(anvil.x - anvil.w * 0.3, anvil.top + 0.5);
        g.lineTo(anvil.x + anvil.w * 0.5, anvil.top + 0.5);
        g.stroke();
        // The bar: steel with its own glow; it spreads a little under each blow.
        if (reheating <= 0) {
          const bw = anvil.w * (0.55 + spread * 0.15);
          const bh = H * (0.05 - spread * 0.012);
          const bx = anvil.x - bw * 0.4;
          const by = anvil.top - bh;
          g.fillStyle = '#34353a';
          g.beginPath();
          g.roundRect(bx, by, bw, bh, bh * 0.4);
          g.fill();
          g.globalCompositeOperation = 'lighter';
          const face = g.createLinearGradient(bx, 0, bx + bw, 0);
          face.addColorStop(0, css(col, 0.55 * hot));
          face.addColorStop(0.4, css(col, 1.1 * hot));
          face.addColorStop(1, css(col, 0.7 * hot));
          g.fillStyle = face;
          g.beginPath();
          g.roundRect(bx, by, bw, bh, bh * 0.4);
          g.fill();
          lightAt(bx + bw * 0.45, by + bh / 2, bh * 3.2, css(col, 1, 0.5 * hot * intensity));
          g.globalCompositeOperation = 'source-over';
        }
        // The hammer: a wooden handle and a steel head pivoting at the smith's hand, lit by the bar below.
        {
          const pivotX = hammer.x + H * 0.42;
          // Level at the blow, the head resting on the bar.
          const pivotY = anvil.top - H * 0.155;
          g.save();
          g.translate(pivotX, pivotY);
          g.rotate(hammer.angle);
          const len = H * 0.42;
          g.fillStyle = '#5a3a22';
          g.fillRect(-len, -2.5 * u, len, 5 * u);
          const hw = H * 0.1;
          const hh = H * 0.16;
          const head = g.createLinearGradient(-len - hw / 2, 0, -len + hw / 2, 0);
          head.addColorStop(0, '#2c2d31');
          head.addColorStop(0.5, '#55575e');
          head.addColorStop(1, '#2a2b2f');
          g.fillStyle = head;
          g.beginPath();
          g.roundRect(-len - hw / 2, -hh * 0.35, hw, hh, 2 * u);
          g.fill();
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = css(col, 1, 0.25 * hot);
          g.fillRect(-len - hw / 2, hh * 0.45, hw, hh * 0.2);
          g.restore();
        }
        // Sparks: streaks that cool from white-yellow to orange and red as they fly.
        g.globalCompositeOperation = 'lighter';
        g.lineCap = 'round';
        for (const s of sparks) {
          const sc = blackbody(s.heat);
          const b = glowOf(s.heat) * intensity;
          g.strokeStyle = css(sc, 1, clamp(b * 1.4, 0, 1));
          g.lineWidth = 1.4 * u;
          g.beginPath();
          g.moveTo(s.px, s.py);
          g.lineTo(s.x, s.y);
          g.stroke();
        }
        g.globalCompositeOperation = 'source-over';
        g.restore();
        // A warm haze over everything.
        g.fillStyle = rgba('#ff7a2a', 0.04 * fire);
        g.fillRect(0, 0, W, H);
        void TAU;
      },
    };
  },
};
