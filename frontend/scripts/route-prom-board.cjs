#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- a standalone Node script */
/**
 * Routes the copper of the PROM light-effects board (src/features/course/effects/promBoard/layout.ts) and writes
 * promBoard/routes.json; with --png also a picture of the result (.tmp/prom-board/routes.png) to look at.
 *
 *   node scripts/route-prom-board.cjs [--png]
 *
 * A grid router: 0.5 mm cells, two layers (0 top, 1 bottom), A* over (cell, layer, direction) with a penalty for
 * bends, for the bottom layer (the top is the one you see, and the current is drawn on it) and for vias. A net grows
 * as a tree from its first pin (Prim order: always the pin nearest to what is already routed), so the arc length
 * along the copper measured from that pin is also the direction the current flows — saved with every segment.
 * Clearance: a cell is free for a trace of half-width h if nothing of another net lies within h + CLEAR.
 * GND is not routed — the pour on both layers is added when the board is drawn.
 */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require(path.resolve(__dirname, '../node_modules/typescript'));
Module._extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: 1, target: 7 } }).outputText, f);
const L = require(path.resolve(__dirname, '../src/features/course/effects/promBoard/layout.ts'));

const G = 0.5;
const CLEAR = 0.3;
const EDGE = 1.5;
const W = Math.round(L.BOARD.w / G) + 1;
const H = Math.round(L.BOARD.h / G) + 1;
const N = W * H;
const VIA_R = 0.55;
const COST_BOTTOM = 1.6;
const COST_BEND = 0.9;
const COST_VIA = 7;

const nets = L.NETS.map((n, i) => ({ ...n, index: i }));
const pinNet = new Map();
for (const n of nets) for (const p of n.pins) pinNet.set(p, n.index);

// owner per layer: -1 free, -2 keepout, >= 0 net index.
const owner = [new Int16Array(N).fill(-1), new Int16Array(N).fill(-1)];
const idx = (x, y) => y * W + x;
const cellOf = (mm) => Math.round(mm / G);

// Board edge and mounting holes.
const HOLES = [[4, 4], [L.BOARD.w - 4, 4], [4, L.BOARD.h - 4], [L.BOARD.w - 4, L.BOARD.h - 4]];
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const mx = x * G, my = y * G;
    const edge = mx < EDGE || my < EDGE || mx > L.BOARD.w - EDGE || my > L.BOARD.h - EDGE;
    const hole = HOLES.some(([hx, hy]) => Math.hypot(mx - hx, my - hy) < 3.2);
    if (edge || hole) owner[0][idx(x, y)] = owner[1][idx(x, y)] = -2;
  }
}

// Pads: every pin of every part, on both layers.
const PAD = (part, pin) => {
  const k = part.pkg.kind;
  if (k === 'triac' && pin === 'MT2') return 2.6;
  if (k === 'xfmrPower' || k === 'terminal' || k === 'bridge' || (k === 'radial' && part.pkg.d > 12)) return 1.3;
  if (k === 'dip') return 0.8;
  return 0.9;
};
const pads = [];
for (const part of L.PARTS) {
  for (const pin of Object.keys(L.packagePins(part.pkg))) {
    const [x, y] = L.pinAt(part, pin);
    const key = `${part.ref}.${pin}`;
    const net = pinNet.has(key) ? pinNet.get(key) : -3;
    pads.push({ key, x, y, r: PAD(part, pin), net });
  }
}
const disk = (rmm) => {
  const r = Math.ceil(rmm / G);
  const out = [];
  for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) if (Math.hypot(dx, dy) * G <= rmm + 1e-9) out.push([dx, dy]);
  return out;
};
const stamp = (layer, cx, cy, rmm, value) => {
  for (const [dx, dy] of disk(rmm)) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = idx(x, y);
    if (owner[layer][i] === -1 || owner[layer][i] === value) owner[layer][i] = value;
  }
};
for (const p of pads) for (const layer of [0, 1]) stamp(layer, cellOf(p.x), cellOf(p.y), p.r, p.net === -3 ? -4 : p.net);

