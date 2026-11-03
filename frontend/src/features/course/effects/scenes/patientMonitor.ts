import type { CanvasSceneDef } from './types';
import { FONT_SANS, TAU, clamp, rgba } from './kit';

/**
 * "Be healthy": a bedside patient monitor. Three sweeping traces drawn in glowing phosphor on a dark screen — lead II
 * ECG (the P wave, QRS complex and T wave from McSharry's model: Gaussian bumps along the beat's phase), the
 * pulse-oximeter's plethysmograph (a systolic upstroke with a dicrotic notch, a quarter second behind each R wave) and
 * respiration — with an erase bar running ahead of the pen, as on a real monitor. On the right, the numbers: heart
 * rate with a heart that beats with every QRS, SpO₂, blood pressure, breathing rate and temperature. The rate breathes
 * a little with the respiration (sinus arrhythmia), and rises while the cursor is near, calming again when it leaves.
 */

/** McSharry et al. (2003): angle (rad), amplitude and width of the P, Q, R, S and T waves. */
const WAVES: [number, number, number][] = [
  [-Math.PI / 3, 1.2, 0.25],
  [-Math.PI / 12, -5, 0.1],
  [0, 30, 0.1],
  [Math.PI / 12, -7.5, 0.1],
  [Math.PI / 2, 0.75, 0.4],
];

function ecgAt(phase: number) {
  let z = 0;
  const th = phase * TAU - Math.PI;
  for (const [a0, amp, width] of WAVES) {
    let d = th - a0;
    d -= TAU * Math.round(d / TAU);
    z += amp * Math.exp(-(d * d) / (2 * width * width)) * width;
  }
  return z;
}
const ECG_PEAK = Math.max(...Array.from({ length: 400 }, (_, i) => ecgAt(i / 400)));

function plethAt(phase: number) {
  const f = ((phase % 1) + 1) % 1;
  return Math.exp(-(((f - 0.18) / 0.085) ** 2)) + 0.38 * Math.exp(-(((f - 0.42) / 0.11) ** 2)) + 0.12 * Math.exp(-(((f - 0.08) / 0.05) ** 2));
}

