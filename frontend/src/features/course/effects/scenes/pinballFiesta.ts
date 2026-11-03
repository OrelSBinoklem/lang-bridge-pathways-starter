import type { ScenePointer } from './types';
import { createLedPinball } from './ledPinball';
import { PINBALL_BUMPERS, PINBALL_RAILS, PINBALL_TARGETS } from './pinballPhysics';
import { PINBALL_ASPECT, PINBALL_TOP, pinballRound } from './pinballArtwork';
import { createPinballBot } from './pinballBot';

/**
 * «Свободное время», the left game made more colourful and interesting (owner, 2026-10-30, as another variant). The
 * same physics and table geometry as the RGB reactor (nothing about the ball's motion changes), with:
 *
 * - its own playfield painted over the reactor's: a sunset-to-night carnival — a sunburst in magenta, orange and teal,
 *   a circus-stripe arch at the top, a Ferris wheel and stars, lit lane arrows pointing at the targets, rainbow rings
 *   round the bumpers, a glowing «FIESTA» marquee; the table's colours drift with the level (a hue turn);
 * - levels: knocking down all three targets advances a level (×multiplier for every point after it), the board
 *   flashes and the cube bursts in all three colours;
 * - jackpot: after a multiball the spinner is lit; spinning it pays the jackpot (5000 × level);
 * - a ball save for the first 6 s of each launch (a drained ball comes back once);
 * - rainbow ball trails that lengthen with the combo, confetti from every hit, a level and best score on the marquee
 *   (the best score is kept in this browser only);
 * - an attract mode: a bot plays until the first click on the table.
 */
const COPY = {
  ru: { demo: 'ИГРАЕТ БОТ · КЛИК — ТВОЙ ХОД', level: 'УРОВЕНЬ', best: 'РЕКОРД', jackpot: 'ДЖЕКПОТ!', lit: 'ДЖЕКПОТ ГОРИТ — В КРУТИЛКУ!', save: 'ШАР СПАСЁН', up: 'УРОВЕНЬ', hint: 'КЛИК — ПУСК · УДЕРЖИВАЙ СЛЕВА / СПРАВА — ЛОПАТКИ', goal: 'СБЕЙ R G B — НОВЫЙ УРОВЕНЬ ×' },
  uk: { demo: 'ГРАЄ БОТ · КЛІК — ТВІЙ ХІД', level: 'РІВЕНЬ', best: 'РЕКОРД', jackpot: 'ДЖЕКПОТ!', lit: 'ДЖЕКПОТ ГОРИТЬ — У КРУТИЛКУ!', save: 'КУЛЮ ВРЯТОВАНО', up: 'РІВЕНЬ', hint: 'КЛІК — ПУСК · УТРИМУЙ ЗЛІВА / СПРАВА — ЛОПАТКИ', goal: 'ЗБИЙ R G B — НОВИЙ РІВЕНЬ ×' },
};
const CONFETTI = ['#ff4f9a', '#ffd23f', '#3fe0ff', '#7dff6a', '#b07bff', '#ff8a3d'];
const BEST_KEY = 'lbp-pinball-fiesta-best';

