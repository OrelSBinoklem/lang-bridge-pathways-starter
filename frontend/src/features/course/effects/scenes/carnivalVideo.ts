import type { CanvasSceneDef } from './types';

export const PARK_COLORS = ['#ff426a', '#ffb52e', '#38d5ba', '#559aff', '#b975f4', '#ff82bc', '#ffe278'];
export function parkVideoLayout(width: number, height: number, body: boolean, contentVisible = true) {
  const portrait = width / height < .85;
  if (portrait) return [0, 1].map(side => {
    const scale = Math.min(width * .94 / 900, height * .48 / 1300);
    return { x: (width - 900 * scale) / 2, y: height * (side ? .52 : .01), width: 900 * scale, height: 1300 * scale };
  });
  const slot = body && contentVisible && width >= 1500 ? Math.max(150, (width - 1240) / 2) : width * .47;
  const scale = Math.min(slot / 900, height * .94 / 1300);
  return [0, 1].map(side => ({ x: side ? width - (slot + 900 * scale) / 2 : (slot - 900 * scale) / 2,
    y: (height - 1300 * scale) / 2, width: 900 * scale, height: 1300 * scale }));
}

function latexSprite(color: string) {
  const canvas = document.createElement('canvas'); canvas.width = 144; canvas.height = 192;
  const g = canvas.getContext('2d')!;
  g.translate(72, 84);
  g.beginPath(); g.moveTo(0, 79); g.bezierCurveTo(-8, 71, -56, 55, -57, -4);
  g.bezierCurveTo(-59, -88, 59, -88, 57, -4); g.bezierCurveTo(56, 55, 8, 71, 0, 79);
  g.save(); g.clip(); g.fillStyle = color; g.fillRect(-72, -84, 144, 180);
  const rim = g.createRadialGradient(-16, -24, 2, 0, 0, 85);
  rim.addColorStop(0, 'rgba(255,255,255,.25)'); rim.addColorStop(.55, 'rgba(255,255,255,0)'); rim.addColorStop(1, 'rgba(0,0,0,.7)');
  g.fillStyle = rim; g.fillRect(-72, -84, 144, 180);
  const highlight = g.createRadialGradient(-22, -37, 0, -22, -37, 26);
  highlight.addColorStop(0, 'rgba(255,255,255,.85)'); highlight.addColorStop(.3, 'rgba(255,255,255,.3)'); highlight.addColorStop(1, 'rgba(255,255,255,0)');
  g.save(); g.scale(.65, 1.1); g.fillStyle = highlight; g.fillRect(-100, -84, 200, 180); g.restore();
  g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -3, 54, 67, 0, -.5, 1.3); g.stroke();
  g.restore(); g.fillStyle = color; g.beginPath(); g.moveTo(0, 76); g.lineTo(-4, 86); g.lineTo(4, 86); g.closePath(); g.fill();
  return canvas;
}

