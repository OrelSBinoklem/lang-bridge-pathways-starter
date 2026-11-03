export const HEIGHT = 3.25;
export const RINGS = 64;
export const VESSEL_PARAMETERS = [
  { key: 'height', ru: 'Высота', uk: 'Висота', min: .65, max: 1.08 },
  { key: 'body', ru: 'Ширина корпуса', uk: 'Ширина корпусу', min: .65, max: 1.4 },
  { key: 'belly', ru: 'Высота брюшка', uk: 'Висота черевця', min: .25, max: .5 },
  { key: 'shoulder', ru: 'Высота плеч', uk: 'Висота плечей', min: .56, max: .76 },
  { key: 'fullness', ru: 'Округлость плеч', uk: 'Округлість плечей', min: .65, max: 1.05 },
  { key: 'neck', ru: 'Ширина горлышка', uk: 'Ширина шийки', min: .28, max: .82 },
  { key: 'neckLength', ru: 'Длина горлышка', uk: 'Довжина шийки', min: .1, max: .3 },
  { key: 'mouth', ru: 'Ширина края', uk: 'Ширина краю', min: .3, max: 1.05 },
  { key: 'foot', ru: 'Основание', uk: 'Основа', min: .4, max: .8 },
  // Added 2026-10-30 (owner: «усовершенствуй генерацию, добавь больше параметров для рандомизации»). Each is neutral
  // at its DEFAULT_VESSEL value, so the default jug keeps its shape; `optional` ones are left out of about half the
  // random jugs, so not every one gets a waist, a collar and throwing rings at once.
  { key: 'footFlare', ru: 'Расширение ножки', uk: 'Розширення ніжки', min: .82, max: 1.15 },
  { key: 'footHeight', ru: 'Высота ножки', uk: 'Висота ніжки', min: .04, max: .16 },
  { key: 'waist', ru: 'Талия', uk: 'Талія', min: 0, max: .3, optional: true },
  { key: 'collar', ru: 'Валик на шейке', uk: 'Валик на шийці', min: 0, max: .08, optional: true },
  { key: 'neckTaper', ru: 'Сужение горлышка', uk: 'Звуження шийки', min: .75, max: 1.3 },
  { key: 'lipLength', ru: 'Длина раструба', uk: 'Довжина розтруба', min: .04, max: .14 },
  { key: 'ribs', ru: 'Гончарные кольца', uk: 'Гончарні кільця', min: 0, max: .015, optional: true },
] as const;
export type VesselParameters = Record<typeof VESSEL_PARAMETERS[number]['key'], number>;
export const DEFAULT_VESSEL: VesselParameters = { height: .95, body: 1.12, belly: .38, shoulder: .66, fullness: .88, neck: .4, neckLength: .2, mouth: .56, foot: .55, footFlare: .93, footHeight: .08, waist: 0, collar: 0, neckTaper: 1, lipLength: .04, ribs: 0 };

export function randomVessel(seed: number): VesselParameters {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const shape = Object.fromEntries(VESSEL_PARAMETERS.map(({ key, min, max }) => [key, min + random() * (max - min)])) as VesselParameters;
  for (const parameter of VESSEL_PARAMETERS) if ('optional' in parameter && random() < .45) shape[parameter.key] = parameter.min;
  return shape;
}

