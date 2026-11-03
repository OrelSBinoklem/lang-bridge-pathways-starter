import type { CanvasSceneDef } from './types';
import { TAU, clamp, mixHex, rgba } from './kit';

/**
 * "Nice to meet you": greetings in many languages written in the evening air with a sparkler, the way a long-exposure
 * photo keeps a sparkler's path. The burning tip runs along each word, bouncing over its letters like a hand writing,
 * showering branching sparks; behind it the word stays lit, cools from white-gold to its own colour, then fades. Two or
 * three words are in the air at once. The cursor is a second sparkler: it paints its own fading trail, and a click
 * throws a shower of sparks.
 */

const GREETINGS = [
  'Sveiki!', 'Labdien!', 'Привет!', 'Привіт!', 'Hello!', 'Hola!', 'Bonjour!', 'Ciao!', 'Hallo!', 'Tere!', 'Labas!',
  'Cześć!', 'Hej!', 'Olá!', 'Merhaba!', 'Ahoj!', 'Moi!', 'Szia!', 'Γειά σου!', 'Salve!', 'Namaste!', 'こんにちは', '你好', '안녕하세요',
];
const INK = ['#ffd47a', '#ff8fb8', '#8fe3ff', '#c9a2ff', '#9dffb0', '#ffb070'];
const FONT = `"Segoe Script", "Brush Script MT", "Snell Roundhand", "Apple Chancery", "Comic Sans MS", cursive`;

type Word = {
  text: string;
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  ink: string;
  age: number;
  write: number;
  hold: number;
  fade: number;
};
type Spark = { x: number; y: number; px: number; py: number; vx: number; vy: number; age: number; life: number; gen: number };

