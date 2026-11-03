import { ROM, PROGRAMS, ROM_NOTES, hex2 } from './rom';
import type { Machine } from './logic';

/**
 * The side panel of the PROM board: the dump of the PROM with the cell being read, the counters as registers, the
 * address and data buses, the switches and the generator's rate, the view and render toggles. Drawn with Canvas 2D;
 * returns the clickable regions.
 */

export type PanelUi = {
  paused: boolean;
  glow: boolean;
  traced: 'off' | 'baked' | 'live';
  tree: boolean;
  treeUp: boolean;
  star: 'red' | 'white';
  status: string;
  hover: string | null;
  /** The list of the 16 programs is open. */
  progMenu: boolean;
};

export type Region = { id: string; x: number; y: number; w: number; h: number; value?: number };

const LAMP_COLORS = ['#ff4a2a', '#ffc23a', '#4ade6a', '#4a8aff', '#ff4a2a', '#ffc23a', '#4ade6a', '#4a8aff'];

export function drawPanel(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, m: Machine, ui: PanelUi): Region[] {
  const regions: Region[] = [];
  const pad = 14;
  g.save();
  g.fillStyle = 'rgba(10,13,16,0.94)';
  g.fillRect(x0, y0, w, h);
  g.strokeStyle = 'rgba(140,255,220,0.18)';
  g.beginPath();
  g.moveTo(x0 + 0.5, y0);
  g.lineTo(x0 + 0.5, y0 + h);
  g.stroke();
  let y = y0 + pad;
  const x = x0 + pad;
  const iw = w - pad * 2;
  const mono = (size: number, weight = '') => `${weight} ${size}px ui-monospace, Consolas, monospace`;
  const text = (s: string, tx: number, ty: number, size: number, color: string, align: CanvasTextAlign = 'left', weight = '') => {
    g.font = mono(size, weight);
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.fillText(s, tx, ty);
  };
  const button = (id: string, label: string, bx: number, by: number, bw: number, bh: number, on = false, value?: number) => {
    const hov = ui.hover === id + (value ?? '');
    g.fillStyle = on ? 'rgba(255,214,120,0.22)' : hov ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)';
    g.strokeStyle = on ? 'rgba(255,214,120,0.85)' : 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.roundRect(bx, by, bw, bh, 6);
    g.fill();
    g.stroke();
    text(label, bx + bw / 2, by + bh / 2 + 1, Math.min(13, bh * 0.5), on ? '#ffe2a0' : '#dfe8e4', 'center');
    regions.push({ id, x: bx, y: by, w: bw, h: bh, value });
  };

  text('АВТОМАТ СВЕТОВЫХ ЭФФЕКТОВ НА ППЗУ', x, y + 6, 13, '#bfffe8', 'left', 'bold');
  y += 18;
  text('Радиохобби 6/98 · В. Василенко · рис. 1, 3', x, y + 6, 11, 'rgba(190,220,210,0.6)');
  y += 24;

  // Address and data.
  const a = m.address;
  text(`A ${hex2(a)}`, x, y + 10, 20, '#ffe2a0', 'left', 'bold');
  text(`Q ${hex2(m.data)}`, x + 104, y + 10, 20, '#8fffe0', 'left', 'bold');
  text(ui.status, x + iw, y + 10, 11, 'rgba(190,220,210,0.7)', 'right');
  y += 24;
  text(`программа ${m.program.toString(16).toUpperCase()} · шаг ${m.step.toString(16).toUpperCase()} · повтор ${m.repeat + 1}/16`, x, y + 6, 11, 'rgba(190,220,210,0.75)');
  y += 16;
  // Program choice: previous / the list / next (DD3.2 set by hand, SB3 then holds it).
  button('progPrev', '◀', x, y, 28, 26);
  button('progMenu', `▾ ${m.program.toString(16).toUpperCase()} — ${PROGRAMS[m.program]}`, x + 32, y, iw - 64, 26, ui.progMenu);
  button('progNext', '▶', x + iw - 28, y, 28, 26);
  const menuY = y + 28;
  y += 32;

  // The dump.
  const cell = Math.floor((iw - 26) / 16);
  const gx = x + 26;
  text('КР556РТ5 · рис. 3', x, y + 6, 11, 'rgba(190,220,210,0.6)');
  y += 16;
  for (let c = 0; c < 16; c += 1) text(c.toString(16).toUpperCase(), gx + c * cell + cell / 2, y + 6, 10, c === m.step ? '#ffe2a0' : 'rgba(150,220,200,0.55)', 'center');
  y += 13;
  // Rows shrink to fit the panel's height: everything else takes about 520 px.
  const rowH = Math.max(9, Math.min(cell * 0.72, (h - 562) / 16));
  const fs = Math.max(8, Math.min(12, rowH * 0.8, cell * 0.46));
  for (let r = 0; r < 16; r += 1) {
    const ry = y + r * rowH;
    const rh = rowH;
    const rowOn = r === m.program;
    text(`${r.toString(16).toUpperCase()}0`, x, ry + rh / 2, 10, rowOn ? '#ffe2a0' : ui.hover === `prog${r}` ? '#ffffff' : 'rgba(150,220,200,0.55)');
    // A row's label picks that program.
    if (!ui.progMenu) regions.push({ id: 'prog', x, y: ry, w: 24, h: rh, value: r });
    if (rowOn) {
      g.fillStyle = 'rgba(255,214,120,0.1)';
      g.fillRect(gx, ry, cell * 16, rh);
    }
    for (let c = 0; c < 16; c += 1) {
      const ad = r * 16 + c;
      const cx = gx + c * cell;
      const cur = ad === a;
      const hov = ui.hover === `cell${ad}`;
      if (cur) {
        g.fillStyle = 'rgba(255,210,110,0.95)';
        g.fillRect(cx + 1, ry + 1, cell - 2, rh - 2);
      } else if (hov) {
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(cx + 1, ry + 1, cell - 2, rh - 2);
      }
      text(hex2(ROM[ad]), cx + cell / 2, ry + rh / 2 + 1, fs, cur ? '#1b1206' : rowOn ? '#fff0cc' : 'rgba(170,240,220,0.62)', 'center', cur ? 'bold' : '');
      if (ROM_NOTES[ad]) {
        g.fillStyle = '#ff6a50';
        g.beginPath();
        g.arc(cx + cell - 3, ry + 3, 2, 0, Math.PI * 2);
        g.fill();
      }
      if (!ui.progMenu) regions.push({ id: 'cell', x: cx, y: ry, w: cell, h: rh, value: ad });
    }
  }
  y += 16 * rowH + 8;
  if (ui.hover?.startsWith('cell')) {
    const ad = Number(ui.hover.slice(4));
    const bits = ROM[ad].toString(2).padStart(8, '0');
    const note = ROM_NOTES[ad] ? ` · ${ROM_NOTES[ad]}` : '';
    text(`${hex2(ad)}: ${hex2(ROM[ad])} = ${bits}${note}`, x, y + 6, 10, 'rgba(255,226,160,0.85)');
  } else text('ноль в бите — лампа горит · клик по ячейке — перейти, по 00…F0 — программа', x, y + 6, 10, 'rgba(190,220,210,0.5)');
  y += 20;

  // Registers.
  const reg = (label: string, value: number, names: string[], rx: number, rw: number) => {
    text(label, rx, y + 6, 10, 'rgba(190,220,210,0.7)');
    const bw = (rw - 6) / 4;
    for (let b = 0; b < 4; b += 1) {
      const on = (value >> (3 - b)) & 1;
      g.fillStyle = on ? 'rgba(255,210,110,0.9)' : 'rgba(255,255,255,0.06)';
      g.fillRect(rx + b * bw, y + 16, bw - 4, 22);
      text(String(on), rx + b * bw + (bw - 4) / 2, y + 28, 12, on ? '#1b1206' : 'rgba(190,220,210,0.6)', 'center', 'bold');
      text(names[b], rx + b * bw + (bw - 4) / 2, y + 48, 9, 'rgba(190,220,210,0.5)', 'center');
    }
  };
  const rw = (iw - 16) / 3;
  reg('DD3.1 шаг', m.step, ['A3', 'A2', 'A1', 'A0'], x, rw);
  reg('DD4.1 повтор', m.repeat, ['Q4', 'Q3', 'Q2', 'Q1'], x + rw + 8, rw);
  reg('DD3.2 программа', m.program, ['A7', 'A6', 'A5', 'A4'], x + (rw + 8) * 2, rw);
  y += 60;

  // Data bus and lamps.
  text('Q8 … Q1 → VT10 … VT3 → HL, VS', x, y + 6, 10, 'rgba(190,220,210,0.7)');
  y += 16;
  const lw = iw / 8;
  for (let k = 7; k >= 0; k -= 1) {
    const col = 7 - k;
    const bit = (m.data >> k) & 1;
    const lit = m.lit(k);
    text(String(bit), x + col * lw + lw / 2, y + 8, 13, bit ? 'rgba(190,220,210,0.55)' : '#ffe2a0', 'center', 'bold');
    g.fillStyle = lit ? LAMP_COLORS[k] : 'rgba(255,255,255,0.08)';
    g.shadowColor = lit ? LAMP_COLORS[k] : 'transparent';
    g.shadowBlur = lit ? 10 : 0;
    g.beginPath();
    g.arc(x + col * lw + lw / 2, y + 30, 7, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    text(`HL${k + 1}`, x + col * lw + lw / 2, y + 46, 9, 'rgba(190,220,210,0.5)', 'center');
  }
  y += 58;

  // Switches.
  const sw = m.sw;
  const sws: [string, string, boolean][] = [
    ['SB1', sw.sb1 === 0 ? '÷32' : '÷256', sw.sb1 === 1],
    ['SB2', sw.sb2 === 'gen' ? 'генер.' : 'вход', sw.sb2 === 'input'],
    ['SB3', sw.sb3 === 1 ? 'авто' : 'стоп', sw.sb3 === 2],
    ['SB4', sw.sb4 === 1 ? '×16' : 'сразу', sw.sb4 === 2],
    ['SB5', sw.sb5 ? 'сеть' : 'выкл', !sw.sb5],
  ];
  const sbw = (iw - 16) / 5;
  sws.forEach(([id, label, on], i) => {
    text(id, x + i * (sbw + 4) + sbw / 2, y + 6, 10, 'rgba(190,220,210,0.6)', 'center');
    button(id, label, x + i * (sbw + 4), y + 14, sbw, 26, on);
  });
  y += 50;

  // Generator rate (R4).
  text(`R4 — частота генератора: ${m.genHz.toFixed(1)} Гц`, x, y + 6, 11, 'rgba(190,220,210,0.75)');
  y += 16;
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(x, y + 6, iw, 6);
  g.fillStyle = 'rgba(255,210,110,0.8)';
  g.fillRect(x, y + 6, iw * m.rate, 6);
  g.beginPath();
  g.arc(x + iw * m.rate, y + 9, 8, 0, Math.PI * 2);
  g.fill();
  regions.push({ id: 'rate', x, y: y - 4, w: iw, h: 26 });
  y += 28;

  // Transport and render toggles.
  const bw4 = (iw - 12) / 4;
  button('pause', ui.paused ? '▶ Пуск' : '⏸ Пауза', x, y, bw4, 26, ui.paused);
  button('step', '⏭ Шаг', x + bw4 + 4, y, bw4, 26);
  button('reset', '↺ Сброс', x + (bw4 + 4) * 2, y, bw4, 26);
  button('glow', 'Ток', x + (bw4 + 4) * 3, y, bw4, 26, ui.glow);
  y += 32;
  button('traced', ui.traced === 'live' ? 'Трассировка: живая' : ui.traced === 'baked' ? 'Трассировка: запечённая' : 'Трассировка: выкл', x, y, iw, 26, ui.traced !== 'off');
  y += 32;
  // The tree beside the board: on/off, which way its sections run, the star's colour.
  const bw3 = (iw - 8) / 3;
  button('tree', ui.tree ? 'Ёлка: есть' : 'Ёлка: нет', x, y, bw3, 26, ui.tree);
  button('treeDir', ui.treeUp ? 'Q1 внизу ↑' : 'Q1 наверху ↓', x + bw3 + 4, y, bw3, 26);
  button('star', ui.star === 'red' ? 'Звезда красная' : 'Звезда белая', x + (bw3 + 4) * 2, y, bw3, 26, ui.star === 'red');
  y += 32;
  const views = [['v0', 'Общий'], ['v1', 'ППЗУ'], ['v2', 'LED'], ['v3', 'Питание'], ['v4', 'Ёлка'], ['zin', '+'], ['zout', '−']];
  const vw = (iw - 24) / 7;
  views.forEach(([id, label], i) => button(id, label, x + i * (vw + 4), y, vw, 24));
  y += 30;
  if (y < y0 + h - 18) text('Светодиод: SonnySee, CC BY 3.0 · тяните плату — повернуть', x, y0 + h - 12, 9, 'rgba(190,220,210,0.4)');
  if (ui.progMenu) {
    // The list over everything below the selector; its items take the clicks first.
    const ih = Math.max(16, Math.min(24, (y0 + h - menuY - 8) / 16));
    g.fillStyle = 'rgba(14,18,22,0.98)';
    g.strokeStyle = 'rgba(255,214,120,0.5)';
    g.beginPath();
    g.roundRect(x, menuY, iw, ih * 16 + 8, 8);
    g.fill();
    g.stroke();
    const items: Region[] = [];
    for (let p = 0; p < 16; p += 1) {
      const iy = menuY + 4 + p * ih;
      const on = p === m.program;
      if (on || ui.hover === `prog${p}`) {
        g.fillStyle = on ? 'rgba(255,214,120,0.18)' : 'rgba(255,255,255,0.08)';
        g.fillRect(x + 4, iy, iw - 8, ih);
      }
      text(`${p.toString(16).toUpperCase()}0 — ${PROGRAMS[p]}`, x + 12, iy + ih / 2, Math.min(13, ih * 0.6), on ? '#ffe2a0' : '#dfe8e4');
      if (on) text('✓', x + iw - 14, iy + ih / 2, 13, '#ffe2a0', 'right');
      items.push({ id: 'prog', x: x + 4, y: iy, w: iw - 8, h: ih, value: p });
    }
    regions.unshift(...items);
  }
  g.restore();
  return regions;
}