// Free test for a net's trace (half-width h) at a cell: no foreign copper within h + CLEAR.
const diskCache = new Map();
const clearDisk = (h) => {
  const key = h.toFixed(3);
  if (!diskCache.has(key)) diskCache.set(key, disk(h + CLEAR));
  return diskCache.get(key);
};
const free = (layer, x, y, net, d) => {
  const own = owner[layer];
  for (const [dx, dy] of d) {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) return false;
    const o = own[idx(xx, yy)];
    if (o !== -1 && o !== net) return false;
  }
  return true;
};

// --- A* ------------------------------------------------------------------------------------------------------------
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const S = N * 2 * 9;
const gCost = new Float32Array(S);
const came = new Int32Array(S);
const stamp2 = new Uint32Array(S);
let epoch = 1;
const heap = { k: new Float32Array(1 << 22), v: new Int32Array(1 << 22), n: 0 };
const push = (key, v) => {
  let i = heap.n++;
  if (heap.n >= heap.k.length) throw new Error('heap full');
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heap.k[p] <= key) break;
    heap.k[i] = heap.k[p]; heap.v[i] = heap.v[p]; i = p;
  }
  heap.k[i] = key; heap.v[i] = v;
};
const pop = () => {
  const v = heap.v[0];
  const last = --heap.n;
  const k = heap.k[last], lv = heap.v[last];
  let i = 0;
  for (;;) {
    let c = 2 * i + 1;
    if (c >= last) break;
    if (c + 1 < last && heap.k[c + 1] < heap.k[c]) c += 1;
    if (heap.k[c] >= k) break;
    heap.k[i] = heap.k[c]; heap.v[i] = heap.v[c]; i = c;
  }
  heap.k[i] = k; heap.v[i] = lv;
  return v;
};
const stateOf = (cell, layer, dir) => (cell * 2 + layer) * 9 + dir;

/** Route from the net's copper (sources: cells with their arc length) to the target pad; returns cells or null. */
function route(net, sources, target, h) {
  epoch += 1;
  heap.n = 0;
  const d = clearDisk(h);
  const dv = disk(VIA_R + CLEAR);
  const tx = cellOf(target.x), ty = cellOf(target.y);
  const tr = Math.max(1, Math.floor((target.r - 0.1) / G));
  const hx = (x, y) => {
    const ax = Math.abs(x - tx), ay = Math.abs(y - ty);
    return Math.max(ax, ay) + (Math.SQRT2 - 1) * Math.min(ax, ay);
  };
  for (const s of sources) {
    const st = stateOf(s.cell, s.layer, 8);
    stamp2[st] = epoch;
    gCost[st] = 0;
    came[st] = -1;
    push(hx(s.cell % W, (s.cell / W) | 0), st);
  }
  let found = -1;
  let guard = 0;
  while (heap.n) {
    const st = pop();
    if (++guard > 4e6) break;
    const dir = st % 9;
    const rest = (st - dir) / 9;
    const layer = rest % 2;
    const cell = (rest - layer) / 2;
    const x = cell % W, y = (cell / W) | 0;
    if (Math.abs(x - tx) <= tr && Math.abs(y - ty) <= tr && Math.hypot(x - tx, y - ty) <= tr) {
      found = st;
      break;
    }
    const g0 = gCost[st];
    const layerMul = layer === 1 ? COST_BOTTOM : 1;
    for (let k = 0; k < 8; k += 1) {
      const nx = x + DIRS[k][0], ny = y + DIRS[k][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (!free(layer, nx, ny, net, d)) continue;
      const step = (k & 1 ? Math.SQRT2 : 1) * layerMul;
      const bend = dir === 8 || dir === k ? 0 : (Math.abs(((k - dir + 12) % 8) - 4) === 3 ? COST_BEND : COST_BEND * 2.5);
      const ns = stateOf(idx(nx, ny), layer, k);
      const ng = g0 + step + bend;
      if (stamp2[ns] === epoch && gCost[ns] <= ng) continue;
      stamp2[ns] = epoch;
      gCost[ns] = ng;
      came[ns] = st;
      push(ng + hx(nx, ny), ns);
    }
    // A via to the other layer.
    const other = 1 - layer;
    if (free(other, x, y, net, dv) && free(layer, x, y, net, dv)) {
      const ns = stateOf(cell, other, 8);
      const ng = g0 + COST_VIA;
      if (!(stamp2[ns] === epoch && gCost[ns] <= ng)) {
        stamp2[ns] = epoch;
        gCost[ns] = ng;
        came[ns] = st;
        push(ng + hx(x, y), ns);
      }
    }
  }
  if (found < 0) return null;
  const cells = [];
  for (let st = found; st >= 0; st = came[st]) {
    const dir = st % 9;
    const rest = (st - dir) / 9;
    const layer = rest % 2;
    const cell = (rest - layer) / 2;
    cells.push({ cell, layer });
  }
  return cells.reverse();
}

// --- routing all nets -------------------------------------------------------------------------------------------
const out = { grid: G, board: L.BOARD, nets: [], failed: [] };
const order = nets
  .filter((n) => !n.pour)
  .map((n) => {
    const pts = n.pins.map((p) => pads.find((q) => q.key === p));
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    return { n, span: Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys) };
  })
  .sort((a, b) => (b.n.width >= 1.2) - (a.n.width >= 1.2) || (b.n.name === 'VCC') - (a.n.name === 'VCC') || a.span - b.span)
  .map((o) => o.n);