export const GREETINGS_SPARKLER: CanvasSceneDef = {
  kind: 'canvas',
  id: 'greetings',
  label: 'Приветствия бенгальским огнём',
  palettes: [['#0b0a1f', '#2a1b4a', '#ffd47a', '#ff8fb8'], ['#07131f', '#113049', '#8fe3ff', '#ffd47a']],
  create(c) {
    const W = c.width;
    const H = c.height;
    const S = c.dpr;
    const rand = c.rand;
    const unit = clamp(H / 150, 0.8, 3);

    // The evening behind: a deep gradient and soft out-of-focus lights, painted once.
    const back = document.createElement('canvas');
    back.width = Math.max(1, Math.round(W * S));
    back.height = Math.max(1, Math.round(H * S));
    const b = back.getContext('2d')!;
    b.scale(S, S);
    const sky = b.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, c.palette[0]);
    sky.addColorStop(1, c.palette[1]);
    b.fillStyle = sky;
    b.fillRect(0, 0, W, H);
    b.globalCompositeOperation = 'lighter';
    for (let i = 0; i < Math.round((W * H) / 2600); i += 1) {
      const x = rand() * W;
      const y = rand() * H;
      const r = (6 + rand() * 22) * unit;
      const col = INK[Math.floor(rand() * INK.length)];
      const g = b.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(col, 0.05 + rand() * 0.06));
      g.addColorStop(0.7, rgba(col, 0.03));
      g.addColorStop(1, rgba(col, 0));
      b.fillStyle = g;
      b.beginPath();
      b.arc(x, y, r, 0, TAU);
      b.fill();
    }

    const words: Word[] = [];
    const sparks: Spark[] = [];
    const smoke: { x: number; y: number; r: number; age: number }[] = [];
    const trail: { x: number; y: number; t: number }[] = [];
    let clock = 0;
    let nextWord = 0.2;
    let order = Math.floor(rand() * GREETINGS.length);

    /** The word lit in the air: its colour with a wide glow, and a white-hot core line. */
    const bake = (text: string, size: number, ink: string) => {
      const m = document.createElement('canvas').getContext('2d')!;
      m.font = `700 ${size}px ${FONT}`;
      const w = m.measureText(text).width + size * 0.8;
      const h = size * 1.8;
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(w * S));
      cv.height = Math.max(1, Math.round(h * S));
      const g = cv.getContext('2d')!;
      g.scale(S, S);
      g.font = `700 ${size}px ${FONT}`;
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.globalCompositeOperation = 'lighter';
      g.shadowColor = ink;
      g.shadowBlur = size * 0.5;
      g.fillStyle = rgba(ink, 0.55);
      g.fillText(text, size * 0.4, h / 2);
      g.shadowBlur = size * 0.15;
      g.fillStyle = mixHex(ink, '#ffffff', 0.45);
      g.fillText(text, size * 0.4, h / 2);
      g.shadowBlur = 0;
      g.lineWidth = Math.max(0.8, size * 0.04);
      g.strokeStyle = 'rgba(255,255,240,0.9)';
      g.strokeText(text, size * 0.4, h / 2);
      return { canvas: cv, w, h };
    };

    const place = (w: number, h: number) => {
      // The card's text is on the left: words go to the right three fifths, clear of the ones already there.
      for (let tries = 0; tries < 20; tries += 1) {
        const x = W * 0.36 + rand() * Math.max(1, W * 0.62 - w);
        const y = h * 0.45 + rand() * Math.max(1, H - h * 0.9);
        if (words.every((o) => x + w < o.x || x > o.x + o.w || y + h * 0.5 < o.y - o.h * 0.5 || y - h * 0.5 > o.y + o.h * 0.5)) return { x, y };
      }
      return { x: W * 0.4 + rand() * Math.max(1, W * 0.55 - w), y: H * (0.3 + rand() * 0.4) };
    };

    const newWord = () => {
      const text = GREETINGS[order % GREETINGS.length];
      order += 1 + Math.floor(rand() * 3);
      const size = clamp(H * (0.2 + rand() * 0.1), 18, 64);
      const ink = INK[Math.floor(rand() * INK.length)];
      const baked = bake(text, size, ink);
      const at = place(baked.w, baked.h);
      words.push({ text, ...baked, x: at.x, y: at.y, size, ink, age: 0, write: 0.9 + text.length * 0.14, hold: 2.2, fade: 1.6 });
    };

    const spray = (x: number, y: number, count: number, speed: number, gen = 0) => {
      for (let i = 0; i < count; i += 1) {
        const a = rand() * TAU;
        const v = speed * (0.3 + rand() * 0.9) * unit;
        sparks.push({ x, y, px: x, py: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20 * unit, age: 0, life: 0.2 + rand() * (gen ? 0.15 : 0.45), gen });
      }
    };

    /** Where the burning tip of the word being written is now (it bobs over the letters like a hand). */
    const tipOf = (wd: Word) => {
      const k = clamp(wd.age / wd.write, 0, 1);
      const x = wd.x + wd.size * 0.4 + k * (wd.w - wd.size * 0.8);
      const bob = Math.sin(k * wd.text.length * Math.PI * 1.3) * wd.size * 0.28 - wd.size * 0.05;
      return { x, y: wd.y + bob, k };
    };

    return {
      update(dt, t, p) {
        const step = Math.min(dt, 0.05) * clamp(c.params.speed, 0.2, 3);
        clock += step;
        nextWord -= step;
        if (nextWord <= 0 && words.length < 3) {
          newWord();
          nextWord = 1.3 + rand() * 1.2;
        }
        for (let i = words.length - 1; i >= 0; i -= 1) {
          const wd = words[i];
          wd.age += step;
          if (wd.age < wd.write) {
            const tip = tipOf(wd);
            spray(tip.x, tip.y, Math.round(step * 190), 150);
            if (rand() < step * 6) smoke.push({ x: tip.x, y: tip.y, r: 3 * unit, age: 0 });
          }
          if (wd.age > wd.write + wd.hold + wd.fade) words.splice(i, 1);
        }
        // The cursor's sparkler.
        if (p.active && c.params.react > 0) {
          trail.push({ x: p.x, y: p.y, t: clock });
          spray(p.x, p.y, Math.round(step * 140 * c.params.react), 140);
          if (p.clicked) spray(p.x, p.y, 90, 320);
        }
        while (trail.length && clock - trail[0].t > 1.4) trail.shift();
        for (let i = sparks.length - 1; i >= 0; i -= 1) {
          const s = sparks[i];
          s.px = s.x;
          s.py = s.y;
          s.age += step;
          s.vy += 260 * unit * step;
          s.vx *= 1 - 1.6 * step;
          s.vy *= 1 - 1.6 * step;
          s.x += s.vx * step;
          s.y += s.vy * step;
          // Sparkler sparks fork: a first-generation spark bursts into a few tiny ones as it dies.
          if (s.age >= s.life) {
            if (s.gen === 0 && rand() < 0.5) spray(s.x, s.y, 2 + Math.floor(rand() * 3), 90, 1);
            sparks.splice(i, 1);
          }
        }
        if (sparks.length > 900) sparks.splice(0, sparks.length - 900);
        for (let i = smoke.length - 1; i >= 0; i -= 1) {
          const m = smoke[i];
          m.age += step;
          m.y -= 14 * unit * step;
          m.r += 7 * unit * step;
          if (m.age > 2.2) smoke.splice(i, 1);
        }
        void t;
      },
      draw(g) {
        g.drawImage(back, 0, 0, W, H);
        const intensity = clamp(c.params.intensity, 0.2, 2);
        for (const m of smoke) {
          g.fillStyle = `rgba(200,195,210,${(0.05 * (1 - m.age / 2.2)).toFixed(3)})`;
          g.beginPath();
          g.arc(m.x, m.y, m.r, 0, TAU);
          g.fill();
        }
        g.globalCompositeOperation = 'lighter';
        // The words: revealed up to the tip while being written, glowing, then cooling and fading.
        for (const wd of words) {
          const tip = tipOf(wd);
          const shown = wd.age < wd.write ? wd.size * 0.4 + tip.k * (wd.w - wd.size * 0.8) + wd.size * 0.1 : wd.w;
          const after = wd.age - wd.write;
          const alpha = after < wd.hold ? 1 : clamp(1 - (after - wd.hold) / wd.fade, 0, 1);
          g.globalAlpha = alpha * intensity;
          const sw = Math.min(wd.w, shown);
          g.drawImage(wd.canvas, 0, 0, sw * S, wd.h * S, wd.x, wd.y - wd.h / 2, sw, wd.h);
          // A fresh line is white-hot: a second, fading pass while it cools.
          const heat = clamp(1 - after / 1.2, 0, 1);
          if (heat > 0) {
            g.globalAlpha = heat * 0.6 * intensity;
            g.drawImage(wd.canvas, 0, 0, sw * S, wd.h * S, wd.x, wd.y - wd.h / 2, sw, wd.h);
          }
        }
        g.globalAlpha = 1;
        // The cursor's light painting: a fading ribbon along its recent path.
        if (trail.length > 1) {
          g.lineCap = 'round';
          g.lineJoin = 'round';
          for (let i = 1; i < trail.length; i += 1) {
            const a = trail[i - 1];
            const q = trail[i];
            const life = clamp(1 - (clock - q.t) / 1.4, 0, 1);
            g.strokeStyle = rgba('#ffcf7a', 0.35 * life * intensity);
            g.lineWidth = 5 * unit;
            g.beginPath();
            g.moveTo(a.x, a.y);
            g.lineTo(q.x, q.y);
            g.stroke();
            g.strokeStyle = rgba('#fff6e0', 0.8 * life * intensity);
            g.lineWidth = 1.4 * unit;
            g.stroke();
          }
        }
        // Sparks: short streaks from their last place, white-hot first, then yellow, orange, red.
        g.lineCap = 'round';
        for (const s of sparks) {
          const k = s.age / s.life;
          const col = k < 0.3 ? '#fffbe8' : k < 0.6 ? '#ffe08a' : k < 0.85 ? '#ffae4a' : '#ff6a2a';
          g.strokeStyle = rgba(col, (1 - k * 0.7) * intensity);
          g.lineWidth = (s.gen ? 0.8 : 1.3) * unit;
          g.beginPath();
          g.moveTo(s.px, s.py);
          g.lineTo(s.x + (s.x - s.px) * 0.6, s.y + (s.y - s.py) * 0.6);
          g.stroke();
        }
        // The burning tips: a white core in a warm halo.
        const tips = words.filter((wd) => wd.age < wd.write).map(tipOf);
        for (const tip of tips) {
          const r = 16 * unit;
          const glow = g.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, r);
          glow.addColorStop(0, `rgba(255,255,240,${0.95 * intensity})`);
          glow.addColorStop(0.25, `rgba(255,220,140,${0.55 * intensity})`);
          glow.addColorStop(1, 'rgba(255,140,40,0)');
          g.fillStyle = glow;
          g.fillRect(tip.x - r, tip.y - r, r * 2, r * 2);
        }
        g.globalCompositeOperation = 'source-over';
      },
    };
  },
};