/** Smooth monotone segments keep narrow necks open without spline overshoot. */
export function vesselRadius(t: number, parameters: VesselParameters): number {
  const p = { ...parameters };
  for (const { key, min, max } of VESSEL_PARAMETERS) p[key] = Number.isFinite(p[key]) ? Math.max(min, Math.min(max, p[key])) : DEFAULT_VESSEL[key];
  const lip = 1 - Math.max(p.lipLength, .04);
  const neckStart = Math.min(lip - .03, Math.max(p.shoulder + .07, 1 - p.neckLength));
  const knots = [[0, p.foot], [Math.min(p.footHeight, p.belly - .06), p.foot * p.footFlare], [p.belly, p.body], [p.shoulder, p.body * p.fullness], [neckStart, p.neck], [lip, p.neck * p.neckTaper], [1, p.mouth]];
  const y = Math.max(0, Math.min(1, t));
  let r = p.mouth;
  for (let i = 1; i < knots.length; i++) if (y <= knots[i][0]) {
    const [a, ra] = knots[i - 1], [b, rb] = knots[i];
    const u = (y - a) / (b - a), smooth = u * u * (3 - 2 * u);
    r = ra + (rb - ra) * smooth;
    break;
  }
  // A smooth dip (0 at its ends) centred between the belly and the shoulders, as in a double gourd.
  const bump = (centre: number, half: number) => { const d = Math.abs(y - centre) / half; return d < 1 ? Math.cos(d * Math.PI / 2) ** 2 : 0; };
  r -= p.waist * p.body * bump((p.belly + p.shoulder) / 2, Math.max(.06, (p.shoulder - p.belly) / 2));
  // A rolled collar where the neck begins, and shallow throwing rings over the body (four ridges, none on the foot).
  r += p.collar * bump(neckStart, .055);
  if (y > p.footHeight && y < neckStart) r += p.ribs * p.body * Math.sin((y - p.footHeight) / (neckStart - p.footHeight) * Math.PI * 8) * Math.sin((y - p.footHeight) / (neckStart - p.footHeight) * Math.PI);
  // The neck never closes, whatever the combination.
  return Math.max(.28, r);
}
export const PALETTES = [
  { ru: 'Кобальт', uk: 'Кобальт', colors: ['#f0eee5', '#21489a', '#588dbc', '#d1a85d'] },
  { ru: 'Балтийская', uk: 'Балтійська', colors: ['#cee2d5', '#155950', '#448b7b', '#e9cb83'] },
  { ru: 'Гранат', uk: 'Гранат', colors: ['#f2ddd4', '#872944', '#cb725a', '#caab64'] },
  { ru: 'Графит', uk: 'Графіт', colors: ['#e1dfda', '#30383b', '#737d81', '#b89349'] },
  { ru: 'Солнечная', uk: 'Сонячна', colors: ['#f1de96', '#9e421e', '#d88d36', '#386c77'] },
  { ru: 'Ирис', uk: 'Ірис', colors: ['#d8e2ed', '#51447c', '#9777ac', '#28778a'] },
] as const;

export function initialProfile(): Float32Array {
  return Float32Array.from({ length: RINGS + 1 }, (_, i) => {
    const t = i / RINGS;
    return .74 + .1 * Math.sin(Math.PI * t) + .02 * t;
  });
}

export const PATTERNS = [
  { id: 'mandala', ru: 'Мандалы', uk: 'Мандали' },
  { id: 'ikat', ru: 'Икат', uk: 'Ікат' },
  { id: 'waves', ru: 'Волны', uk: 'Хвилі' },
  { id: 'mosaic', ru: 'Мозаика', uk: 'Мозаїка' },
  { id: 'cosmic', ru: 'Созвездия', uk: 'Сузір’я' },
  { id: 'botanical', ru: 'Ботаника', uk: 'Ботаніка' },
  { id: 'scales', ru: 'Чешуйки', uk: 'Лусочки' },
  { id: 'engraved', ru: 'Гравировка', uk: 'Гравіювання' },
] as const;
export type PatternKind = typeof PATTERNS[number]['id'];
export type PatternOptions = { scale: number; petals: number; rotation: number; stroke: number; border: number };
export const DEFAULT_PATTERN_OPTIONS: PatternOptions = { scale: 1, petals: 8, rotation: 0, stroke: 1, border: 1 };