const t0 = Date.now();
for (const n of order) {
  const h = n.width / 2;
  const pins = n.pins.map((p) => pads.find((q) => q.key === p));
  const arc = new Map();
  const copper = [];
  const addCopper = (cell, layer, s) => {
    const key = cell * 2 + layer;
    if (!arc.has(key)) {
      arc.set(key, s);
      copper.push({ cell, layer, s });
    }
  };
  const first = pins[0];
  for (const layer of [0, 1]) addCopper(idx(cellOf(first.x), cellOf(first.y)), layer, 0);
  const done = new Set([0]);
  const segs = [];
  const vias = [];
  while (done.size < pins.length) {
    // Prim: the pin nearest to the copper so far.
    let best = -1;
    let bestD = Infinity;
    for (let k = 0; k < pins.length; k += 1) {
      if (done.has(k)) continue;
      for (const c of copper) {
        const dd = Math.hypot((c.cell % W) * G - pins[k].x, ((c.cell / W) | 0) * G - pins[k].y);
        if (dd < bestD) {
          bestD = dd;
          best = k;
        }
      }
    }
    done.add(best);
    const target = pins[best];
    const cells = route(n.index, copper, target, h);
    if (!cells) {
      out.failed.push(`${n.name}: ${pins[0].key} … ${target.key}`);
      continue;
    }
    // Arc length along the new branch, from where it leaves the copper.
    let s = arc.get(cells[0].cell * 2 + cells[0].layer) ?? 0;
    const pts = [];
    let layer = cells[0].layer;
    let run = { layer, s0: s, pts: [] };
    for (let k = 0; k < cells.length; k += 1) {
      const c = cells[k];
      const x = (c.cell % W) * G, y = ((c.cell / W) | 0) * G;
      if (k > 0) {
        const p = cells[k - 1];
        if (p.cell === c.cell && p.layer !== c.layer) {
          vias.push([x, y]);
          if (run.pts.length >= 4) segs.push(run);
          run = { layer: c.layer, s0: s, pts: [x, y] };
          addCopper(c.cell, c.layer, s);
          continue;
        }
        s += Math.hypot(x - (p.cell % W) * G, y - ((p.cell / W) | 0) * G);
      }
      run.pts.push(x, y);
      addCopper(c.cell, c.layer, s);
      pts.push(x, y);
    }
    if (run.pts.length >= 4) segs.push(run);
    // Mark the copper for the nets still to come.
    for (const c of cells) stamp(c.layer, c.cell % W, (c.cell / W) | 0, h, n.index);
    for (const [vx, vy] of vias) for (const l of [0, 1]) stamp(l, cellOf(vx), cellOf(vy), VIA_R, n.index);
    void layer;
  }
  // Simplify each run: keep only the corners.
  const simple = segs.map((r) => {
    const p = r.pts;
    const keep = [p[0], p[1]];
    for (let k = 2; k < p.length - 2; k += 2) {
      const ax = p[k] - p[k - 2], ay = p[k + 1] - p[k - 1];
      const bx = p[k + 2] - p[k], by = p[k + 3] - p[k + 1];
      if (Math.abs(ax * by - ay * bx) > 1e-9) keep.push(p[k], p[k + 1]);
    }
    keep.push(p[p.length - 2], p[p.length - 1]);
    return { layer: r.layer, s0: Math.round(r.s0 * 100) / 100, pts: keep.map((v) => Math.round(v * 100) / 100) };
  });
  out.nets.push({ name: n.name, width: n.width, segments: simple, vias });
}
out.pads = pads.map((p) => ({ key: p.key, x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, r: p.r, net: p.net >= 0 ? nets[p.net].name : null }));
const file = path.resolve(__dirname, '../src/features/course/effects/promBoard/routes.json');
fs.writeFileSync(file, JSON.stringify(out));
const segCount = out.nets.reduce((s, n) => s + n.segments.length, 0);
const viaCount = out.nets.reduce((s, n) => s + n.vias.length, 0);
const bottom = out.nets.reduce((s, n) => s + n.segments.filter((g) => g.layer === 1).length, 0);
console.log(`routed ${out.nets.length} nets in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${segCount} runs (${bottom} on the bottom), ${viaCount} vias; failed: ${out.failed.length}`);
for (const f of out.failed) console.log('  FAILED', f);

