import type { CanvasSceneDef } from './types';
import { FONT_SANS, TAU, clamp, fillGradient, glow, lerp, mixHex, rgba, smooth } from './kit';

export const CANVAS_SCENES_1: CanvasSceneDef[] = [
  {
    kind: 'canvas',
    id: 'globe',
    label: 'Глобус огней',
    palettes: [['#06122a', '#3a8cff', '#ffd45a', '#9adfff'], ['#120a26', '#a86bff', '#ff8ad4', '#ffe0a3']],
    create(c) {
      const N = Math.round(clamp((c.width * c.height) / 320, 380, 1100));
      const pts: Array<{ x: number; y: number; z: number; land: number }> = [];
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < N; i += 1) {
        const y = 1 - (i / (N - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const th = golden * i;
        const lon = th;
        const lat = Math.asin(y);
        const land = Math.sin(lon * 2 + lat * 3) + Math.sin(lon * 5 - lat * 2) * 0.7 + Math.sin(lon * 1.3 + 2) * 0.6;
        pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, land: land > 0.5 ? 1 : 0 });
      }
      const city = () => {
        const lat = (c.rand() - 0.5) * 2.2;
        const lon = c.rand() * TAU;
        return { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon) };
      };
      const arcs = Array.from({ length: c.body ? 4 : 6 }, () => ({ a: city(), b: city(), s: c.rand(), sp: 0.12 + c.rand() * 0.15 }));
      let spin = 0;
      const tilt = 0.4;
      const R = clamp(Math.min(c.height * 0.44, c.width * 0.26), 60, 320);
      const cx = c.width * (c.body ? 0.5 : 0.72);
      const cy = c.height * 0.52;
      const rotate = (p: { x: number; y: number; z: number }, a: number) => {
        const x1 = p.x * Math.cos(a) - p.z * Math.sin(a);
        const z1 = p.x * Math.sin(a) + p.z * Math.cos(a);
        const y2 = p.y * Math.cos(tilt) - z1 * Math.sin(tilt);
        const z2 = p.y * Math.sin(tilt) + z1 * Math.cos(tilt);
        return { x: x1, y: y2, z: z2 };
      };
      return {
        update(dt, t, p) {
          spin += dt * 0.25 + (p.active ? (p.vx / c.width) * dt * 3.2 * c.params.react : 0);
          for (const a of arcs) {
            a.s += dt * a.sp;
            if (a.s > 1.25) {
              a.a = city();
              a.b = city();
              a.s = 0;
            }
          }
          void t;
        },
        draw(g) {
          fillGradient(g, c.width, c.height, c.palette[0], mixHex(c.palette[0], '#000000', 0.5));
          g.globalCompositeOperation = 'lighter';
          glow(g, cx, cy, R * 1.7, c.palette[1], 0.25 * c.params.intensity);
          for (const p of pts) {
            const q = rotate(p, spin);
            if (q.z < -0.05) continue;
            const a = 0.15 + 0.85 * smooth(-0.05, 1, q.z);
            g.fillStyle = rgba(p.land ? c.palette[3] : c.palette[1], a * (p.land ? 0.95 : 0.45));
            g.beginPath();
            g.arc(cx + q.x * R, cy - q.y * R, (p.land ? 1.7 : 1.1) * (0.7 + 0.5 * q.z), 0, TAU);
            g.fill();
          }
          for (const a of arcs) {
            const steps = 26;
            let prev: { x: number; y: number; z: number } | null = null;
            for (let i = 0; i <= steps; i += 1) {
              const s = i / steps;
              const lift = 1 + 0.32 * Math.sin(Math.PI * s);
              const vx = lerp(a.a.x, a.b.x, s);
              const vy = lerp(a.a.y, a.b.y, s);
              const vz = lerp(a.a.z, a.b.z, s);
              const len = Math.hypot(vx, vy, vz) || 1;
              const q = rotate({ x: (vx / len) * lift, y: (vy / len) * lift, z: (vz / len) * lift }, spin);
              if (prev && q.z > 0 && prev.z > 0) {
                const head = clamp(1 - Math.abs(s - a.s) * 4, 0, 1);
                g.strokeStyle = rgba(c.palette[2], 0.12 + 0.75 * head);
                g.lineWidth = 1 + 1.3 * head;
                g.beginPath();
                g.moveTo(cx + prev.x * R, cy - prev.y * R);
                g.lineTo(cx + q.x * R, cy - q.y * R);
                g.stroke();
                if (head > 0.9) glow(g, cx + q.x * R, cy - q.y * R, 10, c.palette[2], 0.9);
              }
              prev = q;
            }
          }
          g.globalCompositeOperation = 'source-over';
        },
      };
    },
  },
  {
    kind: 'canvas',
    id: 'skyline',
    label: 'Город и деревня',
    palettes: [['#7ab8ff', '#ffe0b0', '#1a2440', '#ffd45a'], ['#2a1a4a', '#ff9a6a', '#150f2a', '#ffcf7a']],
    create(c) {
      const W = c.width;
      const H = c.height;
      const layers = [0, 1, 2].map((l) => {
        const items: Array<{ x: number; w: number; h: number; kind: 'tower' | 'house' | 'tree'; win: number }> = [];
        let x = -20;
        while (x < W + 40) {
          const cityZone = x < W * 0.5;
          const w = cityZone ? 22 + c.rand() * 34 : 18 + c.rand() * 18;
          const kind = cityZone ? 'tower' : c.rand() < 0.35 ? 'tree' : 'house';
          const base = (0.16 + l * 0.05) * H;
          const h = cityZone ? base * (0.7 + c.rand() * (2.4 - l * 0.5)) : base * (0.55 + c.rand() * 0.6);
          items.push({ x, w, h, kind, win: c.rand() });
          x += w + (cityZone ? 2 : 10 + c.rand() * 14);
        }
        return items;
      });
      const smokes = Array.from({ length: 10 }, () => ({ x: W * (0.55 + c.rand() * 0.4), y: H * 0.72, life: c.rand() }));
      let day = 0.2;
      let px = 0;
      return {
        update(dt, t, p) {
          day = (t * 0.035) % 1;
          px += ((p.active ? p.x / W - 0.5 : Math.sin(t * 0.2) * 0.2) - px) * Math.min(1, dt * 3);
          for (const s of smokes) {
            s.life += dt * 0.4;
            if (s.life > 1) {
              s.life = 0;
              s.x = W * (0.55 + c.rand() * 0.4);
            }
          }
        },
        draw(g) {
          // 0 = day, 1 = night (with a dusk in between).
          const night = smooth(0.35, 0.65, Math.abs(((day + 0.25) % 1) - 0.5) * 2 - 0.2 + 0.2);
          const dusk = Math.exp(-Math.pow((night - 0.5) * 4, 2));
          const top = mixHex(c.palette[0], c.palette[2], night);
          const bottom = mixHex(mixHex(c.palette[1], c.palette[0], 0.3), c.palette[2], night * 0.85);
          fillGradient(g, W, H, top, mixHex(bottom, '#ff7a4d', dusk * 0.4));
          const sunA = day * TAU;
          const sx = W * 0.5 - Math.cos(sunA) * W * 0.42;
          const sy = H * 0.85 - Math.sin(sunA) * H * 0.75;
          g.globalCompositeOperation = 'lighter';
          glow(g, sx, sy, H * 0.5, c.palette[3], 0.55);
          g.globalCompositeOperation = 'source-over';
          g.fillStyle = rgba(c.palette[3], 0.95);
          g.beginPath();
          g.arc(sx, sy, H * 0.07, 0, TAU);
          g.fill();
          for (let l = 0; l < 3; l += 1) {
            const off = px * (10 + l * 22) * -1;
            const shade = mixHex(mixHex(c.palette[2], '#ffffff', 0.18 * (2 - l)), c.palette[2], night);
            for (const it of layers[l]) {
              const x = it.x + off;
              const y = H - it.h - (l === 0 ? H * 0.02 : 0);
              g.fillStyle = shade;
              if (it.kind === 'tower') g.fillRect(x, y, it.w, it.h + 4);
              else if (it.kind === 'tree') {
                g.beginPath();
                g.arc(x + it.w / 2, y + it.h * 0.4, it.w * 0.55, 0, TAU);
                g.fill();
                g.fillRect(x + it.w / 2 - 1.5, y + it.h * 0.4, 3, it.h * 0.6 + 4);
              } else {
                g.fillRect(x, y + it.h * 0.35, it.w, it.h * 0.65 + 4);
                g.beginPath();
                g.moveTo(x - 3, y + it.h * 0.35);
                g.lineTo(x + it.w / 2, y);
                g.lineTo(x + it.w + 3, y + it.h * 0.35);
                g.fill();
              }
              if (l >= 1 && it.kind !== 'tree') {
                const rows = Math.floor(it.h / 12);
                const cols = Math.max(1, Math.floor(it.w / 9));
                for (let r = 0; r < rows; r += 1) {
                  for (let k = 0; k < cols; k += 1) {
                    const lit = ((it.win * 97 + r * 13 + k * 7) % 10) / 10 < 0.35 + 0.3 * night;
                    if (!lit) continue;
                    const wx = x + 3 + k * 9;
                    const wy = y + 6 + r * 12 + (it.kind === 'house' ? it.h * 0.35 : 0);
                    if (wy > H) continue;
                    const near = c.params.react * (1 - clamp(Math.hypot(wx - (px + 0.5) * W, wy - H * 0.5) / (W * 0.25), 0, 1));
                    g.fillStyle = rgba(c.palette[3], clamp(0.15 + night * 0.85 + near * 0.3, 0, 1));
                    g.fillRect(wx, wy, 4, 6);
                  }
                }
              }
            }
          }
          for (const s of smokes) {
            g.fillStyle = rgba('#ffffff', 0.18 * (1 - s.life));
            g.beginPath();
            g.arc(s.x + s.life * 20 + px * -30, s.y - s.life * H * 0.35, 4 + s.life * 12, 0, TAU);
            g.fill();
          }
        },
      };
    },
  },
  {
    kind: 'canvas',
    id: 'equalizer',
    label: 'Эквалайзер',
    palettes: [['#0d0a24', '#5a7cff', '#ff5ac8', '#5affe6'], ['#0a1a10', '#3aff9a', '#e0ff5a', '#5affe6']],
    create(c) {
      const gap = clamp(c.width / 90, 5, 12);
      const n = Math.max(10, Math.floor(c.width / gap));
      const ph = Array.from({ length: n }, () => c.rand() * TAU);
      const sp = Array.from({ length: n }, () => 1.2 + c.rand() * 2.6);
      const h = new Float32Array(n);
      type Note = { x: number; y: number; vy: number; ch: string; life: number };
      const notes: Note[] = [];
      return {
        update(dt, t, p) {
          const base = c.height * 0.72;
          for (let i = 0; i < n; i += 1) {
            const x = (i + 0.5) * gap;
            const env = 0.55 + 0.45 * Math.sin(t * 0.7 + i * 0.09) * Math.sin(t * 0.31 + i * 0.03);
            let v = (0.25 + 0.75 * Math.abs(Math.sin(t * sp[i] + ph[i]))) * env;
            if (p.active) v += c.params.react * 0.7 * Math.exp(-Math.pow((x - p.x) / (c.width * 0.07), 2));
            v = clamp(v, 0, 1.25);
            h[i] += (v * base * 0.9 * c.params.intensity - h[i]) * Math.min(1, dt * 14);
            if (v > 1.05 && c.rand() < 0.1 && notes.length < 24) notes.push({ x, y: c.height * 0.3, vy: -30 - c.rand() * 30, ch: c.rand() < 0.5 ? '♪' : '♫', life: 1 });
          }
          for (let i = notes.length - 1; i >= 0; i -= 1) {
            const nt = notes[i];
            nt.y += nt.vy * dt;
            nt.life -= dt * 0.5;
            if (nt.life <= 0) notes.splice(i, 1);
          }
        },
        draw(g) {
          fillGradient(g, c.width, c.height, c.palette[0], mixHex(c.palette[0], c.palette[1], 0.15));
          const base = c.height * 0.72;
          g.globalCompositeOperation = 'lighter';
          for (let i = 0; i < n; i += 1) {
            const x = i * gap + gap * 0.15;
            const bw = gap * 0.7;
            const grad = g.createLinearGradient(0, base - h[i], 0, base);
            grad.addColorStop(0, c.palette[2]);
            grad.addColorStop(1, c.palette[1]);
            g.fillStyle = grad;
            g.fillRect(x, base - h[i], bw, h[i]);
            g.fillStyle = rgba(c.palette[3], 0.9);
            g.fillRect(x, base - h[i] - 3, bw, 2);
            g.fillStyle = rgba(c.palette[1], 0.2);
            g.fillRect(x, base + 2, bw, h[i] * 0.3);
          }
          glow(g, c.width * 0.5, base, c.width * 0.5, c.palette[1], 0.18);
          g.globalCompositeOperation = 'source-over';
          g.font = `700 18px ${FONT_SANS}`;
          g.textAlign = 'center';
          for (const nt of notes) {
            g.fillStyle = rgba(c.palette[3], nt.life);
            g.fillText(nt.ch, nt.x, nt.y);
          }
        },
      };
    },
  },
  {
    kind: 'canvas',
    id: 'route-map',
    label: 'Карта маршрута',
    palettes: [['#e8d6ac', '#c0563a', '#2a6a8a', '#3a2a1a'], ['#0e2438', '#ffb45a', '#5ad0ff', '#d0e8ff']],
    create(c) {
      const dark = c.palette[0].startsWith('#0');
      const W = c.width;
      const H = c.height;
      const pins = Array.from({ length: 6 }, (_, i) => ({ x: W * (0.08 + (i / 5) * 0.84) + (c.rand() - 0.5) * W * 0.05, y: H * (0.3 + c.rand() * 0.45), ph: c.rand() * TAU }));
      const curve = (s: number) => {
        const f = s * (pins.length - 1);
        const i = Math.min(pins.length - 2, Math.floor(f));
        const u = f - i;
        const p0 = pins[Math.max(0, i - 1)];
        const p1 = pins[i];
        const p2 = pins[i + 1];
        const p3 = pins[Math.min(pins.length - 1, i + 2)];
        const cr = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u * u + (-a + 3 * b - 3 * cc + d) * u * u * u);
        return { x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y) };
      };
      const land = Array.from({ length: 7 }, () => ({ x: c.rand() * W, y: c.rand() * H, r: H * (0.25 + c.rand() * 0.4), seed: c.rand() * 100 }));
      const feet: Array<{ x: number; y: number; life: number }> = [];
      let prog = 0;
      let footTimer = 0;
      return {
        update(dt, t, p) {
          prog = (prog + dt * 0.05) % 1.15;
          footTimer += dt;
          if (p.active && footTimer > 0.1) {
            footTimer = 0;
            feet.push({ x: p.x, y: p.y, life: 1 });
          }
          for (let i = feet.length - 1; i >= 0; i -= 1) {
            feet[i].life -= dt * 0.35;
            if (feet[i].life <= 0) feet.splice(i, 1);
          }
          void t;
        },
        draw(g) {
          g.fillStyle = c.palette[0];
          g.fillRect(0, 0, W, H);
          for (const l of land) {
            g.fillStyle = dark ? rgba(c.palette[2], 0.16) : rgba('#b8a070', 0.35);
            g.beginPath();
            for (let a = 0; a <= 24; a += 1) {
              const ang = (a / 24) * TAU;
              const rr = l.r * (0.7 + 0.3 * Math.sin(ang * 3 + l.seed) * Math.cos(ang * 2 - l.seed));
              const px = l.x + Math.cos(ang) * rr * 1.5;
              const py = l.y + Math.sin(ang) * rr;
              if (a === 0) g.moveTo(px, py);
              else g.lineTo(px, py);
            }
            g.fill();
          }
          g.strokeStyle = rgba(c.palette[3], dark ? 0.12 : 0.13);
          g.lineWidth = 1;
          for (let x = 0; x < W; x += 40) {
            g.beginPath();
            g.moveTo(x, 0);
            g.lineTo(x, H);
            g.stroke();
          }
          for (let y = 0; y < H; y += 40) {
            g.beginPath();
            g.moveTo(0, y);
            g.lineTo(W, y);
            g.stroke();
          }
          // The route, dotted, and how far it has been travelled.
          g.setLineDash([2, 7]);
          g.lineWidth = 2.5;
          g.strokeStyle = rgba(c.palette[1], 0.85);
          g.beginPath();
          for (let i = 0; i <= 120; i += 1) {
            const q = curve(Math.min(1, (i / 120) * Math.min(prog, 1)));
            if (i === 0) g.moveTo(q.x, q.y);
            else g.lineTo(q.x, q.y);
          }
          g.stroke();
          g.setLineDash([]);
          for (const f of feet) {
            g.fillStyle = rgba(c.palette[1], f.life * 0.7);
            g.beginPath();
            g.arc(f.x, f.y, 3, 0, TAU);
            g.fill();
          }
          for (let i = 0; i < pins.length; i += 1) {
            const pn = pins[i];
            const reached = prog * (pins.length - 1) >= i - 0.02;
            const bounce = reached ? Math.abs(Math.sin(pn.ph + performance.now() / 500)) * 4 : 0;
            g.fillStyle = reached ? c.palette[1] : rgba(c.palette[3], 0.4);
            g.beginPath();
            g.arc(pn.x, pn.y - 8 - bounce, 6, Math.PI, 0);
            g.lineTo(pn.x, pn.y);
            g.closePath();
            g.fill();
            g.fillStyle = c.palette[0];
            g.beginPath();
            g.arc(pn.x, pn.y - 9 - bounce, 2.2, 0, TAU);
            g.fill();
          }
          const q = curve(Math.min(1, prog));
          const q2 = curve(Math.min(1, prog + 0.01));
          g.save();
          g.translate(q.x, q.y);
          g.rotate(Math.atan2(q2.y - q.y, q2.x - q.x));
          g.fillStyle = c.palette[3];
          g.strokeStyle = c.palette[0];
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(14, 0);
          g.lineTo(-8, -9);
          g.lineTo(-3, 0);
          g.lineTo(-8, 9);
          g.closePath();
          g.fill();
          g.stroke();
          g.restore();
        },
      };
    },
  },
];
