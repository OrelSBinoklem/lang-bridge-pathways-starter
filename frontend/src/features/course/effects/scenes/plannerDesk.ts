import type { CanvasSceneDef } from './types';
import { TAU, clamp, mixHex, rgba } from './kit';

/**
 * "My planner": a wooden desk seen from above in window light — an open weekly planner, sticky notes, a cup of
 * coffee with latte art and steam curling off it, a small succulent. The planner's two days are written in Latvian;
 * a pen goes from task to task and ticks them off with a quick stroke of blue ink, and when both days are done the
 * page turns to the next two. Take the pen: it follows the cursor, a click ticks (or unticks) the task under it,
 * and pointing at a task shows what it means in Russian. The steam bends away from the cursor.
 */

const HAND = '"Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", cursive';
const DAYS = ['Pirmdiena', 'Otrdiena', 'Trešdiena', 'Ceturtdiena', 'Piektdiena', 'Sestdiena', 'Svētdiena'];
const TASKS: [string, string][] = [
  ['nopirkt maizi', 'купить хлеб'],
  ['piezvanīt mammai', 'позвонить маме'],
  ['latviešu valoda', 'латышский язык'],
  ['sporta zāle', 'спортзал'],
  ['izmazgāt veļu', 'постирать бельё'],
  ['uzrakstīt vēstuli', 'написать письмо'],
  ['izlasīt grāmatu', 'прочитать книгу'],
  ['aiziet uz pastu', 'сходить на почту'],
  ['pastaiga parkā', 'прогулка в парке'],
  ['uzkopt māju', 'убрать дома'],
  ['samaksāt rēķinus', 'оплатить счета'],
  ['pagatavot vakariņas', 'приготовить ужин'],
  ['satikt draugus', 'встретиться с друзьями'],
  ['ārsts plkst. 10:00', 'врач в 10:00'],
  ['aplaistīt puķes', 'полить цветы'],
  ['mājasdarbs', 'домашнее задание'],
];
const NOTES: { text: string[]; col: string }[] = [
  { text: ['Rīt 9:00', 'ārsts!'], col: '#ffe066' },
  { text: ['piens', 'olas', 'maize'], col: '#ff9ec7' },
  { text: ['12.05 —', 'dzimšanas', 'diena'], col: '#9ed8ff' },
];

type Task = { lv: string; ru: string; done: number; want: boolean };
type Page = { day: string; tasks: Task[] };