if (process.argv.includes('--png')) {
  const sharp = require(path.resolve(__dirname, '../node_modules/sharp'));
  const S2 = 6;
  const iw = Math.round(L.BOARD.w * S2), ih = Math.round(L.BOARD.h * S2);
  const img = Buffer.alloc(iw * ih * 4);
  for (let i = 0; i < iw * ih; i += 1) {
    img[i * 4] = 18; img[i * 4 + 1] = 70; img[i * 4 + 2] = 40; img[i * 4 + 3] = 255;
  }
  const put = (x, y, c) => {
    const px = Math.round(x * S2), py = ih - 1 - Math.round(y * S2);
    if (px < 0 || py < 0 || px >= iw || py >= ih) return;
    const o = (py * iw + px) * 4;
    img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2];
  };
  const line = (x0, y0, x1, y1, w, c) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(len * S2 * 2));
    for (let k = 0; k <= n; k += 1) {
      const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
      for (let dy = -w / 2; dy <= w / 2; dy += 1 / S2) for (let dx = -w / 2; dx <= w / 2; dx += 1 / S2) if (dx * dx + dy * dy <= (w * w) / 4) put(x + dx, y + dy, c);
    }
  };
  for (const layer of [1, 0]) {
    for (const n of out.nets) {
      for (const s of n.segments.filter((g) => g.layer === layer)) {
        for (let k = 0; k + 3 < s.pts.length; k += 2) line(s.pts[k], s.pts[k + 1], s.pts[k + 2], s.pts[k + 3], n.width, layer ? [70, 110, 200] : [230, 160, 70]);
      }
    }
  }
  for (const p of out.pads) line(p.x, p.y, p.x, p.y, p.r * 2, p.net === 'GND' ? [120, 200, 120] : p.net ? [240, 230, 200] : [140, 140, 140]);
  for (const n of out.nets) for (const [x, y] of n.vias) line(x, y, x, y, 1.1, [255, 255, 255]);
  fs.mkdirSync(path.resolve(__dirname, '../../.tmp/prom-board'), { recursive: true });
  sharp(img, { raw: { width: iw, height: ih, channels: 4 } }).png().toFile(path.resolve(__dirname, '../../.tmp/prom-board/routes.png')).then(() => console.log('png written'));
}
