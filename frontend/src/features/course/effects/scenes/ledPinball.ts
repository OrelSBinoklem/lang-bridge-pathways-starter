import type { ScenePointer } from './types';
import { createPinball, PINBALL_BUMPERS, PINBALL_COLORS, PINBALL_RAILS, type PinballEvent } from './pinballPhysics';
import { bakePinballArtwork, bakePinballSprites, PINBALL_ASPECT, PINBALL_TOP, pinballRound } from './pinballArtwork';

export function pinballLayout(width: number, height: number) {
  const portrait = width < 700;
  const w = portrait ? Math.min(width * .62, height * .23) : Math.min(Math.max(180, (width - 1240) / 2 - 26), height * .40, width * .31);
  return { x: portrait ? (width - w) / 2 : Math.max(12, (Math.max(w + 24, (width - 1240) / 2) - w) / 2),
    y: portrait ? height * .5 : (height - w * PINBALL_ASPECT) / 2, width: w, height: w * PINBALL_ASPECT };
}

const RGB: [number, number, number][] = [[1, .1, .38], [.1, .8, 1], [1, .65, .08]];
type Pulse = { x: number; y: number; color: number; life: number; points: number };
type Spark = { x: number; y: number; vx: number; vy: number; color: number; life: number };

export function createLedPinball(width: number, height: number, onHit: (color: [number, number, number]) => void) {
  const rect = pinballLayout(width, height), baked = bakePinballArtwork(), sprites = bakePinballSprites();
  const flashes = [0, 0, 0], pulses: Pulse[] = [], sparks: Spark[] = [];
  const trails: { x: number; y: number; life: number }[][] = [[], []];
  let multiballFlash = 0, lastPressed = false;
  const pulse = (x: number, y: number, color: number, points: number) => {
    if (pulses.length >= 12) pulses.shift();
    pulses.push({ x, y, color, life: 1, points });
    for (let k = 0; k < 12 && sparks.length < 96; k++) {
      const a = k * Math.PI / 6 + x * 2;
      sparks.push({ x, y, vx: Math.cos(a) * .34, vy: Math.sin(a) * .34, color, life: .55 });
    }
  };
  const feature = (e: PinballEvent) => {
    pulse(e.x, e.y, e.color, e.points);
    if (e.kind === 'multiball') multiballFlash = 3;
    if (e.kind !== 'sling') onHit(RGB[e.color]);
  };
  const model = createPinball((i, x, y) => { flashes[i] = 1; pulse(x, y, i, 100 * model.combo); onHit(RGB[i]); }, feature);
  const lamp = (g: CanvasRenderingContext2D, x: number, y: number, color: number, radius: number, alpha = 1) => {
    g.globalAlpha = alpha;
    g.drawImage(sprites, 128 + color * 128, 0, 128, 128, x - radius, y - radius, radius * 2, radius * 2);
  };
  return { model, rect,
    update(dt: number, p: ScenePointer, enabled: boolean) {
      const step = Math.max(0, Math.min(dt, .05));
      const x = (p.rawX - rect.x) / rect.width, y = (p.rawY - rect.y) / rect.width;
      const inside = p.active && x >= 0 && x <= 1 && y >= 0 && y <= PINBALL_ASPECT && enabled;
      const pressed = inside && p.pressed;
      model.update(step, { launch: inside && (p.clicked || pressed && !lastPressed), nudge: inside && p.clicked && model.activeBalls > 0, left: pressed && x < .65, right: pressed && x > .35 }); lastPressed = pressed;
      multiballFlash = Math.max(0, multiballFlash - step);
      for (let i = 0; i < flashes.length; i++) flashes[i] = Math.max(0, flashes[i] - step * 2.8);
      for (let i = pulses.length - 1; i >= 0; i--) { pulses[i].life -= step * 1.3; if (pulses[i].life <= 0) pulses.splice(i, 1); }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]; s.life -= step; s.x += s.vx * step; s.y += s.vy * step; s.vy += step * .28;
        if (s.life <= 0) sparks.splice(i, 1);
      }
      model.balls.forEach((ball, i) => {
        const trail = trails[i];
        for (let j = trail.length - 1; j >= 0; j--) { trail[j].life -= step; if (trail[j].life <= 0) trail.splice(j, 1); }
        if (ball.active && step > 0) { trail.push({ x: ball.x, y: ball.y, life: .16 }); if (trail.length > 24) trail.shift(); }
      });
      return inside;
    },
    draw(g: CanvasRenderingContext2D) {
      g.save(); g.translate(rect.x, rect.y); g.scale(rect.width, rect.width); g.drawImage(baked, 0, 0, 1, PINBALL_ASPECT);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '700 .083px monospace'; g.fillStyle = '#112532'; g.fillText('8888888', .49, .133);
      g.fillStyle = '#baf7ff'; g.fillText(String(model.score).padStart(7, '0'), .49, .133);
      g.font = '600 .025px monospace'; g.fillStyle = multiballFlash > 0 ? '#ffe694' : '#5be6d3';
      g.fillText(multiballFlash > 0 ? 'MULTIBALL • 2 ШАРА' : model.combo > 1 ? `COMBO ×${model.combo}` : model.activeBalls ? 'СОБЕРИ 3 МИШЕНИ → MULTIBALL' : 'НАЖМИ НА СТОЛ — ПУСК', .49, .199);
      g.save(); g.globalCompositeOperation = 'lighter';
      PINBALL_RAILS.forEach(([x, y, xx, yy], i) => {
        const count = Math.max(2, Math.ceil(Math.hypot(xx - x, yy - y) * 14));
        for (let k = 0; k < count; k++) {
          const t = k / count, phase = (t + i * .27 - model.time * .65) % 1;
          lamp(g, x + (xx - x) * t, y + PINBALL_TOP + (yy - y) * t, i % 3, .018, .16 + (phase > -.16 && phase < 0 ? .75 : .05));
        }
      });
      PINBALL_BUMPERS.forEach((b, i) => {
        lamp(g, b.x, b.y + PINBALL_TOP, i, b.r * (1.5 + flashes[i] * .8), .15 + flashes[i] * .7);
        if (flashes[i] > 0) { g.globalAlpha = flashes[i]; g.strokeStyle = PINBALL_COLORS[i]; g.lineWidth = .004; g.beginPath(); g.arc(b.x, b.y + PINBALL_TOP, b.r + (1 - flashes[i]) * .09, 0, Math.PI * 2); g.stroke(); }
      });
      for (const s of sparks) lamp(g, s.x, s.y + PINBALL_TOP, s.color, .012, s.life);
      for (const trail of trails) for (const p of trail) lamp(g, p.x, p.y + PINBALL_TOP, 1, .037, p.life * 1.6);
      g.restore(); g.globalAlpha = 1;
      model.targets.forEach((target, i) => {
        g.globalAlpha = 1;
        const y = target.y + PINBALL_TOP;
        if (!target.down) {
          g.fillStyle = '#19344a'; pinballRound(g, target.x - .047, y - .029, .094, .052, .008); g.fill();
          g.strokeStyle = '#b7c6d2'; g.lineWidth = .004; g.stroke();
          g.fillStyle = PINBALL_COLORS[i]; pinballRound(g, target.x - .034, y - .019, .068, .031, .004); g.fill();
          g.fillStyle = '#071021'; g.font = '700 .022px monospace'; g.fillText(['R', 'G', 'B'][i], target.x, y - .003);
        } else { g.strokeStyle = PINBALL_COLORS[i]; g.lineWidth = .004; g.beginPath(); g.moveTo(target.x - .038, y + .018); g.lineTo(target.x + .038, y + .018); g.stroke(); }
        lamp(g, target.x, y + .042, i, .027 + target.glow * .035, target.down ? .9 : .22 + .1 * Math.sin(model.time * 3 + i));
      });
      g.globalAlpha = 1;
      // Three interleaved reactor arcs charge up with actual target/combination progress.
      const charge = model.targets.reduce((sum, t) => sum + Number(t.down), 0);
      g.save(); g.translate(.5, 1.02); g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const angle = model.time * (i % 2 ? -.18 : .14) + i * 2.1;
        g.strokeStyle = PINBALL_COLORS[i]; g.globalAlpha = .18 + (i < charge ? .6 : 0);
        g.lineWidth = i < charge ? .008 : .003; g.beginPath(); g.arc(0, 0, .26 + i * .025, angle, angle + Math.PI * .8); g.stroke();
      }
      g.restore();
      const rotor = model.spinner;
      g.save(); g.translate(rotor.x, rotor.y + PINBALL_TOP); g.rotate(rotor.angle);
      g.fillStyle = '#050811'; pinballRound(g, -rotor.half - .008, -.01, rotor.half * 2 + .016, .043, .014); g.fill();
      g.fillStyle = '#788fa8'; pinballRound(g, -rotor.half, -.02, rotor.half * 2, .04, .012); g.fill();
      g.fillStyle = '#f8ca65'; pinballRound(g, -rotor.half + .008, -.011, rotor.half * 2 - .016, .015, .005); g.fill();
      g.strokeStyle = '#e4efff'; g.lineWidth = .003; g.beginPath(); g.moveTo(-rotor.half + .012, -.014); g.lineTo(rotor.half - .012, -.014); g.stroke(); g.restore();
      g.fillStyle = '#d3e4ed'; g.beginPath(); g.arc(rotor.x, rotor.y + PINBALL_TOP, .014, 0, Math.PI * 2); g.fill();
      if (rotor.glow > 0) {
        g.save(); g.globalCompositeOperation = 'lighter'; lamp(g, rotor.x, rotor.y + PINBALL_TOP, 2, .13, rotor.glow * .7); g.restore();
      }
      for (const f of model.flippers) {
        g.save(); g.translate(f.x, f.y + PINBALL_TOP); g.rotate(f.angle); g.lineCap = 'round'; g.lineWidth = .066; g.strokeStyle = '#030512';
        g.beginPath(); g.moveTo(0, .012); g.lineTo(f.length, .012); g.stroke(); g.lineWidth = .052; g.strokeStyle = '#ad407a'; g.beginPath(); g.moveTo(0, 0); g.lineTo(f.length, 0); g.stroke();
        g.lineWidth = .035; g.strokeStyle = '#e0d1cb'; g.stroke(); g.lineWidth = .007; g.strokeStyle = '#fff5e9'; g.stroke();
        g.fillStyle = '#688094'; g.beginPath(); g.arc(0, 0, .021, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e5f6ff'; g.beginPath(); g.arc(-.005, -.007, .008, 0, Math.PI * 2); g.fill(); g.restore();
      }
      model.balls.forEach((ball, i) => {
        if (!ball.active && (i > 0 || model.activeBalls > 0)) return;
        g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.ellipse(ball.x + .008, ball.y + PINBALL_TOP + .012, .031, .017, 0, 0, Math.PI * 2); g.fill();
        const r = ball.r * 128 / 98;
        g.drawImage(sprites, 0, 0, 128, 128, ball.x - r, ball.y + PINBALL_TOP - r, r * 2, r * 2);
      });
      for (const p of pulses) {
        g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = PINBALL_COLORS[p.color]; g.font = '700 .036px monospace';
        g.fillText(`+${p.points}`, p.x, p.y + PINBALL_TOP - .07 - (1 - p.life) * .13);
      }
      g.globalAlpha = 1;
      if (multiballFlash > 0) {
        g.strokeStyle = '#ffd878'; g.lineWidth = .008; g.globalAlpha = .35 + .25 * Math.sin(model.time * 14);
        pinballRound(g, .024, .024, .94, 2.08, .05); g.stroke(); g.globalAlpha = 1;
      }
      g.restore();
    },
  };
}