export const PLANNER_DESK: CanvasSceneDef = {
  kind: 'canvas',
  id: 'planner',
  label: 'Ежедневник на столе',
  palettes: [
    ['#9a6a42', '#fff4dc', '#1f4fa8', '#c8342c'],
    ['#4a3020', '#ffc27a', '#2a5ac8', '#d8443a'],
  ],
  create(c) {
    const W = c.width;
    const H = c.height;
    const S = c.dpr;
    const rand = c.rand;
    const [woodCol, lightCol, inkCol, ribbonCol] = c.palette;
    const night = woodCol === '#4a3020';
    const u = c.body ? clamp(Math.min(W, H) / 300, 1, 3) : clamp(H / 170, 0.7, 2.2);
    // Layout: the planner in the middle-right, notes and the cup to its right (the card's title is on the left).
    const nb = c.body
      ? { x0: W * 0.5 - 240 * u, x1: W * 0.5 + 240 * u, y0: H * 0.5 - 150 * u, y1: H * 0.5 + 150 * u }
      : { x0: W * 0.35, x1: W * 0.77, y0: H * 0.06, y1: H * 0.94 };
    const spine = (nb.x0 + nb.x1) / 2;
    const pageW = spine - nb.x0 - 5 * u;
    const pageH = nb.y1 - nb.y0 - 8 * u;
    const mug = c.body ? { x: nb.x1 + 110 * u, y: nb.y0 + 90 * u, r: 44 * u } : { x: W * 0.925, y: H * 0.56, r: Math.min(H * 0.2, W * 0.05) };
    const notes = NOTES.slice(0, c.body ? 3 : 2).map((n, i) => {
      const size = c.body ? 90 * u : Math.min(H * 0.36, W * 0.085);
      const pos = c.body
        ? [{ x: nb.x0 - 80 * u, y: nb.y0 + 60 * u }, { x: nb.x1 + 70 * u, y: nb.y1 - 70 * u }, { x: nb.x0 - 60 * u, y: nb.y1 - 60 * u }][i]
        : [{ x: W * 0.815, y: H * 0.26 }, { x: W * 0.83, y: H * 0.76 }, { x: W * 0.3, y: H * 0.72 }][i];
      return { ...n, ...pos, size, rot: (rand() - 0.5) * 0.22, lift: 0 };
    });

    // The desk, painted once: planks with grain, the window's light and the shadow of its frame.
    const desk = document.createElement('canvas');
    desk.width = Math.ceil(W * S);
    desk.height = Math.ceil(H * S);
    {
      const g = desk.getContext('2d')!;
      g.scale(S, S);
      g.fillStyle = woodCol;
      g.fillRect(0, 0, W, H);
      const plank = 46 * u;
      for (let y = 0, n = 0; y < H; y += plank, n += 1) {
        g.fillStyle = rgba(n % 2 ? '#ffffff' : '#000000', 0.035);
        g.fillRect(0, y, W, plank);
        for (let k = 0; k < 14; k += 1) {
          const yy = y + rand() * plank;
          const amp = 1 + rand() * 3;
          const f = 0.004 + rand() * 0.01;
          const ph = rand() * TAU;
          g.strokeStyle = rgba(rand() < 0.5 ? '#3a2010' : '#c89060', 0.08 + rand() * 0.1);
          g.lineWidth = 0.6 + rand() * 1.2;
          g.beginPath();
          for (let x = 0; x <= W; x += 8) {
            const yv = yy + Math.sin(x * f + ph) * amp;
            if (x === 0) g.moveTo(x, yv);
            else g.lineTo(x, yv);
          }
          g.stroke();
        }
        g.fillStyle = 'rgba(30,15,5,0.35)';
        g.fillRect(0, y + plank - 1.2, W, 1.2);
      }
      if (night) {
        const lamp = g.createRadialGradient(W * 0.6, H * 0.2, 0, W * 0.6, H * 0.2, Math.max(W, H) * 0.7);
        lamp.addColorStop(0, rgba(lightCol, 0.35));
        lamp.addColorStop(0.5, rgba(lightCol, 0.08));
        lamp.addColorStop(1, 'rgba(0,0,0,0.45)');
        g.fillStyle = lamp;
        g.fillRect(0, 0, W, H);
      } else {
        const sun = g.createLinearGradient(0, 0, W, H);
        sun.addColorStop(0, rgba(lightCol, 0.35));
        sun.addColorStop(0.6, rgba(lightCol, 0.05));
        sun.addColorStop(1, 'rgba(0,0,0,0.15)');
        g.fillStyle = sun;
        g.fillRect(0, 0, W, H);
        // The window frame's shadow lies across the desk.
        g.save();
        g.translate(W * 0.55, 0);
        g.rotate(-0.5);
        g.fillStyle = 'rgba(40,20,5,0.1)';
        g.fillRect(-10 * u, -H, 16 * u, H * 4);
        g.fillRect(W * 0.28, -H, 16 * u, H * 4);
        g.restore();
      }
    }

    const pick = (n: number) => {
      const pool = TASKS.slice().sort(() => rand() - 0.5);
      return pool.slice(0, n).map(([lv, ru]) => ({ lv, ru, done: 0, want: false }));
    };
    let dayAt = Math.floor(rand() * 7);
    const makePage = (): Page => {
      const p = { day: DAYS[dayAt % 7], tasks: pick(4) };
      dayAt += 1;
      return p;
    };
    let left = makePage();
    let right = makePage();
    let nextLeft: Page | null = null;
    let nextRight: Page | null = null;
    let flip = -1;
    let clock = 0;
    const pen = { x: nb.x1 + 20 * u, y: nb.y1 - 10 * u, tx: 0, ty: 0, busy: 0, target: null as null | { page: Page; k: number } };
    let wait = 1.2;
    const steam = Array.from({ length: 5 }, (_, i) => ({ ph: rand() * TAU, off: i / 5, bend: 0 }));
    let hoverTask: { task: Task; x: number; y: number } | null = null;

    const header = Math.max(13, pageH * 0.13);
    const lineH = (pageH - header * 1.6) / 4.3;
    const box = Math.min(lineH * 0.46, 13 * u);
    const pageX = (side: 0 | 1) => (side === 0 ? nb.x0 + 4 * u : spine + 1 * u);
    const taskAt = (side: 0 | 1, k: number) => ({ x: pageX(side) + pageW * 0.1, y: nb.y0 + 4 * u + header * 1.5 + lineH * (k + 0.5) });
    // The tick: a short stroke down into the box and a long one up past its corner.
    const tick = (x: number, y: number): [number, number][] => [
      [x + box * 0.15, y + box * 0.05],
      [x + box * 0.45, y + box * 0.42],
      [x + box * 1.25, y - box * 0.75],
    ];
    const tickLen = (() => {
      const t = tick(0, 0);
      return Math.hypot(t[1][0] - t[0][0], t[1][1] - t[0][1]) + Math.hypot(t[2][0] - t[1][0], t[2][1] - t[1][1]);
    })();
    const along = (pts: [number, number][], f: number): [number, number] => {
      let d = f * tickLen;
      for (let q = 0; q < pts.length - 1; q += 1) {
        const l = Math.hypot(pts[q + 1][0] - pts[q][0], pts[q + 1][1] - pts[q][1]);
        if (d <= l) return [pts[q][0] + ((pts[q + 1][0] - pts[q][0]) * d) / l, pts[q][1] + ((pts[q + 1][1] - pts[q][1]) * d) / l];
        d -= l;
      }
      return pts[pts.length - 1];
    };

    const drawPage = (g: CanvasRenderingContext2D, page: Page, side: 0 | 1) => {
      const x0 = pageX(side);
      const y0 = nb.y0 + 4 * u;
      const paper = g.createLinearGradient(side === 0 ? x0 + pageW : x0, 0, side === 0 ? x0 : x0 + pageW, 0);
      paper.addColorStop(0, night ? '#d8ccb4' : '#ece4d2');
      paper.addColorStop(0.12, night ? '#efe4cc' : '#fbf7ee');
      paper.addColorStop(1, night ? '#e8dcc2' : '#f6f0e2');
      g.fillStyle = paper;
      g.fillRect(x0, y0, pageW, pageH);
      g.strokeStyle = 'rgba(90,140,200,0.22)';
      g.lineWidth = 0.8;
      for (let k = 0; k < 5; k += 1) {
        const y = y0 + header * 1.5 + lineH * (k + 0.95);
        if (y > y0 + pageH - 4) break;
        g.beginPath();
        g.moveTo(x0 + 4 * u, y);
        g.lineTo(x0 + pageW - 4 * u, y);
        g.stroke();
      }
      g.fillStyle = rgba(inkCol, 0.9);
      g.font = `600 ${Math.round(header)}px ${HAND}`;
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      g.fillText(page.day, x0 + pageW * 0.08, y0 + header * 0.8, pageW * 0.84);
      g.strokeStyle = rgba(ribbonCol, 0.55);
      g.lineWidth = 1.2 * u;
      g.beginPath();
      g.moveTo(x0 + pageW * 0.08, y0 + header * 1.3);
      g.lineTo(x0 + pageW * 0.08 + Math.min(pageW * 0.8, g.measureText(page.day).width), y0 + header * 1.3);
      g.stroke();
      g.font = `${Math.round(lineH * 0.46)}px ${HAND}`;
      page.tasks.forEach((t, k) => {
        const { x, y } = taskAt(side, k);
        g.strokeStyle = 'rgba(40,40,60,0.7)';
        g.lineWidth = 1;
        g.strokeRect(x, y - box / 2, box, box);
        g.fillStyle = t.done > 0.99 ? 'rgba(40,40,60,0.45)' : 'rgba(30,30,50,0.9)';
        g.fillText(t.lv, x + box * 1.7, y, pageW * 0.74);
        if (t.done > 0) {
          const pts = tick(x, y - box / 2 + box * 0.5);
          g.strokeStyle = rgba(inkCol, 0.95);
          g.lineWidth = 1.8 * u;
          g.lineCap = 'round';
          g.lineJoin = 'round';
          g.beginPath();
          g.moveTo(pts[0][0], pts[0][1]);
          let d = t.done * tickLen;
          for (let q = 0; q < 2 && d > 0; q += 1) {
            const l = Math.hypot(pts[q + 1][0] - pts[q][0], pts[q + 1][1] - pts[q][1]);
            const f = Math.min(1, d / l);
            g.lineTo(pts[q][0] + (pts[q + 1][0] - pts[q][0]) * f, pts[q][1] + (pts[q + 1][1] - pts[q][1]) * f);
            d -= l;
          }
          g.stroke();
        }
      });
      // The shade of the spine.
      const sh = g.createLinearGradient(spine, 0, side === 0 ? spine - pageW * 0.18 : spine + pageW * 0.18, 0);
      sh.addColorStop(0, 'rgba(60,40,20,0.28)');
      sh.addColorStop(1, 'rgba(60,40,20,0)');
      g.fillStyle = sh;
      g.fillRect(side === 0 ? spine - pageW * 0.18 : spine, y0, pageW * 0.18, pageH);
    };

    const allDone = () => [...left.tasks, ...right.tasks].every((t) => t.done >= 1);
    const nextTarget = () => {
      for (const [page, side] of [[left, 0], [right, 1]] as const) {
        const k = page.tasks.findIndex((t) => !t.want);
        if (k >= 0) return { page, k, side };
      }
      return null;
    };

    return {
      update(dt, _t, p) {
        const sdt = Math.min(dt, 0.05) * clamp(c.params.speed, 0.2, 3);
        clock += sdt;
        for (const t of [...left.tasks, ...right.tasks]) {
          if (t.want && t.done < 1) t.done = Math.min(1, t.done + sdt / 0.35);
          if (!t.want && t.done > 0) t.done = Math.max(0, t.done - sdt / 0.2);
        }
        hoverTask = null;
        if (p.active && c.params.react > 0) {
          // You hold the pen.
          pen.x += (p.x - pen.x) * Math.min(1, sdt * 18);
          pen.y += (p.y - pen.y) * Math.min(1, sdt * 18);
          for (const [page, side] of [[left, 0], [right, 1]] as const) {
            page.tasks.forEach((t, k) => {
              const { x, y } = taskAt(side, k);
              if (p.x > x - box && p.x < x + pageW * 0.85 && Math.abs(p.y - y) < lineH * 0.5) {
                hoverTask = { task: t, x: p.x, y: y - lineH * 0.55 };
                if (p.clicked) t.want = !t.want;
              }
            });
          }
          wait = 1.5;
        } else if (flip < 0) {
          // On its own: go to the next open task, tick it, and turn the page when both days are done.
          if (pen.target) {
            const { x, y } = taskAt(pen.target.page === left ? 0 : 1, pen.target.k);
            const t = pen.target.page.tasks[pen.target.k];
            if (!t.want) {
              pen.x += (x + box * 0.2 - pen.x) * Math.min(1, sdt * 5);
              pen.y += (y - pen.y) * Math.min(1, sdt * 5);
              if (Math.hypot(pen.x - x - box * 0.2, pen.y - y) < 2 * u) t.want = true;
            } else {
              const [tx, ty] = along(tick(x, y), t.done);
              pen.x = tx;
              pen.y = ty;
              if (t.done >= 1) {
                pen.target = null;
                wait = 0.5 + rand() * 0.6;
              }
            }
          } else if ((wait -= sdt) <= 0) {
            const nt = nextTarget();
            if (nt) pen.target = { page: nt.page, k: nt.k };
            else if (allDone()) {
              flip = 0;
              nextLeft = makePage();
              nextRight = makePage();
            }
          }
        }
        if (flip >= 0) {
          flip += sdt / 1.1;
          if (flip >= 1) {
            left = nextLeft!;
            right = nextRight!;
            flip = -1;
            wait = 0.8;
          }
        }
        for (const s of steam) {
          const near = p.active ? clamp(1 - Math.hypot(p.x - mug.x, p.y - mug.y) / (mug.r * 4), 0, 1) * Math.sign(mug.x - p.x) : 0;
          s.bend += (near * 1.5 - s.bend) * Math.min(1, sdt * 3);
        }
        for (const n of notes) {
          const over = p.active && Math.abs(p.x - n.x) < n.size * 0.55 && Math.abs(p.y - n.y) < n.size * 0.55;
          n.lift += ((over ? 1 : 0) - n.lift) * Math.min(1, sdt * 8);
        }
      },
      draw(g) {
        g.drawImage(desk, 0, 0, W, H);
        // The planner: its leather cover, pages, the ribbon and the elastic.
        g.save();
        g.shadowColor = 'rgba(20,10,0,0.45)';
        g.shadowBlur = 12 * u;
        g.shadowOffsetX = 4 * u;
        g.shadowOffsetY = 6 * u;
        g.fillStyle = '#5a2e22';
        g.beginPath();
        g.roundRect(nb.x0 - 3 * u, nb.y0, nb.x1 - nb.x0 + 6 * u, nb.y1 - nb.y0, 6 * u);
        g.fill();
        g.restore();
        const flipping = flip >= 0;
        const f = flipping ? flip * flip * (3 - 2 * flip) : 0;
        drawPage(g, flipping && f >= 0.5 ? nextLeft! : left, 0);
        drawPage(g, flipping ? nextRight! : right, 1);
        if (flipping) {
          // The turning page: the old right page narrowing onto the spine, then the new left page opening out.
          const sx = f < 0.5 ? 1 - f * 2 : f * 2 - 1;
          g.save();
          g.translate(spine, 0);
          g.scale(Math.max(sx, 0.001), 1);
          g.translate(-spine, 0);
          drawPage(g, f < 0.5 ? right : nextLeft!, f < 0.5 ? 1 : 0);
          g.fillStyle = `rgba(40,25,10,${0.25 * (1 - sx)})`;
          g.fillRect(f < 0.5 ? spine : spine - pageW - 4 * u, nb.y0, pageW + 4 * u, pageH + 8 * u);
          g.restore();
        }
        g.fillStyle = ribbonCol;
        g.beginPath();
        // The bookmark ribbon comes out from between the pages at the bottom.
        g.moveTo(spine - 2 * u, nb.y1 - 22 * u);
        g.lineTo(spine + 2 * u, nb.y1 - 22 * u);
        g.lineTo(spine + 5 * u + Math.sin(clock * 0.8) * u, nb.y1 + 14 * u);
        g.lineTo(spine + 2 * u + Math.sin(clock * 0.8) * u, nb.y1 + 10 * u);
        g.lineTo(spine - 1 * u + Math.sin(clock * 0.8) * u, nb.y1 + 14 * u);
        g.fill();
        g.fillStyle = '#2a1a14';
        g.fillRect(nb.x1 - 12 * u, nb.y0, 4 * u, nb.y1 - nb.y0);

        // Sticky notes: a slight curl at the bottom corner, lifting when pointed at.
        for (const n of notes) {
          g.save();
          g.translate(n.x, n.y - n.lift * 2 * u);
          g.rotate(n.rot + n.lift * 0.04);
          const s = n.size;
          g.shadowColor = 'rgba(20,10,0,0.35)';
          g.shadowBlur = (4 + n.lift * 6) * u;
          g.shadowOffsetX = (2 + n.lift * 2) * u;
          g.shadowOffsetY = (3 + n.lift * 4) * u;
          g.fillStyle = n.col;
          g.beginPath();
          g.moveTo(-s / 2, -s / 2);
          g.lineTo(s / 2, -s / 2);
          g.lineTo(s / 2, s / 2 - s * 0.12);
          g.quadraticCurveTo(s / 2 - s * 0.04, s / 2 - s * 0.02, s / 2 - s * 0.14, s / 2);
          g.lineTo(-s / 2, s / 2);
          g.closePath();
          g.fill();
          g.shadowColor = 'transparent';
          const curl = g.createLinearGradient(s / 2 - s * 0.2, s / 2 - s * 0.2, s / 2, s / 2);
          curl.addColorStop(0, rgba(n.col, 0));
          curl.addColorStop(1, rgba(mixHex(n.col, '#000000', 0.25), 0.8));
          g.fillStyle = curl;
          g.fillRect(s / 2 - s * 0.25, s / 2 - s * 0.25, s * 0.25, s * 0.25);
          g.fillStyle = rgba(mixHex(n.col, '#ffffff', 0.4), 0.6);
          g.fillRect(-s / 2, -s / 2, s, s * 0.14);
          g.fillStyle = 'rgba(30,30,50,0.85)';
          g.font = `${Math.round(s * 0.17)}px ${HAND}`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          n.text.forEach((line, k) => g.fillText(line, 0, -s * 0.16 + (k - (n.text.length - 1) / 2) * s * 0.22 + s * 0.12, s * 0.9));
          g.restore();
        }

        // The coffee: a white cup with a saucer, latte art, and steam.
        g.save();
        g.shadowColor = 'rgba(20,10,0,0.4)';
        g.shadowBlur = 10 * u;
        g.shadowOffsetX = 5 * u;
        g.shadowOffsetY = 6 * u;
        g.fillStyle = '#f2efe8';
        g.beginPath();
        g.arc(mug.x, mug.y, mug.r * 1.35, 0, TAU);
        g.fill();
        g.restore();
        g.strokeStyle = 'rgba(0,0,0,0.08)';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(mug.x, mug.y, mug.r * 1.12, 0, TAU);
        g.stroke();
        g.fillStyle = '#e8e2d8';
        g.beginPath();
        g.ellipse(mug.x + mug.r * 1.05, mug.y + mug.r * 0.25, mug.r * 0.42, mug.r * 0.2, 0.35, 0, TAU);
        g.fill();
        const cup = g.createRadialGradient(mug.x - mug.r * 0.3, mug.y - mug.r * 0.3, 0, mug.x, mug.y, mug.r);
        cup.addColorStop(0, '#ffffff');
        cup.addColorStop(1, '#dcd6cc');
        g.fillStyle = cup;
        g.beginPath();
        g.arc(mug.x, mug.y, mug.r, 0, TAU);
        g.fill();
        const coffee = g.createRadialGradient(mug.x, mug.y, 0, mug.x, mug.y, mug.r * 0.82);
        coffee.addColorStop(0, '#b07a48');
        coffee.addColorStop(0.8, '#7a4a26');
        coffee.addColorStop(1, '#4a2a14');
        g.fillStyle = coffee;
        g.beginPath();
        g.arc(mug.x, mug.y, mug.r * 0.82, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(250,240,225,0.9)';
        g.save();
        g.translate(mug.x, mug.y + mug.r * 0.08);
        g.scale(mug.r / 40, mug.r / 40);
        g.beginPath();
        g.moveTo(0, 16);
        g.bezierCurveTo(-26, -2, -16, -24, 0, -10);
        g.bezierCurveTo(16, -24, 26, -2, 0, 16);
        g.fill();
        g.restore();
        g.globalCompositeOperation = 'lighter';
        for (const s of steam) {
          const age = (clock * 0.22 + s.off) % 1;
          const a = Math.sin(age * Math.PI) * 0.1;
          g.strokeStyle = `rgba(255,255,255,${a})`;
          g.lineWidth = mug.r * (0.25 + age * 0.4);
          g.lineCap = 'round';
          g.beginPath();
          for (let k = 0; k <= 12; k += 1) {
            const q = k / 12;
            const y = mug.y - mug.r * 0.2 - q * mug.r * 2.4 * (0.4 + age);
            const x = mug.x + Math.sin(q * 5 + clock * 1.3 + s.ph) * mug.r * 0.35 * q + s.bend * q * q * mug.r * 1.6 - q * mug.r * 0.4;
            if (k === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          g.stroke();
        }
        g.globalCompositeOperation = 'source-over';

        // The pen, seen from above: its shadow first, the tip at the pen's point.
        // Held in a right hand: the pen leans back towards the lower right.
        const ang = 2.35;
        const len = 95 * u;
        for (const shadow of [true, false]) {
          g.save();
          g.translate(pen.x + (shadow ? 7 * u : 0), pen.y + (shadow ? 9 * u : 0));
          g.rotate(ang);
          if (shadow) {
            g.fillStyle = 'rgba(20,10,0,0.28)';
            g.beginPath();
            g.roundRect(-3.5 * u, -len, 7 * u, len - 4 * u, 3 * u);
            g.fill();
          } else {
            const body = g.createLinearGradient(-4 * u, 0, 4 * u, 0);
            body.addColorStop(0, '#0e1a3a');
            body.addColorStop(0.45, '#3a5aa8');
            body.addColorStop(1, '#0a1230');
            g.fillStyle = body;
            g.beginPath();
            g.roundRect(-3.5 * u, -len, 7 * u, len - 14 * u, 3 * u);
            g.fill();
            g.fillStyle = '#c8ccd4';
            g.beginPath();
            g.moveTo(-3.5 * u, -14 * u);
            g.lineTo(3.5 * u, -14 * u);
            g.lineTo(0.6 * u, 0);
            g.lineTo(-0.6 * u, 0);
            g.fill();
            g.fillStyle = '#d8dce4';
            g.fillRect(-1 * u, -len + 6 * u, 2 * u, 30 * u);
          }
          g.restore();
        }

        if (hoverTask) {
          const { task, x, y } = hoverTask;
          const fs = Math.round(clamp(lineH * 0.42, 10, 18));
          g.font = `${fs}px "Segoe UI", system-ui, sans-serif`;
          const tw = g.measureText(task.ru).width + fs;
          const bx = clamp(x - tw / 2, 2, W - tw - 2);
          g.fillStyle = 'rgba(20,24,40,0.9)';
          g.beginPath();
          g.roundRect(bx, y - fs * 1.6, tw, fs * 1.5, fs * 0.4);
          g.fill();
          g.fillStyle = '#ffffff';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(task.ru, bx + tw / 2, y - fs * 0.85);
        }
      },
    };
  },
};