export const PATIENT_MONITOR: CanvasSceneDef = {
  kind: 'canvas',
  id: 'ecg',
  label: 'Монитор пациента',
  palettes: [['#020806', '#3dff8a', '#3de2ff', '#ffe14d'], ['#05060d', '#6dff9d', '#7ab8ff', '#ffb84d']],
  create(c) {
    const W = c.width;
    const H = c.height;
    const S = c.dpr;
    const unit = clamp(H / 150, 0.8, 3);
    const [bg, ecgCol, plethCol, respCol] = c.palette;
    // The monitor sits to the right (the card's picture and title are on the left): traces, then the numbers.
    const left = W * (c.body ? 0.1 : 0.3);
    const numbers = W * 0.78;
    const right = numbers - 8 * unit;
    const rows = [
      { col: ecgCol, label: 'II', y0: H * 0.08, y1: H * 0.44 },
      { col: plethCol, label: 'Pleth', y0: H * 0.48, y1: H * 0.72 },
      { col: respCol, label: 'Resp', y0: H * 0.76, y1: H * 0.95 },
    ];

    const make = () => {
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(W * S));
      cv.height = Math.max(1, Math.round(H * S));
      const g = cv.getContext('2d')!;
      g.scale(S, S);
      return { cv, g };
    };
    // The screen: dark glass with a faint dotted grid and scanlines, painted once.
    const screen = make();
    {
      const g = screen.g;
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      const glow = g.createRadialGradient(W * 0.6, H * 0.5, 0, W * 0.6, H * 0.5, W * 0.6);
      glow.addColorStop(0, 'rgba(40,90,70,0.16)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(120,200,160,0.1)';
      const step = 10 * unit;
      for (let x = left; x < right; x += step) for (let y = H * 0.06; y < H * 0.96; y += step) g.fillRect(x, y, Math.max(0.8, unit * 0.8), Math.max(0.8, unit * 0.8));
      for (let y = 0; y < H; y += 3) {
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(0, y, W, 1);
      }
      g.font = `600 ${Math.round(9 * unit)}px ${FONT_SANS}`;
      g.textBaseline = 'top';
      for (const r of rows) {
        g.fillStyle = rgba(r.col, 0.75);
        g.fillText(r.label, left + 3 * unit, r.y0);
      }
      // Dividers of the number panel.
      g.strokeStyle = 'rgba(120,200,160,0.18)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(numbers, H * 0.05);
      g.lineTo(numbers, H * 0.95);
      g.stroke();
    }
    const trace = make();

    let clock = 0;
    let beat = 0.3;
    let breath = 0;
    let hr = 72;
    let excite = 0;
    let penX = left;
    let lastBeatAt = -1;
    const last = rows.map(() => ({ y: 0, ok: false }));
    const sweep = 60 * unit; // px per second
    let spo2 = 98;
    let flash = 0;

    const valueOf = (i: number, beatPhase: number, breathPhase: number) => {
      if (i === 0) return ecgAt(beatPhase) / ECG_PEAK;
      if (i === 1) return plethAt(beatPhase - 0.22) / 1.1;
      return 0.5 + 0.42 * Math.sin(breathPhase * TAU - Math.PI / 2);
    };

    return {
      update(dt, t, p) {
        const step = Math.min(dt, 0.05);
        clock += step;
        // The cursor near the monitor is exciting; the heart speeds up and slows down again gently.
        const near = p.active ? clamp(1 - Math.abs(p.x - W * 0.62) / (W * 0.5), 0, 1) * c.params.react : 0;
        excite += (near - excite) * Math.min(1, step * 0.8);
        breath = (breath + (step * (15 + excite * 8)) / 60) % 1;
        const target = 70 + 38 * excite + 4 * Math.sin(breath * TAU);
        hr += (target - hr) * Math.min(1, step * 2);
        beat += (step * hr) / 60;
        if (Math.floor(beat) !== Math.floor(beat - (step * hr) / 60)) {
          lastBeatAt = clock;
          flash = 1;
          spo2 = clamp(spo2 + (Math.random() - 0.5) * 0.4, 96.5, 99.4);
        }
        flash = Math.max(0, flash - step * 6);
        // The pen: new samples from the last pen place to the new one, an erase bar ahead of it.
        const g = trace.g;
        const from = penX;
        const to = penX + sweep * step * clamp(c.params.speed, 0.3, 3);
        const erase = 14 * unit;
        const drawTo = Math.min(to, right);
        g.globalCompositeOperation = 'destination-out';
        g.fillStyle = '#000';
        g.fillRect(from, 0, Math.min(drawTo + erase, right) - from + 1, H);
        if (drawTo + erase > right) g.fillRect(left, 0, drawTo + erase - right, H);
        g.globalCompositeOperation = 'lighter';
        g.lineJoin = 'round';
        g.lineCap = 'round';
        const samples = Math.max(2, Math.ceil((drawTo - from) / (1.5 * unit)));
        rows.forEach((r, i) => {
          g.strokeStyle = rgba(r.col, 0.95);
          g.shadowColor = r.col;
          g.shadowBlur = 6 * unit;
          g.lineWidth = 1.5 * unit;
          g.beginPath();
          for (let k = 0; k <= samples; k += 1) {
            const x = from + ((drawTo - from) * k) / samples;
            const tt = (x - from) / sweep;
            const bp = beat - ((to - x) / sweep) * (hr / 60);
            const rp = breath - ((to - x) / sweep) * ((15 + excite * 8) / 60);
            const v = valueOf(i, ((bp % 1) + 1) % 1, ((rp % 1) + 1) % 1);
            const y = r.y1 - (r.y1 - r.y0) * (0.12 + 0.76 * clamp(v, -0.15, 1.1)) + (i === 0 ? Math.sin(clock * 37 + tt) * 0.3 * unit : 0);
            if (k === 0 && last[i].ok) g.moveTo(x, last[i].y);
            else if (k === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
            if (k === samples) last[i] = { y, ok: true };
          }
          g.stroke();
        });
        g.shadowBlur = 0;
        penX = to >= right ? left : to;
        if (to >= right) last.forEach((l) => (l.ok = false));
        void t;
      },
      draw(g) {
        g.drawImage(screen.cv, 0, 0, W, H);
        const intensity = clamp(c.params.intensity, 0.3, 2);
        g.globalAlpha = intensity;
        g.drawImage(trace.cv, 0, 0, W, H);
        g.globalAlpha = 1;
        // The pen's bright dot on each trace.
        g.globalCompositeOperation = 'lighter';
        rows.forEach((r, i) => {
          if (!last[i].ok) return;
          const glow = g.createRadialGradient(penX, last[i].y, 0, penX, last[i].y, 7 * unit);
          glow.addColorStop(0, rgba('#ffffff', 0.9));
          glow.addColorStop(0.3, rgba(r.col, 0.6));
          glow.addColorStop(1, rgba(r.col, 0));
          g.fillStyle = glow;
          g.fillRect(penX - 7 * unit, last[i].y - 7 * unit, 14 * unit, 14 * unit);
        });
        g.globalCompositeOperation = 'source-over';
        // The numbers.
        const nx = numbers + 8 * unit;
        const big = Math.round(clamp(H * 0.26, 16, 64));
        const small = Math.round(clamp(H * 0.075, 8, 20));
        g.textBaseline = 'alphabetic';
        g.shadowBlur = 8 * unit;
        const text = (s: string, x: number, y: number, size: number, col: string, weight = 600) => {
          g.font = `${weight} ${size}px ${FONT_SANS}`;
          g.fillStyle = col;
          g.shadowColor = col;
          g.fillText(s, x, y);
        };
        text('HR', nx, H * 0.16, small, rgba(ecgCol, 0.8));
        text(String(Math.round(hr)), nx, H * 0.16 + big, big, ecgCol, 500);
        // The heart beats with every QRS.
        const hs = small * (1 + flash * 0.35);
        g.save();
        g.translate(nx + big * 1.75, H * 0.16 + small * 0.1);
        g.scale(hs / 16, hs / 16);
        g.fillStyle = rgba(ecgCol, 0.5 + flash * 0.5);
        g.shadowColor = ecgCol;
        g.beginPath();
        g.moveTo(0, 4);
        g.bezierCurveTo(-8, -4, -4, -10, 0, -5);
        g.bezierCurveTo(4, -10, 8, -4, 0, 4);
        g.fill();
        g.restore();
        text('SpO₂', nx, H * 0.58, small, rgba(plethCol, 0.8));
        text(`${Math.round(spo2)}`, nx, H * 0.58 + big * 0.72, Math.round(big * 0.72), plethCol, 500);
        text('%', nx + big * 0.9, H * 0.58 + big * 0.72, small, rgba(plethCol, 0.8));
        const col2 = nx + (W - nx) * 0.55;
        text('NIBP', col2, H * 0.16, small, 'rgba(230,236,240,0.7)');
        text('118/76', col2, H * 0.16 + small * 1.5, Math.round(small * 1.25), 'rgba(236,240,244,0.95)', 500);
        text('RR', col2, H * 0.5, small, rgba(respCol, 0.8));
        text(String(Math.round(15 + excite * 8)), col2, H * 0.5 + small * 1.6, Math.round(small * 1.5), respCol, 500);
        text('T °C', col2, H * 0.78, small, 'rgba(255,150,190,0.8)');
        text('36.6', col2, H * 0.78 + small * 1.4, Math.round(small * 1.2), 'rgba(255,170,200,0.95)', 500);
        g.shadowBlur = 0;
        void lastBeatAt;
      },
    };
  },
};