/** The carnival playfield, painted once (in table units: 1 wide, PINBALL_ASPECT tall), drawn over the reactor art. */
function bakeFiestaArt() {
  const canvas = document.createElement('canvas'); canvas.width = 1100; canvas.height = Math.ceil(1100 * PINBALL_ASPECT);
  const g = canvas.getContext('2d')!; g.scale(1100, 1100);
  g.save(); pinballRound(g, .038, .25, .91, 1.78, .04); g.clip();
  // Sunset to night: a warm horizon low on the table, deep violet above.
  const sky = g.createLinearGradient(0, .25, 0, 2.03);
  for (const [p, c] of [[0, '#1a0b3a'], [.35, '#3b0f5c'], [.62, '#8a1f6e'], [.8, '#e0506a'], [1, '#ff9a3c']] as const) sky.addColorStop(p, c);
  g.fillStyle = sky; g.fillRect(0, .25, 1, 1.8);
  // A sunburst from the reactor's middle: alternating magenta, orange and teal wedges.
  g.save(); g.translate(.5, 1.02); g.globalAlpha = .22;
  for (let i = 0; i < 36; i++) {
    g.fillStyle = ['#ff3d9a', '#ffb13d', '#24d8e0'][i % 3];
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1.6, i / 36 * Math.PI * 2, (i + .5) / 36 * Math.PI * 2); g.closePath(); g.fill();
  }
  g.restore();
  // Stars in the upper half.
  for (let i = 0; i < 160; i++) {
    const x = .05 + Math.random() * .9, y = .27 + Math.random() * .6, r = .0012 + Math.random() * .003;
    g.fillStyle = `rgba(255,250,220,${(.3 + Math.random() * .6).toFixed(2)})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // A Ferris wheel silhouette with coloured gondolas, low on the left; carnival tents on the right.
  g.save(); g.translate(.24, 1.72); g.strokeStyle = 'rgba(255,220,240,.35)'; g.lineWidth = .004;
  g.beginPath(); g.arc(0, 0, .17, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * .17, Math.sin(a) * .17); g.stroke();
    g.fillStyle = CONFETTI[i % CONFETTI.length]; g.globalAlpha = .6; g.beginPath(); g.arc(Math.cos(a) * .17, Math.sin(a) * .17 + .012, .011, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  }
  g.beginPath(); g.moveTo(-.09, .3); g.lineTo(0, 0); g.lineTo(.09, .3); g.stroke(); g.restore();
  for (const [x, w, c] of [[.68, .14, '#ff4f9a'], [.8, .11, '#3fe0ff']] as const) {
    const base = 1.9;
    for (let s = 0; s < 6; s++) {
      g.fillStyle = s % 2 ? 'rgba(255,255,255,.55)' : c; g.globalAlpha = .55;
      g.beginPath(); g.moveTo(x, base - .14); g.lineTo(x - w / 2 + s * w / 6, base); g.lineTo(x - w / 2 + (s + 1) * w / 6, base); g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
  }
  // The circus-stripe arch across the top of the field.
  for (let s = 0; s < 18; s++) {
    g.fillStyle = s % 2 ? '#fff1d6' : '#ff3d6e'; g.globalAlpha = .75;
    g.beginPath(); g.arc(.5, .62, .44, Math.PI + s / 18 * Math.PI, Math.PI + (s + 1) / 18 * Math.PI); g.arc(.5, .62, .4, Math.PI + (s + 1) / 18 * Math.PI, Math.PI + s / 18 * Math.PI, true); g.closePath(); g.fill();
  }
  g.globalAlpha = 1;
  for (let k = 0; k < 19; k++) {
    const a = Math.PI + k / 18 * Math.PI;
    g.fillStyle = CONFETTI[k % CONFETTI.length]; g.shadowColor = g.fillStyle; g.shadowBlur = 10;
    g.beginPath(); g.arc(.5 + Math.cos(a) * .42, .62 + Math.sin(a) * .42, .007, 0, Math.PI * 2); g.fill();
  }
  g.shadowBlur = 0;
  // Lit lane arrows pointing up at each target.
  PINBALL_TARGETS.forEach((t, i) => {
    for (let k = 0; k < 3; k++) {
      const y = t.y + PINBALL_TOP + .1 + k * .045;
      g.fillStyle = ['#ff4f9a', '#3fe0ff', '#ffd23f'][i]; g.globalAlpha = .35 + k * .15;
      g.beginPath(); g.moveTo(t.x, y); g.lineTo(t.x - .03, y + .03); g.lineTo(t.x + .03, y + .03); g.closePath(); g.fill();
    }
  });
  g.globalAlpha = 1;
  // Rainbow rings under each bumper.
  PINBALL_BUMPERS.forEach(b => {
    for (let k = 0; k < 6; k++) {
      g.strokeStyle = CONFETTI[k]; g.globalAlpha = .55; g.lineWidth = .006;
      g.beginPath(); g.arc(b.x, b.y + PINBALL_TOP, b.r * 1.35 + k * .008, 0, Math.PI * 2); g.stroke();
    }
  });
  g.globalAlpha = 1;
  // Confetti printed across the lower field.
  for (let i = 0; i < 220; i++) {
    g.save(); g.translate(.07 + Math.random() * .86, 1.25 + Math.random() * .75); g.rotate(Math.random() * Math.PI);
    g.fillStyle = CONFETTI[i % CONFETTI.length]; g.globalAlpha = .28; g.fillRect(-.006, -.002, .012, .004); g.restore();
  }
  g.globalAlpha = 1;
  // The marquee title.
  g.save(); g.translate(.5, 1.5); g.rotate(-.1);
  const title = g.createLinearGradient(-.2, 0, .2, 0);
  for (const [p, c] of [[0, '#ff4f9a'], [.35, '#ffd23f'], [.7, '#3fe0ff'], [1, '#b07bff']] as const) title.addColorStop(p, c);
  g.font = '900 .085px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = .012; g.strokeStyle = '#2a0838'; g.strokeText('FIESTA', 0, 0);
  g.fillStyle = title; g.shadowColor = '#ff9ad4'; g.shadowBlur = 24; g.fillText('FIESTA', 0, 0); g.shadowBlur = 0;
  g.restore();
  g.restore();
  // The rails re-lit in carnival colours over the reactor's.
  PINBALL_RAILS.forEach(([x, y, xx, yy], i) => {
    g.lineCap = 'round'; g.strokeStyle = CONFETTI[i % CONFETTI.length]; g.globalAlpha = .55; g.lineWidth = .01;
    g.shadowColor = g.strokeStyle; g.shadowBlur = 16;
    g.beginPath(); g.moveTo(x, y + PINBALL_TOP); g.lineTo(xx, yy + PINBALL_TOP); g.stroke();
  });
  g.shadowBlur = 0; g.globalAlpha = 1;
  return canvas;
}

type Bit = { x: number; y: number; vx: number; vy: number; spin: number; a: number; color: string; life: number; size: number };

export function createFiestaPinball(width: number, height: number, onHit: (color: [number, number, number]) => void, locale: 'ru' | 'uk' = 'ru') {
  const bits: Bit[] = [];
  const confetti = (x: number, y: number, n: number, power = 1) => {
    for (let k = 0; k < n && bits.length < 360; k++) {
      const a = Math.random() * Math.PI * 2, s = (.25 + Math.random() * .55) * power;
      bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - .35 * power, spin: (Math.random() - .5) * 18, a: Math.random() * 6, color: CONFETTI[k % CONFETTI.length], life: 1 + Math.random() * .8, size: .008 + Math.random() * .008 });
    }
  };
  const table = createLedPinball(width, height, color => { onHit(color); });
  const model = table.model;
  const bot = createPinballBot(model);
  const copy = COPY[locale];
  const art = bakeFiestaArt();
  let attract = true, level = 1, levelBase = 0, bonus = 0, jackpotLit = false, banner = '', bannerT = 0, flash = 0, hue = 0;
  let saveUntil = 0, saved = false, lastShots = 0, lastScore = 0, lastActive = 0, clock = 0, levelAt = 0;
  let best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch { /* no storage: no record */ }
  const trails: { x: number; y: number; life: number; hue: number }[] = [];
  const show = (text: string) => { banner = text; bannerT = 2.2; };
  const total = () => model.score + bonus;
  return {
    model, rect: table.rect,
    get attract() { return attract; },
    update(dt: number, pointer: ScenePointer, enabled: boolean) {
      const step = Math.max(0, Math.min(dt, .05));
      clock += step;
      const x = (pointer.rawX - table.rect.x) / table.rect.width, y = (pointer.rawY - table.rect.y) / table.rect.width;
      const inside = enabled && pointer.active && x >= 0 && x <= 1 && y >= 0 && y <= PINBALL_ASPECT;
      let consumed = inside;
      if (attract && inside && pointer.clicked) {
        attract = false; level = 1; bonus = 0; levelBase = model.score; jackpotLit = false;
        for (const ball of model.balls) { ball.active = false; ball.vx = ball.vy = 0; }
      }
      if (attract) {
        const control = bot.update(step);
        const botX = control.left && !control.right ? .2 : control.right && !control.left ? .8 : .5;
        table.update(step, { ...pointer, rawX: table.rect.x + table.rect.width * botX, rawY: table.rect.y + table.rect.width * 1.7, active: true, clicked: control.launch, pressed: control.left || control.right }, true);
      } else consumed = table.update(step, pointer, enabled);
      // A new launch: the ball save starts.
      if (model.shots !== lastShots) { lastShots = model.shots; saveUntil = model.time + 6; saved = false; }
      // Ball save: a drain within its first seconds puts the ball back in the plunger lane, once.
      if (lastActive > 0 && model.activeBalls === 0 && model.time < saveUntil && !saved) {
        saved = true;
        Object.assign(model.ball, { x: .905, y: 1.58, vx: -.05, vy: -3.05, active: true });
        show(copy.save); confetti(.905, 1.5, 24);
      }
      lastActive = model.activeBalls;
      // Points since the last frame: everything after level 1 is multiplied, and each hit throws confetti.
      const gained = model.score - lastScore;
      if (gained > 0) {
        bonus += gained * (level - 1);
        const ball = model.balls.find(b => b.active) ?? model.ball;
        confetti(ball.x, ball.y, Math.min(30, 8 + gained / 40));
      }
      lastScore = model.score;
      // Level up: all three targets down.
      if (model.targets.every(t => t.down) && model.time - levelAt > 1.5) {
        levelAt = model.time; level++; flash = 1;
        show(`${copy.up} ${level} · ×${level}`);
        for (const t of model.targets) { t.down = false; t.glow = 1; }
        confetti(.5, .6, 90, 1.6);
        for (const c of [[1, .1, .38], [.1, .8, 1], [1, .65, .08]] as [number, number, number][]) onHit(c);
      }
      // Jackpot: lit by a multiball, collected on the spinner.
      if (model.activeBalls === 2 && !jackpotLit) { jackpotLit = true; show(copy.lit); }
      if (jackpotLit && model.spinner.glow > .9) {
        jackpotLit = false; bonus += 5000 * level; flash = 1; show(`${copy.jackpot} +${5000 * level}`);
        confetti(model.spinner.x, model.spinner.y, 120, 2);
      }
      if (!attract && total() > best) { best = total(); try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* not kept */ } }
      void levelBase;
      // Rainbow trails, longer with the combo.
      for (const ball of model.balls) if (ball.active) trails.push({ x: ball.x, y: ball.y, life: .2 + .07 * Math.min(6, model.combo), hue: (clock * 360 * .8) % 360 });
      for (let i = trails.length - 1; i >= 0; i--) { trails[i].life -= step; if (trails[i].life <= 0) trails.splice(i, 1); }
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i]; b.life -= step; b.vy += .9 * step; b.vx *= Math.exp(-step * 1.5); b.x += b.vx * step; b.y += b.vy * step; b.a += b.spin * step;
        if (b.life <= 0) bits.splice(i, 1);
      }
      bannerT = Math.max(0, bannerT - step); flash = Math.max(0, flash - step * 1.6);
      hue += ((level - 1) * 38 - hue) * Math.min(1, step * 1.5);
      return consumed;
    },
    draw(g: CanvasRenderingContext2D) {
      // The reactor table (its moving parts), the colours turned with the level.
      g.save();
      if (Math.abs(hue) > .5) g.filter = `hue-rotate(${hue.toFixed(1)}deg) saturate(1.25)`;
      table.draw(g);
      g.restore();
      g.save(); g.translate(table.rect.x, table.rect.y); g.scale(table.rect.width, table.rect.width);
      // The carnival art over the field, blended so the reactor's lamps and parts show through.
      g.globalCompositeOperation = 'screen'; g.globalAlpha = .62; g.drawImage(art, 0, 0, 1, PINBALL_ASPECT);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      // Rainbow trails and confetti.
      g.globalCompositeOperation = 'lighter';
      // (Inside the cabinet only: the confetti and trails do not fly out over the page.)
      g.save(); pinballRound(g, .02, .02, .95, 2.09, .06); g.clip();
      for (const p of trails) { g.fillStyle = `hsla(${p.hue},100%,58%,${Math.min(.45, p.life * 1.6).toFixed(2)})`; g.beginPath(); g.arc(p.x, p.y + PINBALL_TOP, .014 * Math.min(1, p.life * 4), 0, Math.PI * 2); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      for (const b of bits) {
        g.save(); g.translate(b.x, b.y + PINBALL_TOP); g.rotate(b.a); g.globalAlpha = Math.min(1, b.life);
        g.fillStyle = b.color; g.fillRect(-b.size, -b.size * .35 * Math.abs(Math.cos(b.a * 1.7)) - .001, b.size * 2, b.size * .7 * Math.abs(Math.cos(b.a * 1.7)) + .002);
        g.restore();
      }
      g.globalAlpha = 1;
      g.restore();
      // Jackpot lamp round the spinner.
      if (jackpotLit) {
        g.strokeStyle = `hsl(${(clock * 400) % 360},100%,65%)`; g.lineWidth = .008; g.globalAlpha = .6 + .4 * Math.sin(clock * 12);
        g.beginPath(); g.arc(model.spinner.x, model.spinner.y + PINBALL_TOP, .14, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
      }
      // The marquee: score (with level bonus), level, best.
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#1a0628'; pinballRound(g, .075, .035, .83, .2, .022); g.fill();
      g.strokeStyle = `hsl(${(clock * 120) % 360},100%,65%)`; g.lineWidth = .006; g.stroke();
      g.fillStyle = '#ffe9a8'; g.font = '800 .062px monospace'; g.fillText(String(total()).padStart(7, '0'), .49, .11);
      g.font = '700 .027px sans-serif';
      g.fillStyle = '#ff9ad4'; g.fillText(attract ? copy.demo : `${copy.level} ${level} · ×${level}`, .49, .055);
      g.fillStyle = '#9ef2ff'; g.fillText(`${copy.best} ${best}`, .49, .19);
      // A save lamp during the ball save.
      if (!attract && model.time < saveUntil && !saved && model.activeBalls) {
        g.fillStyle = `rgba(125,255,170,${(.5 + .5 * Math.sin(clock * 10)).toFixed(2)})`; g.font = '800 .024px sans-serif'; g.fillText('SAVE', .5, 1.97);
      }
      g.fillStyle = '#1a0628'; pinballRound(g, .055, 2.025, .88, .075, .012); g.fill();
      g.fillStyle = '#ffd1ea'; g.font = '600 .022px sans-serif';
      g.fillText(attract ? `${copy.goal}${level + 1}` : copy.hint, .49, 2.062);
      // A banner across the middle (level up, jackpot, save) and the board's flash.
      if (bannerT > 0) {
        const a = Math.min(1, bannerT * 2), s = 1 + (1 - Math.min(1, (2.2 - bannerT) * 4)) * .4;
        g.save(); g.translate(.5, .9); g.scale(s, s); g.globalAlpha = a;
        g.fillStyle = 'rgba(26,6,40,.85)'; pinballRound(g, -.42, -.07, .84, .14, .03); g.fill();
        g.fillStyle = `hsl(${(clock * 300) % 360},100%,70%)`; g.font = '900 .058px sans-serif'; g.fillText(banner, 0, .005, .8);
        g.restore();
      }
      if (flash > 0) { g.globalAlpha = flash * .35; g.fillStyle = '#ffffff'; pinballRound(g, .038, .25, .91, 1.78, .04); g.fill(); g.globalAlpha = 1; }
      g.restore();
    },
  };
}