export function drawPattern(canvas: HTMLCanvasElement, seed: number, palette: number, kind: PatternKind = 'mandala', options: PatternOptions = DEFAULT_PATTERN_OPTIONS) {
  const ctx = canvas.getContext('2d')!;
  const colors = PALETTES[palette].colors;
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const petals = Math.round(Math.max(4, Math.min(20, options.petals)));
  const twist = random() * .8;
  // Keep stroke widths identical in the palette thumbnails and the actual glaze.
  const size = 1024;
  ctx.save(); ctx.scale(canvas.width / size, canvas.height / size);
  const columns = Math.max(2, Math.min(10, Math.round((3 + Math.floor(random() * 4)) / options.scale)));
  const cell = size / columns;
  ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, size, size);
  if (kind === 'waves') {
      const waves = Math.max(1, Math.round(petals / 3)), phase = random() * Math.PI * 2 + options.rotation * Math.PI / 180;
    const bands = Math.round(15 / options.scale);
    for (let band = -2; band < bands + 4; band++) {
      ctx.beginPath();
      for (let x = 0; x <= size; x += 2) {
        const y = band * size / bands + Math.sin(x / size * Math.PI * 2 * waves + phase + band * .3) * size * .025;
        if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = colors[(band + 20) % 4]; ctx.lineWidth = size * .047 * options.stroke; ctx.stroke();
      ctx.strokeStyle = colors[3]; ctx.lineWidth = size * .003 * options.stroke; ctx.stroke();
    }
  } else for (let row = -1; row <= columns; row++) for (let col = -1; col <= columns; col++) {
    ctx.save();
    ctx.translate((col + (row % 2 ? .5 : 0)) * cell, row * cell);
    ctx.rotate(options.rotation * Math.PI / 180 + twist * .2);
    if (kind === 'mandala') {
      for (let layer = 0; layer < 4; layer++) {
        const r = cell * (.46 - layer * .09);
        for (let petal = 0; petal < petals; petal++) {
          ctx.save(); ctx.rotate(petal / petals * Math.PI * 2 + layer * twist);
          ctx.beginPath(); ctx.moveTo(r * .15, 0);
          ctx.bezierCurveTo(r * .5, -r * .7 / (petals / 6), r * .95, -r * .45, r, 0);
          ctx.bezierCurveTo(r * .95, r * .45, r * .5, r * .7 / (petals / 6), r * .15, 0);
          ctx.fillStyle = colors[(layer + 1) % 4]; ctx.fill();
          ctx.strokeStyle = colors[3]; ctx.lineWidth = 1.4 * options.stroke; ctx.stroke();
          ctx.fillStyle = colors[0]; ctx.beginPath(); ctx.arc(r * .75, 0, cell * .009, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      }
    } else if (kind === 'ikat') {
      for (let layer = 0; layer < 5; layer++) {
        const r = cell * (.48 - layer * .085);
        ctx.beginPath();
        for (let edge = 0; edge < 4; edge++) for (let k = 0; k <= 16; k++) {
          const angle = edge * Math.PI / 2, t = k / 16;
          const x = Math.cos(angle) * r * (1 - t) + Math.cos(angle + Math.PI / 2) * r * t;
          const y = Math.sin(angle) * r * (1 - t) + Math.sin(angle + Math.PI / 2) * r * t + Math.sin(k * 2.1 + seed) * cell * .009;
          if (!edge && !k) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fillStyle = colors[(layer + row + 8) % 4]; ctx.fill();
        ctx.strokeStyle = colors[3]; ctx.lineWidth = options.stroke * 1.2; ctx.stroke();
      }
    } else if (kind === 'mosaic') {
      for (let n = 0; n < petals; n++) {
        ctx.save(); ctx.rotate(n * Math.PI * 2 / petals + twist);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(cell * .38, -cell * .12); ctx.lineTo(cell * .48, 0); ctx.lineTo(cell * .38, cell * .12); ctx.closePath();
        ctx.fillStyle = colors[(n + row + 12) % 4]; ctx.fill(); ctx.strokeStyle = colors[0]; ctx.lineWidth = 3 * options.stroke; ctx.stroke(); ctx.restore();
      }
    } else if (kind === 'botanical') {
      ctx.strokeStyle = colors[1]; ctx.lineWidth = cell * .012 * options.stroke;
      ctx.beginPath(); ctx.moveTo(0,cell*.48); ctx.bezierCurveTo(-cell*.12,cell*.1,cell*.17,-cell*.1,0,-cell*.46); ctx.stroke();
      for(let n=0;n<petals;n++){
        const y=cell*(.38-n/(petals-1)*.72),side=n%2?1:-1;
        ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(side*cell*.36,y-cell*.23,side*cell*.4,y+cell*.08,0,y);
        ctx.fillStyle=colors[1+n%3];ctx.fill();ctx.stroke();
      }
    } else if (kind === 'scales') {
      for(let layer=0;layer<5;layer++){
        const r=cell*(.48-layer*.082);
        ctx.beginPath();ctx.arc(0,cell*.35,r,Math.PI,Math.PI*2);ctx.lineTo(r,cell*.35);ctx.closePath();
        ctx.fillStyle=colors[(layer+row+12)%4];ctx.fill();ctx.strokeStyle=colors[3];ctx.lineWidth=cell*.008*options.stroke;ctx.stroke();
        for(let n=1;n<petals;n++){const a=Math.PI+n/petals*Math.PI;ctx.beginPath();ctx.moveTo(0,cell*.35);ctx.lineTo(Math.cos(a)*r,cell*.35+Math.sin(a)*r);ctx.lineWidth=options.stroke;ctx.stroke();}
      }
    } else if (kind === 'engraved') {
      ctx.strokeStyle=colors[1];ctx.lineWidth=cell*.009*options.stroke;
      for(let layer=0;layer<5;layer++){
        const r=cell*(.46-layer*.073);ctx.beginPath();
        for(let n=0;n<=petals*2;n++){const a=n/(petals*2)*Math.PI*2,s=n%2?r*.56:r;ctx.lineTo(Math.cos(a)*s,Math.sin(a)*s);}ctx.closePath();ctx.stroke();
      }
    } else {
      ctx.fillStyle = colors[1]; ctx.fillRect(-cell / 2, -cell / 2, cell, cell);
      for (let n = 0; n < petals + 4; n++) {
        const angle = n * 2.399 + twist, r = cell * .45 * Math.sqrt((n + 1) / (petals + 4));
        const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
        ctx.strokeStyle = colors[2]; ctx.lineWidth = options.stroke;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, y); ctx.stroke();
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
        ctx.fillStyle = colors[n % 2 ? 0 : 3]; ctx.beginPath();
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, s = cell * (k % 2 ? .012 : .035); ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); }
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    ctx.fillStyle = colors[3]; ctx.beginPath(); ctx.arc(0, 0, cell * .075, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  for (const t of options.border > 0 ? [.045, .065, .93, .95] : []) {
    ctx.fillStyle = colors[1]; ctx.fillRect(0, t * size, size, size * .006 * options.border);
    ctx.fillStyle = colors[3]; ctx.fillRect(0, (t + .01) * size, size, size * .003 * options.border);
  }
  ctx.restore();
}

/**
 * The showcase plate's own painting (owner, 2026-10-30: «сложные узоры для тарелки»): a round medallion, not the jug's
 * repeating tile. A rim band, then three to six concentric belts of motifs (petals, drops, leaves, dots, diamonds,
 * scales, stars, a wave, a meander key, a lattice), each belt its own symmetry and colour, and a layered rosette in the
 * middle. The family steers the character (botanical favours leaves and drops, engraved draws thin outlines, cosmic
 * stars and dots, waves wave belts…), the seed the rest; the pattern controls (scale, petals, rotation, stroke, border)
 * apply too. Drawn in plate space: the canvas's centre is the plate's centre, 0.488 of its size the plate's rim.
 */
export function drawPlate(canvas: HTMLCanvasElement, seed: number, palette: number, kind: PatternKind = 'mandala', options: PatternOptions = DEFAULT_PATTERN_OPTIONS) {
  const ctx = canvas.getContext('2d')!;
  const colors = PALETTES[palette].colors;
  let state = (seed ^ 0x9e3779b9) >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const size = 1024, c = size / 2, R = size * 0.488;
  const stroke = options.stroke;
  const base = Math.round(Math.max(4, Math.min(20, options.petals)));
  ctx.save();
  ctx.scale(canvas.width / size, canvas.height / size);
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, size, size);
  ctx.translate(c, c);
  ctx.rotate(options.rotation * Math.PI / 180);
  const pools: Record<PatternKind, string[]> = {
    mandala: ['petal', 'drop', 'dot', 'petal', 'scale'],
    ikat: ['diamond', 'lattice', 'diamond', 'dot'],
    waves: ['wave', 'wave', 'dot', 'scale'],
    mosaic: ['diamond', 'meander', 'lattice', 'dot'],
    cosmic: ['star', 'dot', 'star', 'drop'],
    botanical: ['leaf', 'drop', 'leaf', 'dot', 'petal'],
    scales: ['scale', 'scale', 'dot', 'drop'],
    engraved: ['petal', 'meander', 'diamond', 'lattice'],
  };
  const outline = kind === 'engraved';
  const paint = (fill: string) => {
    if (outline) { ctx.strokeStyle = colors[1]; ctx.lineWidth = 2.2 * stroke; ctx.stroke(); }
    else { ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = colors[3]; ctx.lineWidth = 1.4 * stroke; ctx.stroke(); }
  };
  /** One motif centred on the x axis at radius r, h deep (radially) and w wide (along the belt). */
  const motif = (name: string, r: number, h: number, w: number, fill: string) => {
    ctx.beginPath();
    if (name === 'petal') {
      ctx.moveTo(r - h / 2, 0);
      ctx.bezierCurveTo(r - h / 4, -w / 2, r + h / 3, -w / 2.4, r + h / 2, 0);
      ctx.bezierCurveTo(r + h / 3, w / 2.4, r - h / 4, w / 2, r - h / 2, 0);
    } else if (name === 'drop') {
      ctx.moveTo(r + h / 2, 0);
      ctx.bezierCurveTo(r, -w / 2, r - h / 2, -w / 3, r - h / 2, 0);
      ctx.bezierCurveTo(r - h / 2, w / 3, r, w / 2, r + h / 2, 0);
    } else if (name === 'leaf') {
      ctx.moveTo(r - h / 2, 0);
      ctx.quadraticCurveTo(r, -w * 0.7, r + h / 2, -w * 0.15);
      ctx.quadraticCurveTo(r, w * 0.35, r - h / 2, 0);
    } else if (name === 'diamond') {
      ctx.moveTo(r - h / 2, 0); ctx.lineTo(r, -w / 2); ctx.lineTo(r + h / 2, 0); ctx.lineTo(r, w / 2); ctx.closePath();
    } else if (name === 'scale') {
      ctx.arc(r - h / 2, 0, Math.min(h, w / 2), -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
    } else if (name === 'star') {
      for (let k = 0; k <= 10; k += 1) {
        const a = k * Math.PI / 5, s = (k % 2 ? 0.4 : 1) * Math.min(h, w) / 2;
        ctx.lineTo(r + Math.cos(a) * s, Math.sin(a) * s);
      }
      ctx.closePath();
    } else {
      ctx.arc(r, 0, Math.min(h, w) * 0.28, 0, Math.PI * 2);
    }
    paint(fill);
    if (!outline && (name === 'petal' || name === 'drop' || name === 'leaf')) {
      ctx.beginPath(); ctx.moveTo(r - h * 0.4, 0); ctx.lineTo(r + h * 0.35, 0);
      ctx.strokeStyle = colors[0]; ctx.lineWidth = 1.2 * stroke; ctx.stroke();
    }
  };
  /** A belt between radii r0 and r1: a ring of motifs, or a continuous wave, meander or lattice. */
  const belt = (name: string, r0: number, r1: number, count: number, fill: string, ground: string) => {
    ctx.beginPath(); ctx.arc(0, 0, r1, 0, Math.PI * 2); ctx.arc(0, 0, r0, 0, Math.PI * 2, true);
    ctx.fillStyle = ground; ctx.fill();
    const mid = (r0 + r1) / 2, h = (r1 - r0) * 0.86;
    if (name === 'wave') {
      ctx.beginPath();
      for (let k = 0; k <= 720; k += 1) {
        const a = k / 720 * Math.PI * 2, rr = mid + Math.sin(a * count) * h * 0.32;
        if (!k) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.strokeStyle = fill; ctx.lineWidth = h * 0.22 * stroke; ctx.stroke();
      ctx.strokeStyle = colors[3]; ctx.lineWidth = 1.5 * stroke; ctx.stroke();
    } else if (name === 'meander') {
      // A Greek key: an L-step repeated round the belt.
      ctx.strokeStyle = fill; ctx.lineWidth = Math.max(2, h * 0.09) * stroke; ctx.lineJoin = 'miter';
      for (let k = 0; k < count; k += 1) {
        ctx.save(); ctx.rotate(k / count * Math.PI * 2);
        const w = 2 * Math.PI * mid / count, a = r0 + h * 0.12, b = r1 - h * 0.12;
        ctx.beginPath();
        ctx.moveTo(a, -w / 2); ctx.lineTo(a, w * 0.3); ctx.lineTo(b, w * 0.3); ctx.lineTo(b, -w * 0.2);
        ctx.lineTo(a + (b - a) * 0.35, -w * 0.2); ctx.lineTo(a + (b - a) * 0.35, w * 0.05); ctx.lineTo(a + (b - a) * 0.65, w * 0.05);
        ctx.stroke(); ctx.restore();
      }
    } else if (name === 'lattice') {
      ctx.strokeStyle = fill; ctx.lineWidth = 2 * stroke;
      for (const s of [1, -1]) for (let k = 0; k < count * 2; k += 1) {
        const a0 = k / (count * 2) * Math.PI * 2, a1 = a0 + s * Math.PI / count;
        ctx.beginPath(); ctx.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0); ctx.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1); ctx.stroke();
      }
    } else {
      for (let k = 0; k < count; k += 1) {
        ctx.save(); ctx.rotate((k + 0.5) / count * Math.PI * 2);
        motif(name, mid, h, 2 * Math.PI * mid / count * 0.86, k % 2 && random() < 0.5 ? colors[2] : fill);
        ctx.restore();
      }
    }
    for (const r of [r0, r1]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.strokeStyle = colors[3]; ctx.lineWidth = 2 * stroke; ctx.stroke(); }
  };
  // The rim: a solid band, with a fine row of dots when there is a border.
  const rimW = R * 0.07 * Math.max(0.4, options.border);
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.arc(0, 0, R - rimW, 0, Math.PI * 2, true);
  ctx.fillStyle = colors[1]; ctx.fill();
  if (options.border > 0) for (let k = 0; k < base * 6; k += 1) {
    const a = k / (base * 6) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(Math.cos(a) * (R - rimW / 2), Math.sin(a) * (R - rimW / 2), rimW * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = colors[3]; ctx.fill();
  }
  // Belts from the rim inwards; the scale control makes them fewer and broader, or more and finer.
  const pool = pools[kind] ?? pools.mandala;
  const belts = Math.max(3, Math.min(6, Math.round((3 + random() * 3) / Math.max(0.6, options.scale))));
  const centre = R * (0.2 + random() * 0.08);
  let r1 = R - rimW - 6;
  const step = (r1 - centre) / belts;
  for (let b = 0; b < belts; b += 1) {
    const r0 = r1 - step * (0.8 + random() * 0.35);
    const name = pool[Math.floor(random() * pool.length)];
    const sym = base * (1 + Math.floor(random() * 3)) * (r1 > R * 0.6 ? 2 : 1);
    const fill = colors[1 + ((b + Math.floor(random() * 3)) % 3)];
    // Alternate belts sit on a ground tinted towards the third colour.
    const ground = b % 2 ? colors[0] : mixHex(colors[0], colors[2], 0.18);
    belt(name, Math.max(centre, r0), r1, sym, fill, ground);
    r1 = Math.max(centre, r0) - 4;
  }
  // The rosette: layered petals (stars for the cosmic family), a heart.
  for (let layer = 0; layer < 3; layer += 1) {
    const rr = centre * (1 - layer * 0.28), n = base + layer * 2;
    for (let k = 0; k < n; k += 1) {
      ctx.save(); ctx.rotate((k + layer * 0.5) / n * Math.PI * 2);
      motif(kind === 'cosmic' ? 'star' : 'petal', rr * 0.58, rr * 0.82, rr * 2 * Math.PI / n * 0.9, colors[1 + layer % 3]);
      ctx.restore();
    }
  }
  ctx.beginPath(); ctx.arc(0, 0, centre * 0.2, 0, Math.PI * 2); ctx.fillStyle = colors[3]; ctx.fill();
  ctx.restore();
}

function mixHex(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** A whole new painting at random: family, palette, seed and every pattern control (owner: «не только форму, но и узор»). */
export function randomPainting(seed: number): { kind: PatternKind; palette: number; seed: number; options: PatternOptions } {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  return {
    kind: PATTERNS[Math.floor(random() * PATTERNS.length)].id,
    palette: Math.floor(random() * PALETTES.length),
    seed: Math.floor(random() * 4294967296) >>> 0,
    options: { scale: .7 + Math.floor(random() * 19) * .05, petals: 4 + Math.floor(random() * 9) * 2, rotation: -45 + Math.floor(random() * 19) * 5, stroke: .6 + Math.floor(random() * 10) * .1, border: Math.floor(random() * 15) * .1 },
  };
}
