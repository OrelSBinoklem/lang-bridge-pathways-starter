import type { CanvasSceneDef } from './types';
import { TAU, clamp, mixHex, rgb, rgba } from './kit';
import { createExtraLcdPrograms, type LcdProgram as Program } from './lcdPrograms';

/**
 * "The age of technology and information": a monochrome graphic LCD module of the Game Boy / Palm Pilot era, taken
 * out of its case. A passive-matrix STN panel with four grey levels per pixel (2 bits, as those screens had):
 * the pixels are slow — they darken in about a tenth of a second and clear in a fifth, so anything moving leaves a
 * ghost — each dark pixel casts a small shadow on the reflector behind the liquid crystal, the gaps between pixels
 * show, and rows and columns with a lot of ink shade the rest of their line a little (passive-matrix crosstalk).
 * The glass cell sits on a green circuit board: on the left an amber flex cable runs from the glass ledge to its
 * connector beside the controller chip, on the right a zebra strip presses the glass's contacts onto gold pads among
 * capacitors, resistors and a crystal. In front, a protective window with fine scratches, specks of dust and a soft
 * reflection that shifts with the cursor. The screen runs little programs in turn — boot, snake, a shaded 3D cube,
 * a scrolling marquee in Latvian, Riga at night, radar, a lunar lander and packet routing — a click switches to the next one, and pressing the
 * glass spreads the dark bloom of squeezed liquid crystal.
 */

// ——— A 5×7 pixel font with room above for Latvian accents (macron, caron): glyphs are 9 rows tall. ———
const BASE: Record<string, string> = {
  A: '.###.#...##...#######...##...##...#', B: '####.#...##...#####.#...##...#####.', C: '.###.#...##....#....#....#...#.###.',
  D: '####.#...##...##...##...##...#####.', E: '######....#....####.#....#....#####', F: '######....#....####.#....#....#....',
  G: '.###.#...##....#.####...##...#.####', H: '#...##...##...#######...##...##...#', I: '.###...#....#....#....#....#...###.',
  J: '..###...#....#....#.#..#.#..#..##..', K: '#...##..#.#.#..##...#.#..#..#.#...#', L: '#....#....#....#....#....#....#####',
  M: '#...###.###.#.##.#.##...##...##...#', N: '#...###..##.#.##..###...##...##...#', O: '.###.#...##...##...##...##...#.###.',
  P: '####.#...##...#####.#....#....#....', R: '####.#...##...#####.#.#..#..#.#...#', S: '.#####....#.....###.....#....#####.',
  T: '#####..#....#....#....#....#....#..', U: '#...##...##...##...##...##...#.###.', V: '#...##...##...##...##...#.#.#...#..',
  W: '#...##...##...##.#.##.#.##.#.#.#.#.', X: '#...##...#.#.#...#...#.#.#...##...#', Y: '#...##...#.#.#...#....#....#....#..',
  Z: '#####....#...#...#...#...#....#####', '0': '.###.#...##..###.#.###..##...#.###.', '1': '..#...##....#....#....#....#...###.',
  '2': '.###.#...#....#...#...#...#...#####', '3': '####.....#....#.###.....#....#####.', '4': '...#...##..#.#.#..#.#####...#....#.',
  '5': '######....####.....#....##...#.###.', '6': '.###.#....#....####.#...##...#.###.', '7': '#####....#...#...#...#....#....#...',
  '8': '.###.#...##...#.###.#...##...#.###.', '9': '.###.#...##...#.####....#....#.###.', '!': '..#....#....#....#....#.........#..',
  '-': '................###................', '.': '................................#..', ':': '.......#..............#............',
  '*': '......#.#...#..#####..#...#.#......', ' ': '...................................',
};
const MACRON = ['.....', '.###.'];
const CARON = ['.#.#.', '..#..'];
const ACCENTED: Record<string, [string, string[]]> = { Ā: ['A', MACRON], Ē: ['E', MACRON], Ī: ['I', MACRON], Ū: ['U', MACRON], Š: ['S', CARON], Č: ['C', CARON], Ž: ['Z', CARON] };
function glyph(ch: string): string[] {
  const acc = ACCENTED[ch];
  const base = BASE[acc ? acc[0] : ch] ?? BASE[' '];
  const rows = Array.from({ length: 7 }, (_, r) => base.slice(r * 5, r * 5 + 5).padEnd(5, '.'));
  return [...(acc ? acc[1] : ['.....', '.....']), ...rows];
}
const GLYPHS = new Map<string, string[]>();
const glyphOf = (ch: string) => {
  let g = GLYPHS.get(ch);
  if (!g) {
    g = glyph(ch);
    GLYPHS.set(ch, g);
  }
  return g;
};