export const CARNIVAL_VIDEO: CanvasSceneDef = {
  kind: 'canvas', id: 'cloud-carnival', label: 'Парк над облаками · видео и живые шары',
  palettes: [['#ffca79', '#0b1529']], defaultParams: { speed: 1, intensity: 1, react: .7 }, pixelRatioCap: 2, warmupFrames: 1,
  create(c) {
    const layout = parkVideoLayout(c.width, c.height, c.body, c.contentVisible), sprites = PARK_COLORS.map(latexSprite);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let disposed = false, visible = false, denied = false, lastSpeed = c.params.speed;
    const atlas = typeof Image !== 'undefined' ? new Image() : null;
    if (atlas) { atlas.src = '/course/effects/carnival/balloons.webp'; atlas.onerror = () => { if (!disposed) console.warn('[carnival-video] Balloon atlas unavailable; using latex fallback'); }; }
    const failures = new Set<number>();
    const videos = ['left', 'right'].map((side, index) => {
      const video = document.createElement('video'); video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
      video.src = `/course/effects/carnival/park-${side}.mp4?v=20261022-neutral-3`;
      video.addEventListener('error', () => { if (!disposed) { failures.add(index); console.warn(`[carnival-video] Failed to load ${side}`, video.error?.code); } });
      video.load(); return video;
    });
    const play = () => { if (!visible || reduced || disposed || c.params.speed <= 0) return; for (const video of videos) if (video.paused) void video.play().catch(error => {
      if (!disposed && error.name !== 'AbortError') { denied = error.name === 'NotAllowedError'; console.warn('[carnival-video] Playback blocked', error.name); }
    }); };
    const balls = layout.flatMap((rect, side) => Array.from({ length: 7 }, (_, i) => ({ side, i, x: 0, y: 0, vx: 0, vy: 0, cooldown: 0, size: 1,
      bx: rect.x + rect.width * ((side ? .77 : .23) + (i % 3 - 1) * .065),
      by: rect.y + rect.height * (.15 + Math.floor(i / 3) * .06), r: rect.width * (.044 + i % 3 * .003), color: (i + side * 3) % 7 })));
    for (const ball of balls) { ball.x = ball.bx; ball.y = ball.by; }
    const pieces: { x: number; y: number; vx: number; vy: number; age: number; color: string; spin: number }[] = [];
    let clock = 0;
    return {
      ready: () => videos.every((video, index) => video.readyState >= 2 || failures.has(index)),
      setVisible(value) { visible = value; if (value) play(); else videos.forEach(video => video.pause()); },
      update(dt, t, p) {
        clock = t; dt = Math.min(.05, dt);
        if (lastSpeed !== c.params.speed) { lastSpeed = c.params.speed; if (lastSpeed <= 0) videos.forEach(video => video.pause()); else play(); }
        if (p.clicked && denied) { denied = false; play(); }
        for (const video of videos) video.playbackRate = Math.max(.25, Math.min(4, c.params.speed));
        for (const b of balls) {
          b.cooldown = Math.max(0, b.cooldown - dt); b.size = b.cooldown ? 0 : Math.min(1, b.size + dt * 1.5);
          const x = b.bx + Math.sin(t * .7 + b.i * 1.7) * b.r * .22, y = b.by + Math.sin(t + b.i) * b.r * .15;
          const dx = b.x - p.rawX, dy = b.y - p.rawY, d = Math.hypot(dx, dy);
          if (p.active && c.params.react > 0 && d < b.r * 2.5 && d > .1) { b.vx += dx / d * dt * 80 * c.params.react; b.vy += dy / d * dt * 80 * c.params.react; }
          b.vx += ((x - b.x) * 10 - b.vx * 4) * dt; b.vy += ((y - b.y) * 10 - b.vy * 4) * dt;
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (p.active && p.clicked && c.params.react > 0 && b.size > .8 && d < b.r * 1.2) {
            b.cooldown = 2.4; b.size = 0;
            for (let i = 0; i < 24 && pieces.length < 96; i++) { const a = c.rand() * Math.PI * 2, speed = b.r * (1 + c.rand() * 4);
              pieces.push({ x: b.x, y: b.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, age: 0, color: PARK_COLORS[b.color], spin: c.rand() * 6 }); }
            break;
          }
        }
        for (let i = pieces.length - 1; i >= 0; i--) { const p = pieces[i]; p.age += dt; p.vy += dt * 70; p.x += p.vx * dt; p.y += p.vy * dt; if (p.age > 2) pieces.splice(i, 1); }
      },
      draw(g) {
        g.save();
        if (c.params.hue || c.params.intensity !== 1) g.filter = `hue-rotate(${c.params.hue || 0}deg) brightness(${Math.max(.1, c.params.intensity ?? 1)})`;
        g.fillStyle = '#080f20'; g.fillRect(0, 0, c.width, c.height);
        for (let i = 0; i < videos.length; i++) { const video = videos[i], r = layout[i];
          if (video.readyState >= 2) { g.save(); g.globalCompositeOperation = 'screen'; g.drawImage(video, r.x, r.y, r.width, r.height); g.restore(); }
          else { g.fillStyle = '#eacb9f'; g.font = '13px sans-serif'; g.textAlign = 'center'; g.fillText(failures.has(i) ? 'Видео парка недоступно' : 'Загрузка парка…', r.x + r.width / 2, r.y + r.height / 2, r.width); }
        }
        for (const b of balls) { if (b.size <= 0) continue; const r = layout[b.side];
          g.strokeStyle = 'rgba(218,205,190,.65)'; g.lineWidth = Math.max(.6, b.r * .025); g.beginPath();
          g.moveTo(r.x + r.width * (b.side ? .83 : .17), r.y + r.height * .82);
          g.quadraticCurveTo(b.x + Math.sin(clock + b.i) * b.r, b.y + r.height * .32, b.x, b.y + b.r * 1.25 * b.size); g.stroke();
          g.save(); g.translate(b.x, b.y); g.rotate(-b.vx * .004); const d = b.r * b.size;
          if (atlas?.complete && atlas.naturalWidth > 0) g.drawImage(atlas, b.color % 4 * 256, Math.floor(b.color / 4) * 384, 256, 384, -d * 1.2, -d * 1.8, d * 2.4, d * 3.6);
          else g.drawImage(sprites[b.color], -d * 1.26, -d * 1.47, d * 2.52, d * 3.36);
          g.restore();
        }
        for (const p of pieces) { g.save(); g.globalAlpha = Math.min(1, 2 - p.age); g.translate(p.x, p.y); g.rotate(p.spin + p.age * 6); g.fillStyle = p.color; g.fillRect(-2, -3, 4, 6); g.restore(); }
        if (denied) { g.fillStyle = '#ffe2ab'; g.textAlign = 'center'; g.font = '14px sans-serif'; g.fillText('Нажмите, чтобы запустить видео', c.width / 2, c.height - 20); }
        g.restore();
      },
      dispose() { disposed = true; if (atlas) atlas.src = ''; videos.forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); }); pieces.length = 0; },
    };
  },
};