export const LCD_SCREEN: CanvasSceneDef = {
  kind: 'canvas',
  id: 'lcd-screen',
  label: 'ЖК-экран',
  palettes: [
    ['#1d5236', '#b4c08a', '#1c2616', '#c8d49a'],
    ['#1a3d5c', '#8fd47a', '#0e1e10', '#b6ff9a'],
    ['#3a2a1e', '#b0b3a6', '#12161a', '#d0d4c8'],
  ],
  create(c) {
    const W = c.width;
    const H = c.height;
    const S = c.dpr;
    const rand = c.rand;
    const [pcbCol, reflector, ink, glowCol] = c.palette;
    const backlit = c.palette[0] === '#1a3d5c';
    const u = c.body ? clamp(Math.min(W, H) / 400, 1, 3) : clamp(H / 170, 0.7, 2.4);

    // Layout: the board, the glass cell on it, the active pixel area inside the cell.
    const mod = c.body
      ? { x0: W * 0.5 - Math.min(W * 0.4, H * 0.75), x1: W * 0.5 + Math.min(W * 0.4, H * 0.75), y0: H * 0.5 - H * 0.3, y1: H * 0.5 + H * 0.3 }
      : { x0: W * 0.335, x1: W * 0.985, y0: H * 0.04, y1: H * 0.96 };
    const mw = mod.x1 - mod.x0;
    const mh = mod.y1 - mod.y0;
    const glass = { x0: mod.x0 + mw * 0.17, x1: mod.x1 - mw * 0.15, y0: mod.y0 + mh * 0.07, y1: mod.y1 - mh * 0.07 };
    const ledge = (glass.x1 - glass.x0) * 0.055;
    const ROWS = c.body ? 48 : 32;
    const pitch = (glass.y1 - glass.y0 - 8 * u) / ROWS;
    const COLS = Math.floor((glass.x1 - glass.x0 - ledge * 2) / pitch);
    const act = { x0: (glass.x0 + glass.x1) / 2 - (COLS * pitch) / 2, y0: (glass.y0 + glass.y1) / 2 - (ROWS * pitch) / 2 };
    const actW = COLS * pitch;
    const actH = ROWS * pitch;
    const win = { x0: glass.x0 - 5 * u, x1: glass.x1 + 5 * u, y0: glass.y0 - 5 * u, y1: glass.y1 + 5 * u };

    const layer = (w = W, h = H) => {
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.ceil(w * S));
      cv.height = Math.max(1, Math.ceil(h * S));
      const g = cv.getContext('2d')!;
      g.scale(S, S);
      return { cv, g };
    };

    // ——— The board and everything on it, painted once. ———
    const board = layer();
    {
      const g = board.g;
      g.fillStyle = mixHex(pcbCol, '#000000', 0.55);
      g.fillRect(0, 0, W, H);
      const vig = g.createRadialGradient(W * 0.66, H * 0.5, 0, W * 0.66, H * 0.5, Math.max(W, H) * 0.7);
      vig.addColorStop(0, 'rgba(255,255,255,0.05)');
      vig.addColorStop(1, 'rgba(0,0,0,0.4)');
      g.fillStyle = vig;
      g.fillRect(0, 0, W, H);
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.6)';
      g.shadowBlur = 10 * u;
      g.shadowOffsetY = 4 * u;
      g.fillStyle = pcbCol;
      g.beginPath();
      g.roundRect(mod.x0, mod.y0, mw, mh, 6 * u);
      g.fill();
      g.restore();
      // Solder mask sheen, copper traces under it, vias, silkscreen.
      const sheen = g.createLinearGradient(mod.x0, mod.y0, mod.x1, mod.y1);
      sheen.addColorStop(0, 'rgba(255,255,255,0.1)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
      sheen.addColorStop(1, 'rgba(0,0,0,0.2)');
      g.fillStyle = sheen;
      g.beginPath();
      g.roundRect(mod.x0, mod.y0, mw, mh, 6 * u);
      g.fill();
      const trace = mixHex(pcbCol, '#9adf8a', 0.28);
      g.strokeStyle = trace;
      g.lineWidth = Math.max(0.8, 1.1 * u);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (let k = 0; k < 26; k += 1) {
        let x = mod.x0 + rand() * mw;
        let y = mod.y0 + rand() * mh;
        g.beginPath();
        g.moveTo(x, y);
        for (let s = 0; s < 4; s += 1) {
          const len = (8 + rand() * 30) * u;
          const dir = Math.floor(rand() * 4);
          const diag = rand() < 0.3;
          x += dir === 0 ? len : dir === 1 ? -len : diag ? len * 0.7 : 0;
          y += dir === 2 ? len : dir === 3 ? -len : diag ? len * 0.7 : 0;
          g.lineTo(clamp(x, mod.x0 + 4, mod.x1 - 4), clamp(y, mod.y0 + 4, mod.y1 - 4));
        }
        g.stroke();
      }
      for (let k = 0; k < 40; k += 1) {
        const x = mod.x0 + 6 * u + rand() * (mw - 12 * u);
        const y = mod.y0 + 6 * u + rand() * (mh - 12 * u);
        g.fillStyle = '#c8a860';
        g.beginPath();
        g.arc(x, y, 1.6 * u, 0, TAU);
        g.fill();
        g.fillStyle = '#10180f';
        g.beginPath();
        g.arc(x, y, 0.7 * u, 0, TAU);
        g.fill();
      }
      g.fillStyle = 'rgba(240,244,236,0.8)';
      g.font = `600 ${Math.max(6, Math.round(5 * u))}px "Consolas", "Courier New", monospace`;
      g.textBaseline = 'top';
      g.fillText('LB-LCD REV 2', mod.x0 + 5 * u, mod.y1 - 9 * u);
      g.fillText('J1', mod.x0 + mw * 0.03, mod.y0 + mh * 0.62);
      g.fillText('U1', mod.x0 + mw * 0.03, mod.y0 + 5 * u);
      g.fillText('C4', mod.x1 - mw * 0.1, mod.y0 + 5 * u);
      g.fillText('Y1', mod.x1 - mw * 0.1, mod.y0 + mh * 0.62);
      // Mounting holes with plated rings.
      for (const [x, y] of [[mod.x0 + 6 * u, mod.y0 + 6 * u], [mod.x1 - 6 * u, mod.y0 + 6 * u], [mod.x0 + 6 * u, mod.y1 - 6 * u], [mod.x1 - 6 * u, mod.y1 - 6 * u]]) {
        g.fillStyle = '#d8b870';
        g.beginPath();
        g.arc(x, y, 3.4 * u, 0, TAU);
        g.fill();
        g.fillStyle = '#0a0c0a';
        g.beginPath();
        g.arc(x, y, 2 * u, 0, TAU);
        g.fill();
      }
      // The controller: a black quad flat pack with its legs, and its markings.
      const chip = { x: mod.x0 + mw * 0.02, y: mod.y0 + mh * 0.14, w: mw * 0.1, h: mh * 0.36 };
      g.fillStyle = '#b8bcc0';
      const legs = 9;
      for (let k = 0; k < legs; k += 1) {
        const yy = chip.y + ((k + 0.5) / legs) * chip.h;
        g.fillRect(chip.x - 2 * u, yy - 0.6 * u, chip.w + 4 * u, 1.2 * u);
      }
      const cg = g.createLinearGradient(chip.x, chip.y, chip.x + chip.w, chip.y + chip.h);
      cg.addColorStop(0, '#2a2c30');
      cg.addColorStop(1, '#101114');
      g.fillStyle = cg;
      g.fillRect(chip.x, chip.y, chip.w, chip.h);
      g.fillStyle = 'rgba(210,214,220,0.75)';
      g.font = `600 ${Math.max(5, Math.round(4 * u))}px "Consolas", monospace`;
      g.save();
      g.translate(chip.x + chip.w * 0.55, chip.y + chip.h * 0.5);
      g.rotate(-Math.PI / 2);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('LB8544', 0, 0);
      g.restore();
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.beginPath();
      g.arc(chip.x + chip.w * 0.25, chip.y + chip.w * 0.25, chip.w * 0.1, 0, TAU);
      g.fill();
      // SMD capacitors and resistors, and the crystal's can.
      const smd = (x: number, y: number, w: number, h: number, body: string, ends: string) => {
        g.fillStyle = ends;
        g.fillRect(x - w / 2, y - h / 2, w * 0.24, h);
        g.fillRect(x + w / 2 - w * 0.24, y - h / 2, w * 0.24, h);
        g.fillStyle = body;
        g.fillRect(x - w / 2 + w * 0.24, y - h / 2, w * 0.52, h);
      };
      for (let k = 0; k < 4; k += 1) smd(mod.x0 + mw * 0.07, mod.y0 + mh * (0.62 + k * 0.08), 7 * u, 3.5 * u, k % 2 ? '#b89a6a' : '#1a1a1a', '#d8dce0');
      for (let k = 0; k < 5; k += 1) smd(mod.x1 - mw * 0.06, mod.y0 + mh * (0.14 + k * 0.08), 7 * u, 3.5 * u, k % 2 ? '#1a1a1a' : '#c8a878', '#d8dce0');
      const xt = { x: mod.x1 - mw * 0.065, y: mod.y0 + mh * 0.78 };
      const xg = g.createLinearGradient(xt.x - 6 * u, xt.y - 4 * u, xt.x + 6 * u, xt.y + 4 * u);
      xg.addColorStop(0, '#f0f2f4');
      xg.addColorStop(0.5, '#9aa0a8');
      xg.addColorStop(1, '#e0e4e8');
      g.fillStyle = xg;
      g.beginPath();
      g.roundRect(xt.x - 7 * u, xt.y - 4.5 * u, 14 * u, 9 * u, 4.5 * u);
      g.fill();

      // The left connection: the flex cable from the glass ledge down to its connector.
      const fx0 = glass.x0 - 1 * u;
      const conn = { x: mod.x0 + mw * 0.135, y0: glass.y0 + (glass.y1 - glass.y0) * 0.2, y1: glass.y1 - (glass.y1 - glass.y0) * 0.2 };
      g.fillStyle = '#efe6d8';
      g.fillRect(conn.x - 4 * u, conn.y0 - 3 * u, 7 * u, conn.y1 - conn.y0 + 6 * u);
      g.fillStyle = '#2a2a2a';
      g.fillRect(conn.x - 1 * u, conn.y0 - 3 * u, 4 * u, conn.y1 - conn.y0 + 6 * u);
      const flex = g.createLinearGradient(conn.x, 0, fx0, 0);
      flex.addColorStop(0, 'rgba(196,120,30,0.95)');
      flex.addColorStop(1, 'rgba(220,150,50,0.85)');
      g.fillStyle = flex;
      g.beginPath();
      g.moveTo(conn.x + 2 * u, conn.y0);
      g.bezierCurveTo(conn.x + (fx0 - conn.x) * 0.5, conn.y0 - 2 * u, fx0 - 4 * u, glass.y0 + 4 * u, fx0 + ledge * 0.8, glass.y0 + 5 * u);
      g.lineTo(fx0 + ledge * 0.8, glass.y1 - 5 * u);
      g.bezierCurveTo(fx0 - 4 * u, glass.y1 - 4 * u, conn.x + (fx0 - conn.x) * 0.5, conn.y1 + 2 * u, conn.x + 2 * u, conn.y1);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(255,215,120,0.75)';
      g.lineWidth = Math.max(0.5, 0.6 * u);
      const traces = 16;
      for (let k = 0; k < traces; k += 1) {
        const f = (k + 0.5) / traces;
        const ya = conn.y0 + (conn.y1 - conn.y0) * f;
        const yb = glass.y0 + 6 * u + (glass.y1 - glass.y0 - 12 * u) * f;
        g.beginPath();
        g.moveTo(conn.x + 3 * u, ya);
        g.bezierCurveTo(conn.x + (fx0 - conn.x) * 0.5, ya, fx0 - 4 * u, yb, fx0 + ledge * 0.7, yb);
        g.stroke();
      }
      // The right connection: gold pads, and the zebra strip that presses the glass's contacts onto them.
      const zx = glass.x1 + 1 * u;
      g.fillStyle = '#d8b050';
      for (let k = 0; k < 18; k += 1) {
        const y = glass.y0 + 4 * u + ((k + 0.5) / 18) * (glass.y1 - glass.y0 - 8 * u);
        g.fillRect(zx - ledge * 0.2, y - 1.4 * u, ledge * 0.9, 2.8 * u);
      }
      const zw = ledge * 0.55;
      g.fillStyle = '#6a6e6a';
      g.fillRect(zx - zw * 0.5, glass.y0 + 2 * u, zw, glass.y1 - glass.y0 - 4 * u);
      for (let y = glass.y0 + 2 * u; y < glass.y1 - 2 * u; y += 1.2 * u) {
        g.fillStyle = Math.floor((y - glass.y0) / (1.2 * u)) % 2 ? 'rgba(20,20,20,0.85)' : 'rgba(200,200,190,0.5)';
        g.fillRect(zx - zw * 0.5, y, zw, 0.6 * u);
      }

      // The glass cell: its ledges with the fine transparent ITO traces fanning to the pixel rows and columns.
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.55)';
      g.shadowBlur = 6 * u;
      g.shadowOffsetY = 2 * u;
      g.fillStyle = mixHex(reflector, '#6a7060', 0.35);
      g.fillRect(glass.x0, glass.y0, glass.x1 - glass.x0, glass.y1 - glass.y0);
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.14)';
      g.lineWidth = Math.max(0.4, 0.4 * u);
      for (let k = 0; k < 24; k += 1) {
        const f = (k + 0.5) / 24;
        g.beginPath();
        g.moveTo(glass.x0 + 2 * u, glass.y0 + 4 * u + f * (glass.y1 - glass.y0 - 8 * u));
        g.lineTo(act.x0 - 1, act.y0 + f * actH);
        g.stroke();
        g.beginPath();
        g.moveTo(glass.x1 - 2 * u, glass.y0 + 4 * u + f * (glass.y1 - glass.y0 - 8 * u));
        g.lineTo(act.x0 + actW + 1, act.y0 + f * actH);
        g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 1;
      g.strokeRect(glass.x0 + 0.5, glass.y0 + 0.5, glass.x1 - glass.x0 - 1, glass.y1 - glass.y0 - 1);
      // The reflector behind the pixels (or the lit backlight), a little uneven.
      const rf = g.createLinearGradient(act.x0, act.y0, act.x0 + actW, act.y0 + actH);
      rf.addColorStop(0, mixHex(reflector, '#ffffff', backlit ? 0.18 : 0.1));
      rf.addColorStop(1, mixHex(reflector, '#000000', 0.12));
      g.fillStyle = rf;
      g.fillRect(act.x0 - pitch * 0.6, act.y0 - pitch * 0.6, actW + pitch * 1.2, actH + pitch * 1.2);
      for (let k = 0; k < 900; k += 1) {
        g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.04)';
        g.fillRect(act.x0 + rand() * actW, act.y0 + rand() * actH, 1.2, 1.2);
      }
    }

    // The gaps between pixels: a light grid laid over the pixels.
    const grid = layer();
    {
      const g = grid.g;
      g.fillStyle = rgba(mixHex(reflector, '#ffffff', 0.15), 0.5);
      const gap = Math.max(0.5, pitch * 0.12);
      for (let x = 0; x <= COLS; x += 1) g.fillRect(act.x0 + x * pitch - gap / 2, act.y0, gap, actH);
      for (let y = 0; y <= ROWS; y += 1) g.fillRect(act.x0, act.y0 + y * pitch - gap / 2, actW, gap);
    }
    // The protective window: faint tint, fine scratches, dust, a smudge.
    const windowLayer = layer();
    {
      const g = windowLayer.g;
      g.save();
      g.beginPath();
      g.roundRect(win.x0, win.y0, win.x1 - win.x0, win.y1 - win.y0, 4 * u);
      g.clip();
      g.fillStyle = 'rgba(160,190,210,0.05)';
      g.fillRect(win.x0, win.y0, win.x1 - win.x0, win.y1 - win.y0);
      for (let k = 0; k < 34; k += 1) {
        const x = win.x0 + rand() * (win.x1 - win.x0);
        const y = win.y0 + rand() * (win.y1 - win.y0);
        const len = (10 + rand() * 70) * u;
        const a = (rand() - 0.5) * 0.9 + (rand() < 0.5 ? 0 : Math.PI / 2) * 0.3;
        g.strokeStyle = `rgba(255,255,255,${0.05 + rand() * 0.1})`;
        g.lineWidth = Math.max(0.35, 0.35 * u);
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (rand() - 0.5) * 6 * u, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
      for (let k = 0; k < 60; k += 1) {
        g.fillStyle = `rgba(255,255,255,${0.1 + rand() * 0.25})`;
        g.beginPath();
        g.arc(win.x0 + rand() * (win.x1 - win.x0), win.y0 + rand() * (win.y1 - win.y0), (0.3 + rand() * 0.7) * u, 0, TAU);
        g.fill();
      }
      const sx = win.x0 + (win.x1 - win.x0) * (0.25 + rand() * 0.5);
      const sy = win.y0 + (win.y1 - win.y0) * (0.3 + rand() * 0.4);
      const smudge = g.createRadialGradient(sx, sy, 0, sx, sy, 24 * u);
      smudge.addColorStop(0, 'rgba(255,255,255,0.06)');
      smudge.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = smudge;
      g.fillRect(sx - 24 * u, sy - 24 * u, 48 * u, 48 * u);
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = 1;
      g.beginPath();
      g.roundRect(win.x0 + 0.5, win.y0 + 0.5, win.x1 - win.x0 - 1, win.y1 - win.y0 - 1, 4 * u);
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.roundRect(win.x0 - 0.5, win.y0 - 0.5, win.x1 - win.x0 + 1, win.y1 - win.y0 + 1, 4 * u);
      g.stroke();
    }

    // ——— The pixels: 2-bit targets written by the programs, and the slow liquid crystal following them. ———
    const target = new Uint8Array(COLS * ROWS);
    const level = new Float32Array(COLS * ROWS);
    const small = document.createElement('canvas');
    small.width = COLS;
    small.height = ROWS;
    const sg = small.getContext('2d')!;
    const img = sg.createImageData(COLS, ROWS);
    const [ir, ig, ib] = rgb(ink);
    const OPACITY = [0, 0.3, 0.6, 0.92];
    const rowInk = new Float32Array(ROWS);
    const colInk = new Float32Array(COLS);

    const put = (x: number, y: number, v: number) => {
      x = Math.round(x);
      y = Math.round(y);
      if (x >= 0 && y >= 0 && x < COLS && y < ROWS) target[y * COLS + x] = v;
    };
    const rect = (x: number, y: number, w: number, h: number, v: number, fill = true) => {
      for (let yy = 0; yy < h; yy += 1) for (let xx = 0; xx < w; xx += 1) if (fill || yy === 0 || xx === 0 || yy === h - 1 || xx === w - 1) put(x + xx, y + yy, v);
    };
    const line = (x0: number, y0: number, x1: number, y1: number, v: number) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let k = 0; k <= n; k += 1) put(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, v);
    };
    const textWidth = (s: string, sc = 1) => s.length * 6 * sc - sc;
    const text = (s: string, x: number, y: number, v: number, sc = 1) => {
      let cx = Math.round(x);
      for (const ch of s) {
        const g = glyphOf(ch);
        for (let r = 0; r < 9; r += 1) for (let q = 0; q < 5; q += 1) if (g[r][q] === '#') for (let a = 0; a < sc; a += 1) for (let b = 0; b < sc; b += 1) put(cx + q * sc + a, Math.round(y) + r * sc + b, v);
        cx += 6 * sc;
      }
    };

    // ——— The programs. ———
    const boot: Program = (() => {
      let t0 = 0;
      return {
        name: 'boot',
        start() {
          t0 = -1;
        },
        tick(_dt, t) {
          if (t0 < 0) t0 = t;
        },
        draw(t) {
          const e = t - t0;
          const sc = ROWS >= 40 ? 3 : 2;
          const title = 'LB-OS';
          // Glyphs keep two empty rows on top for accents: start the title that much higher.
          const ty = Math.round(ROWS * 0.04) - 2 * sc;
          text(title, (COLS - textWidth(title, sc)) / 2, ty, 3, sc);
          const v = 'V1.0';
          text(v, (COLS - textWidth(v)) / 2, ty + 9 * sc - 2, 2);
          const bw = Math.round(COLS * 0.6);
          const bx = Math.round((COLS - bw) / 2);
          const by = ROWS - 7;
          rect(bx, by, bw, 5, 2, false);
          const fill = Math.floor(clamp(e / 2.6, 0, 1) * (bw - 2));
          rect(bx + 1, by + 1, fill, 3, 3);
          // A dither of the lightest grey behind: the look of an idle STN screen.
          for (let x = 0; x < COLS; x += 2) put(x, 0, 1);
        },
      };
    })();

    const snake: Program = (() => {
      const cell = 2;
      const gw = Math.floor((COLS - 2) / cell);
      const gh = Math.floor((ROWS - 10) / cell);
      let body: [number, number][] = [];
      let dir: [number, number] = [1, 0];
      let food: [number, number] = [0, 0];
      let acc = 0;
      let score = 0;
      let dead = 0;
      const free = (x: number, y: number) => x >= 0 && y >= 0 && x < gw && y < gh && !body.some(([bx, by]) => bx === x && by === y);
      const placeFood = () => {
        for (let k = 0; k < 200; k += 1) {
          const f: [number, number] = [Math.floor(rand() * gw), Math.floor(rand() * gh)];
          if (free(...f)) {
            food = f;
            return;
          }
        }
      };
      const reset = () => {
        body = [[4, 4], [3, 4], [2, 4]];
        dir = [1, 0];
        score = 0;
        dead = 0;
        placeFood();
      };
      reset();
      // A greedy player: towards the food, never into itself if it can help it, looking two steps ahead.
      const choose = () => {
        const [hx, hy] = body[0];
        const opts: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        let best = dir;
        let bestScore = -Infinity;
        for (const d of opts) {
          if (d[0] === -dir[0] && d[1] === -dir[1]) continue;
          const nx = hx + d[0];
          const ny = hy + d[1];
          if (!free(nx, ny)) continue;
          let exits = 0;
          for (const e of opts) if (free(nx + e[0], ny + e[1])) exits += 1;
          const s = -Math.abs(nx - food[0]) - Math.abs(ny - food[1]) + exits * 1.5 + rand() * 0.3;
          if (s > bestScore) {
            bestScore = s;
            best = d;
          }
        }
        return best;
      };
      return {
        name: 'snake',
        start() {
          reset();
        },
        tick(dt) {
          if (dead > 0) {
            dead -= dt;
            if (dead <= 0) reset();
            return;
          }
          acc += dt;
          while (acc > 0.09) {
            acc -= 0.09;
            dir = choose();
            const head: [number, number] = [body[0][0] + dir[0], body[0][1] + dir[1]];
            if (!free(...head)) {
              dead = 1.4;
              return;
            }
            body.unshift(head);
            if (head[0] === food[0] && head[1] === food[1]) {
              score += 1;
              placeFood();
              if (body.length > gw * gh * 0.35) dead = 1.4;
            } else body.pop();
          }
        },
        draw(t) {
          text(`SCORE ${String(score).padStart(3, '0')}`, 1, -2, 3);
          const oy = 9;
          rect(0, oy - 1, COLS, gh * cell + 2, 2, false);
          const blink = dead > 0 && Math.floor(t * 6) % 2 === 0;
          body.forEach(([x, y], k) => {
            if (blink) return;
            rect(1 + x * cell, oy + y * cell, cell, cell, k === 0 ? 3 : k % 2 ? 2 : 3);
          });
          if (Math.floor(t * 4) % 2 === 0) rect(1 + food[0] * cell, oy + food[1] * cell, cell, cell, 3);
          if (dead > 0) {
            const s = 'GAME OVER';
            rect((COLS - textWidth(s)) / 2 - 2, ROWS / 2 - 6, textWidth(s) + 4, 11, 0);
            text(s, (COLS - textWidth(s)) / 2, ROWS / 2 - 6, 3);
          }
        },
      };
    })();

    const cube: Program = (() => {
      const V = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z] as [number, number, number])));
      const F = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
      let a = 0;
      let b = 0;
      return {
        name: 'cube',
        start() {},
        tick(dt) {
          a += dt * 0.9;
          b += dt * 0.6;
        },
        draw() {
          const cx = COLS / 2;
          const cy = ROWS / 2;
          const s = ROWS * 0.3;
          const P = V.map(([x, y, z]) => {
            const x1 = x * Math.cos(a) - z * Math.sin(a);
            const z1 = x * Math.sin(a) + z * Math.cos(a);
            const y1 = y * Math.cos(b) - z1 * Math.sin(b);
            const z2 = y * Math.sin(b) + z1 * Math.cos(b);
            const k = 4 / (4 + z2);
            return [cx + x1 * s * k * 1.25, cy + y1 * s * k, z2] as [number, number, number];
          });
          const faces = F.map((f) => ({ f, z: f.reduce((acc, i) => acc + P[i][2], 0) / 4 })).sort((p, q) => q.z - p.z);
          for (const { f } of faces) {
            const [p0, p1, p2] = [P[f[0]], P[f[1]], P[f[2]]];
            const cross = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
            if (cross <= 0) continue;
            // Flat shading in the screen's three inks, by how much the face turns to the light.
            const nx = (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1]);
            const nz = cross;
            const lit = clamp((nz * 0.8 - nx * 0.4) / Math.hypot(nx, nz, 1), 0, 1);
            const shade = lit > 0.66 ? 1 : lit > 0.33 ? 2 : 3;
            const xs = f.map((i) => P[i][0]);
            const ys = f.map((i) => P[i][1]);
            for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 1) {
              for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x += 1) {
                let inside = true;
                for (let k = 0; k < 4 && inside; k += 1) {
                  const A = P[f[k]];
                  const B = P[f[(k + 1) % 4]];
                  if ((B[0] - A[0]) * (y + 0.5 - A[1]) - (B[1] - A[1]) * (x + 0.5 - A[0]) < 0) inside = false;
                }
                if (inside) put(x, y, shade);
              }
            }
            for (let k = 0; k < 4; k += 1) line(P[f[k]][0], P[f[k]][1], P[f[(k + 1) % 4]][0], P[f[(k + 1) % 4]][1], 3);
          }
        },
      };
    })();

    const marquee: Program = (() => {
      const msg = 'SVEIKI!  INFORMĀCIJAS LAIKMETS  *  DATORS  TELEFONS  INTERNETS  *  ';
      let off = 0;
      return {
        name: 'marquee',
        start() {
          off = 0;
        },
        tick(dt) {
          // Slow enough to read through the slow pixels' smear.
          off += dt * 15;
        },
        draw() {
          const sc = ROWS >= 40 ? 3 : 2;
          const w = textWidth(msg, sc) + 6 * sc;
          const y = Math.round((ROWS - 9 * sc) / 2) - 3;
          for (let x = 0; x < COLS; x += 1) {
            if ((x + Math.floor(off / 2)) % 4 === 0) put(x, y - 3, 1);
            put(x, y + 9 * sc + 1, 1);
          }
          const start = -(off % w);
          text(msg, start, y, 3, sc);
          text(msg, start + w, y, 3, sc);
          const d = new Date();
          const clock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          text(clock, COLS - textWidth(clock) - 1, ROWS - 9, 2);
        },
      };
    })();

    const riga: Program = (() => {
      const heights = new Int16Array(COLS);
      const lit = new Uint8Array(COLS * ROWS);
      const flakes = Array.from({ length: Math.round(COLS * 0.25) }, () => ({ x: rand() * COLS, y: rand() * ROWS, v: 3 + rand() * 5 }));
      {
        let x = 0;
        while (x < COLS) {
          const w = 3 + Math.floor(rand() * 5);
          const h = Math.round(ROWS * (0.18 + rand() * 0.16));
          for (let k = 0; k < w && x + k < COLS; k += 1) heights[x + k] = h + (k === Math.floor(w / 2) && rand() < 0.5 ? 2 : 0);
          x += w;
        }
        // St Peter's and the Dome's spires.
        for (const [cx, hh] of [[Math.round(COLS * 0.3), 0.72], [Math.round(COLS * 0.62), 0.55]] as const) {
          const top = Math.round(ROWS * hh);
          for (let k = -2; k <= 2; k += 1) if (cx + k >= 0 && cx + k < COLS) heights[cx + k] = Math.max(heights[cx + k], Math.round(ROWS * 0.4));
          for (let k = -1; k <= 1; k += 1) if (cx + k >= 0 && cx + k < COLS) heights[cx + k] = Math.max(heights[cx + k], Math.round(top * 0.75));
          heights[cx] = top;
        }
        for (let i = 0; i < lit.length; i += 1) lit[i] = rand() < 0.12 ? 1 : 0;
      }
      return {
        name: 'riga',
        start() {},
        tick(dt) {
          for (const f of flakes) {
            f.y += f.v * dt;
            f.x += Math.sin(f.y * 0.4) * dt * 2;
            if (f.y > ROWS) {
              f.y = -1;
              f.x = rand() * COLS;
            }
          }
        },
        draw(t) {
          // The sky: darker grey high up, a dithered middle grey lower down, the moon left clear.
          const mx = Math.round(COLS * 0.8);
          const my = Math.round(ROWS * 0.22);
          for (let y = 0; y < ROWS; y += 1) {
            for (let x = 0; x < COLS; x += 1) {
              const dm = Math.hypot(x - mx, y - my);
              if (dm < ROWS * 0.12) continue;
              const v = y < ROWS * 0.35 ? 2 : y < ROWS * 0.6 ? ((x + y) % 2 ? 2 : 1) : 1;
              put(x, y, dm < ROWS * 0.16 ? 1 : v);
            }
          }
          for (let x = 0; x < COLS; x += 1) {
            for (let y = ROWS - heights[x]; y < ROWS; y += 1) {
              const window = lit[y * COLS + x] && y > ROWS - heights[x] + 1 && x % 2 === 0 && y % 2 === 0;
              put(x, y, window ? (Math.sin(t + x * 3.1 + y) > -0.9 ? 1 : 3) : 3);
            }
          }
          for (const f of flakes) put(f.x, f.y, 0);
        },
      };
    })();

    const programs = [boot, snake, cube, marquee, riga, ...createExtraLcdPrograms({ cols: COLS, rows: ROWS, put, line, rect, text, rand })];
    let current = 0;
    let since = 0;
    let clock = 0;
    boot.start();
    const durations: Record<string, number> = { boot: 3.4, snake: 12, cube: 8, marquee: 10, riga: 9, radar: 10, lander: 10, network: 9 };
    const next = () => {
      current = (current + 1) % programs.length;
      if (current === 0) current = 1;
      since = 0;
      programs[current].start();
    };
    const presses: { x: number; y: number; age: number; hold: boolean }[] = [];
    let reflectX = 0;

    return {
      update(dt, _t, p) {
        const sdt = Math.min(dt, 0.05);
        clock += sdt * clamp(c.params.speed, 0.2, 3);
        since += sdt * clamp(c.params.speed, 0.2, 3);
        if (since > durations[programs[current].name]) next();
        const inGlass = p.active && p.rawX > win.x0 && p.rawX < win.x1 && p.rawY > win.y0 && p.rawY < win.y1;
        if (p.clicked && inGlass && c.params.react > 0) {
          next();
          presses.push({ x: (p.rawX - act.x0) / pitch, y: (p.rawY - act.y0) / pitch, age: 0, hold: true });
        }
        const prog = programs[current];
        prog.tick(sdt * clamp(c.params.speed, 0.2, 3), clock);
        for (const pr of presses) {
          pr.age += sdt;
          if (pr.hold && (!p.pressed || !p.active)) pr.hold = false;
          if (pr.hold) {
            pr.x = (p.rawX - act.x0) / pitch;
            pr.y = (p.rawY - act.y0) / pitch;
          }
        }
        for (let k = presses.length - 1; k >= 0; k -= 1) if (!presses[k].hold && presses[k].age > 2.5) presses.splice(k, 1);
        reflectX += ((p.active ? (p.x - (win.x0 + win.x1) / 2) / (win.x1 - win.x0) : Math.sin(clock * 0.2) * 0.2) - reflectX) * Math.min(1, sdt * 3);

        // Write this frame, then let the liquid crystal follow: darkening fast, clearing slowly.
        target.fill(0);
        prog.draw(clock);
        const kOn = 1 - Math.exp(-sdt / 0.09);
        const kOff = 1 - Math.exp(-sdt / 0.2);
        for (let i = 0; i < level.length; i += 1) {
          const tv = OPACITY[target[i]];
          level[i] += (tv - level[i]) * (tv > level[i] ? kOn : kOff);
        }
        // A finger on the glass squeezes the liquid crystal: a dark bloom spreading from the press.
        for (const pr of presses) {
          const r = 3 + Math.min(pr.age, 1.2) * 8;
          const strength = pr.hold ? 0.5 : 0.5 * Math.max(0, 1 - (pr.age - 0.2) / 2);
          if (strength <= 0) continue;
          for (let y = Math.max(0, Math.floor(pr.y - r)); y < Math.min(ROWS, Math.ceil(pr.y + r)); y += 1) {
            for (let x = Math.max(0, Math.floor(pr.x - r)); x < Math.min(COLS, Math.ceil(pr.x + r)); x += 1) {
              const d = Math.hypot(x - pr.x, y - pr.y) / r;
              if (d < 1) level[y * COLS + x] = Math.min(1, level[y * COLS + x] + strength * (1 - d * d) * sdt * 8);
            }
          }
        }
      },
      draw(g) {
        g.drawImage(board.cv, 0, 0, W, H);
        // Passive-matrix crosstalk: lines with much ink shade the rest of their row and column a little.
        rowInk.fill(0);
        colInk.fill(0);
        for (let y = 0; y < ROWS; y += 1) for (let x = 0; x < COLS; x += 1) {
          const v = level[y * COLS + x];
          rowInk[y] += v / COLS;
          colInk[x] += v / ROWS;
        }
        const contrast = clamp(c.params.intensity, 0.3, 2);
        for (let y = 0; y < ROWS; y += 1) {
          for (let x = 0; x < COLS; x += 1) {
            const i = y * COLS + x;
            const a = clamp((level[i] + (rowInk[y] + colInk[x]) * 0.05) * contrast, 0, 1);
            img.data[i * 4] = ir;
            img.data[i * 4 + 1] = ig;
            img.data[i * 4 + 2] = ib;
            img.data[i * 4 + 3] = Math.round(a * 255);
          }
        }
        sg.putImageData(img, 0, 0);
        g.imageSmoothingEnabled = false;
        // Each pixel's shadow on the reflector behind the liquid crystal, then the pixel itself.
        g.globalAlpha = backlit ? 0.12 : 0.28;
        g.drawImage(small, act.x0 + pitch * 0.32, act.y0 + pitch * 0.38, actW, actH);
        g.globalAlpha = 1;
        g.drawImage(small, act.x0, act.y0, actW, actH);
        g.imageSmoothingEnabled = true;
        g.drawImage(grid.cv, 0, 0, W, H);
        if (backlit) {
          // The backlight glows through the panel and spills round its edge.
          g.globalCompositeOperation = 'lighter';
          const bl = g.createRadialGradient(act.x0 + actW / 2, act.y0 + actH / 2, 0, act.x0 + actW / 2, act.y0 + actH / 2, actW * 0.75);
          bl.addColorStop(0, rgba(glowCol, 0.16));
          bl.addColorStop(1, rgba(glowCol, 0));
          g.fillStyle = bl;
          g.fillRect(act.x0 - actW * 0.3, act.y0 - actH * 0.5, actW * 1.6, actH * 2);
          g.globalCompositeOperation = 'source-over';
        }
        // The window in front: shadow of its edge on the panel, its scratches, and the room reflected in it.
        g.drawImage(windowLayer.cv, 0, 0, W, H);
        g.save();
        g.beginPath();
        g.roundRect(win.x0, win.y0, win.x1 - win.x0, win.y1 - win.y0, 4 * u);
        g.clip();
        const ww = win.x1 - win.x0;
        const bx = win.x0 + ww * (0.35 - reflectX * 0.25);
        const band = g.createLinearGradient(bx - ww * 0.25, win.y0, bx + ww * 0.25, win.y1);
        band.addColorStop(0, 'rgba(255,255,255,0)');
        band.addColorStop(0.45, 'rgba(255,255,255,0.1)');
        band.addColorStop(0.5, 'rgba(255,255,255,0.16)');
        band.addColorStop(0.56, 'rgba(255,255,255,0.08)');
        band.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = band;
        g.fillRect(win.x0, win.y0, ww, win.y1 - win.y0);
        // A window of the room, small and bright, near the top corner.
        const rx = win.x0 + ww * (0.78 - reflectX * 0.12);
        const ry = win.y0 + (win.y1 - win.y0) * 0.16;
        const rr = g.createRadialGradient(rx, ry, 0, rx, ry, 16 * u);
        rr.addColorStop(0, 'rgba(255,255,255,0.22)');
        rr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rr;
        g.fillRect(rx - 16 * u, ry - 16 * u, 32 * u, 32 * u);
        const top = g.createLinearGradient(0, win.y0, 0, win.y0 + 10 * u);
        top.addColorStop(0, 'rgba(255,255,255,0.18)');
        top.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = top;
        g.fillRect(win.x0, win.y0, ww, 10 * u);
        g.restore();
      },
    };
  },
};
