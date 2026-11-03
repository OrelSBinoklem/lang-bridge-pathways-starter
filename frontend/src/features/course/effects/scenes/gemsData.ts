/**
 * The gems of the "gems" scene: their optics, their cut (a convex polyhedron given by the planes of its facets, made
 * here), what they lie on (a fabric of their own, their mother rock, a metal setting), and a rough price.
 *
 * Units: the girdle's radius is 1 (for a round stone); x, y lie in the table's plane (seen from above), z points up
 * to the viewer, the girdle's top is at z = 0.
 */

export type V3 = [number, number, number];
export type Cut = 'round' | 'oval' | 'cushion' | 'princess' | 'pear' | 'emerald' | 'cabochon';

/** Fabric: 0 velvet, 1 silk, 2 satin. */
export type FabricKind = 0 | 1 | 2;
/** Mother rock: 0 kimberlite, 1 marble, 2 schist, 3 ironstone, 4 pegmatite, 5 geode (druse of crystals), 6 basalt,
 * 7 serpentinite, 8 sandstone, 9 rhyolite, 10 gneiss. */
export type Rock = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
/** Metal: 0 platinum, 1 yellow gold, 2 white gold, 3 rose gold, 4 silver. */
export type Metal = 0 | 1 | 2 | 3 | 4;
/** Opal: 0 not an opal, 1 black, 2 white, 3 boulder (on ironstone), 4 fire. */
export type OpalKind = 0 | 1 | 2 | 3 | 4;

export type Gem = {
  id: string;
  name: string;
  /** Rough price of a fine 1–3 ct stone, US $ per carat (for sorting and the label only). */
  price: number;
  note: string;
  cut: Cut;
  /** Length to width (oval, cushion, pear, emerald cut, cabochon). */
  aspect: number;
  ior: number;
  /** Dispersion (B–G interval of the refractive index). */
  dispersion: number;
  /** Absorption per girdle radius of path, R G B (the body colour); absorbWarm: under a warm lamp (colour change). */
  absorb: V3;
  absorbWarm?: V3;
  opal: OpalKind;
  /** Inclusions: silk (fine needles, a soft sheen), jardin (an emerald's "garden"); red fluorescence under the lamp. */
  silk: number;
  jardin: number;
  fluor: number;
  fabric: { color: string; kind: FabricKind };
  rock: Rock;
  metal: Metal;
};

const GEM_LIST: Gem[] = [
  {
    id: 'red-diamond', name: 'Красный бриллиант', price: 1_000_000, note: 'самый редкий цвет алмаза',
    cut: 'round', aspect: 1, ior: 2.417, dispersion: 0.044, absorb: [0.08, 1.1, 0.75], opal: 0, silk: 0, jardin: 0, fluor: 0,
    fabric: { color: '#eee6d8', kind: 2 }, rock: 0, metal: 0,
  },
  {
    id: 'blue-diamond', name: 'Голубой бриллиант', price: 400_000, note: 'как «Надежда»: бор в решётке',
    cut: 'cushion', aspect: 1.06, ior: 2.417, dispersion: 0.044, absorb: [0.9, 0.35, 0.06], opal: 0, silk: 0, jardin: 0, fluor: 0,
    fabric: { color: '#0b0b0f', kind: 0 }, rock: 0, metal: 0,
  },
  {
    id: 'ruby', name: 'Рубин «голубиная кровь»', price: 100_000, note: 'Мьянма, светится красным под лампой',
    cut: 'oval', aspect: 1.3, ior: 1.77, dispersion: 0.018, absorb: [0.03, 1.6, 1.1], opal: 0, silk: 0.25, jardin: 0, fluor: 0.55,
    fabric: { color: '#e8dfcc', kind: 1 }, rock: 1, metal: 1,
  },
  {
    id: 'alexandrite', name: 'Александрит', price: 50_000, note: 'днём зелёный, под тёплой лампой красный',
    cut: 'cushion', aspect: 1.1, ior: 1.75, dispersion: 0.015, absorb: [1.2, 0.25, 0.55], absorbWarm: [0.12, 1.1, 0.5], opal: 0, silk: 0, jardin: 0, fluor: 0,
    fabric: { color: '#101a33', kind: 0 }, rock: 2, metal: 0,
  },
  {
    id: 'emerald', name: 'Изумруд (Колумбия)', price: 30_000, note: 'с «садом» включений',
    cut: 'emerald', aspect: 1.38, ior: 1.58, dispersion: 0.014, absorb: [1.3, 0.12, 0.85], opal: 0, silk: 0, jardin: 0.6, fluor: 0,
    fabric: { color: '#cbb48a', kind: 2 }, rock: 2, metal: 1,
  },
  {
    id: 'sapphire', name: 'Сапфир (Кашмир)', price: 30_000, note: 'бархатный от тонкого шёлка',
    cut: 'oval', aspect: 1.25, ior: 1.77, dispersion: 0.018, absorb: [1.5, 0.75, 0.06], opal: 0, silk: 0.55, jardin: 0, fluor: 0,
    fabric: { color: '#9aa0a8', kind: 1 }, rock: 6, metal: 2,
  },
  {
    id: 'diamond', name: 'Бриллиант', price: 20_000, note: 'бесцветный, самый сильный огонь',
    cut: 'round', aspect: 1, ior: 2.417, dispersion: 0.044, absorb: [0.008, 0.008, 0.012], opal: 0, silk: 0, jardin: 0, fluor: 0,
    fabric: { color: '#0a0a0c', kind: 0 }, rock: 0, metal: 0,
  },
  {
    id: 'paraiba', name: 'Турмалин Параиба', price: 20_000, note: 'неоновый от меди',
    cut: 'pear', aspect: 1.35, ior: 1.62, dispersion: 0.017, absorb: [1.9, 0.07, 0.05], opal: 0, silk: 0, jardin: 0, fluor: 0,
    fabric: { color: '#e9ecef', kind: 2 }, rock: 4, metal: 2,
  },
  {
    id: 'black-opal', name: 'Чёрный опал', price: 15_000, note: 'Лайтнинг-Ридж, игра цвета на тёмном',
    cut: 'cabochon', aspect: 1.3, ior: 1.45, dispersion: 0, absorb: [0, 0, 0], opal: 1, silk: 0, jardin: 0, fluor: 0,
    fabric: { color: '#0a0a0d', kind: 0 }, rock: 8, metal: 1,
  },
  {
    id: 'spinel', name: 'Красная шпинель', price: 8_000, note: 'долго принимали за рубин',
    cut: 'cushion', aspect: 1, ior: 1.72, dispersion: 0.02, absorb: [0.05, 1.3, 0.7], opal: 0, silk: 0, jardin: 0, fluor: 0.35,
    fabric: { color: '#5d5a5f', kind: 0 }, rock: 1, metal: 3,
  },
  {
    id: 'demantoid', name: 'Демантоид', price: 6_000, note: 'гранат с огнём сильнее алмаза',
    cut: 'round', aspect: 1, ior: 1.88, dispersion: 0.057, absorb: [0.75, 0.08, 1.4], opal: 0, silk: 0.2, jardin: 0, fluor: 0,
    fabric: { color: '#3a0d16', kind: 0 }, rock: 7, metal: 1,
  },
  {
    id: 'boulder-opal', name: 'Болдер-опал', price: 1_500, note: 'опал прожилками в железняке',
    cut: 'cabochon', aspect: 1.45, ior: 1.45, dispersion: 0, absorb: [0, 0, 0], opal: 3, silk: 0, jardin: 0, fluor: 0,
    fabric: { color: '#3b2a20', kind: 0 }, rock: 3, metal: 4,
  },
  {
    id: 'tanzanite', name: 'Танзанит', price: 1_000, note: 'фиолетово-синий, только из Танзании',
    cut: 'cushion', aspect: 1.15, ior: 1.69, dispersion: 0.019, absorb: [0.55, 1.1, 0.07], opal: 0, silk: 0, jardin: 0, fluor: 0,
    fabric: { color: '#b8923f', kind: 2 }, rock: 10, metal: 2,
  },
  {
    id: 'aquamarine', name: 'Аквамарин', price: 1_000, note: 'цвет морской воды',
    cut: 'emerald', aspect: 1.3, ior: 1.58, dispersion: 0.014, absorb: [0.32, 0.08, 0.04], opal: 0, silk: 0, jardin: 0, fluor: 0,
    fabric: { color: '#dfe3e6', kind: 1 }, rock: 4, metal: 0,
  },
  {
    id: 'fire-opal', name: 'Огненный опал', price: 500, note: 'Мексика, прозрачный оранжевый',
    cut: 'cabochon', aspect: 1.2, ior: 1.44, dispersion: 0, absorb: [0.05, 0.55, 1.6], opal: 4, silk: 0, jardin: 0, fluor: 0,
    fabric: { color: '#0f2a1c', kind: 0 }, rock: 9, metal: 3,
  },
  {
    id: 'white-opal', name: 'Белый опал', price: 300, note: 'Кубер-Педи, пастельная игра',
    cut: 'cabochon', aspect: 1.25, ior: 1.45, dispersion: 0, absorb: [0, 0, 0], opal: 2, silk: 0, jardin: 0, fluor: 0,
    fabric: { color: '#0d1530', kind: 0 }, rock: 8, metal: 4,
  },
  {
    id: 'peridot', name: 'Хризолит (перидот)', price: 300, note: 'из вулканических пород',
    cut: 'oval', aspect: 1.3, ior: 1.67, dispersion: 0.02, absorb: [0.45, 0.05, 1.0], opal: 0, silk: 0, jardin: 0, fluor: 0,
    fabric: { color: '#a89878', kind: 1 }, rock: 6, metal: 1,
  },
  {
    id: 'amethyst', name: 'Аметист (Сибирь)', price: 80, note: 'густой фиолетовый',
    cut: 'round', aspect: 1, ior: 1.544, dispersion: 0.013, absorb: [0.25, 0.95, 0.15], opal: 0, silk: 0, jardin: 0, fluor: 0,
    fabric: { color: '#b9a6c9', kind: 1 }, rock: 5, metal: 4,
  },
  {
    id: 'citrine', name: 'Цитрин', price: 40, note: 'золотистый кварц',
    cut: 'cushion', aspect: 1.05, ior: 1.544, dispersion: 0.013, absorb: [0.04, 0.3, 1.3], opal: 0, silk: 0, jardin: 0, fluor: 0,
    fabric: { color: '#2a1a10', kind: 0 }, rock: 5, metal: 1,
  },
  {
    id: 'blue-topaz', name: 'Голубой топаз', price: 30, note: '«лондон» и «швейцарский»',
    cut: 'princess', aspect: 1, ior: 1.62, dispersion: 0.014, absorb: [0.9, 0.2, 0.05], opal: 0, silk: 0, jardin: 0, fluor: 0,
    fabric: { color: '#b8bec6', kind: 2 }, rock: 4, metal: 4,
  },
  {
    id: 'rock-crystal', name: 'Горный хрусталь', price: 5, note: 'чистый кварц',
    cut: 'round', aspect: 1, ior: 1.544, dispersion: 0.013, absorb: [0.004, 0.004, 0.005], opal: 0, silk: 0, jardin: 0, fluor: 0,
    fabric: { color: '#0a0a0c', kind: 0 }, rock: 5, metal: 4,
  },
];

/** The gems, dearest first. */
export const GEMS: readonly Gem[] = [...GEM_LIST].sort((a, b) => b.price - a.price);

export const BACKINGS = ['Ткань', 'Порода', 'Оправа'] as const;
export const ROCK_NAMES = ['кимберлит', 'мрамор', 'сланец', 'железняк', 'пегматит', 'жеода', 'базальт', 'серпентинит', 'песчаник', 'риолит', 'гнейс'];
export const METAL_COLORS: V3[] = [[0.82, 0.83, 0.85], [1.0, 0.76, 0.33], [0.86, 0.87, 0.88], [0.96, 0.62, 0.5], [0.95, 0.94, 0.92]];

/** "$1 000 000" */
export function priceLabel(p: number) {
  return `$${String(p).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}

// --- cuts -------------------------------------------------------------------------------------------------------
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
/** A point inside every stone (the middle of the girdle). */
const INSIDE: V3 = [0, 0, -0.015];

/** The plane through a, b, c, facing away from the inside: n·p ≤ d inside. */
function plane(a: V3, b: V3, c: V3): number[] {
  let n = norm(cross(sub(b, a), sub(c, a)));
  let d = dot(n, a);
  if (dot(n, INSIDE) > d) {
    n = mul(n, -1);
    d = -d;
  }
  return [...n, d];
}

/** The girdle's radius round the stone (the outline seen from above) for a cut. */
export function outline(cut: Cut, aspect: number): (phi: number) => number {
  const k = 1 / aspect;
  switch (cut) {
    case 'oval':
    case 'cabochon':
      return (f) => 1 / Math.hypot(Math.cos(f), Math.sin(f) / k);
    case 'cushion':
      return (f) => 0.97 * Math.pow(Math.abs(Math.cos(f)) ** 4 + Math.abs(Math.sin(f) / k) ** 4, -1 / 4);
    case 'princess':
      return (f) => 0.82 * Math.pow(Math.abs(Math.cos(f)) ** 10 + Math.abs(Math.sin(f)) ** 10, -1 / 10);
    case 'pear':
      // Round at one end, drawn to a point at the other (along +x).
      return (f) => 0.82 * (1 + 0.3 * Math.cos(f)) / Math.hypot(Math.cos(f) * 0.92, Math.sin(f) / (k * 1.08)) * (1 - 0.12 * Math.cos(2 * f) * (Math.cos(f) > 0 ? 1 : 0));
    default:
      return () => 1;
  }
}

/**
 * A modified brilliant over an outline R(φ): table (56 %), 8 stars, 8 bezels, 16 upper girdle facets (crown angle
 * 34.5°), a girdle of 32 flats, 8 pavilion mains to a culet (pavilion angle 40.75°), 16 lower girdle facets (77 %).
 * 89 planes.
 */
function brilliant(R: (phi: number) => number): number[] {
  const rt = 0.56, rs = 0.78, gt = 0.03;
  const hc = (1 - rt) * Math.tan((34.5 * Math.PI) / 180);
  const hp = Math.tan((40.75 * Math.PI) / 180);
  const at = (phi: number, frac: number, z: number): V3 => [Math.cos(phi) * R(phi) * frac, Math.sin(phi) * R(phi) * frac, z];
  const th = (k: number) => (k * Math.PI) / 4;
  const T = (k: number) => at(th(k), rt, hc);
  const S = (k: number) => at(th(k) + Math.PI / 8, rs, (hc * (1 - rs)) / (1 - rt));
  const Gt = (phi: number) => at(phi, 1, 0);
  const Gb = (phi: number) => at(phi, 1, -gt);
  const C: V3 = [0, 0, -gt - hp];
  const L = (k: number) => {
    const g = Gb(th(k) + Math.PI / 8);
    return add(g, mul(sub(C, g), 0.77));
  };
  const tan = (phi: number): V3 => [-Math.sin(phi), Math.cos(phi), 0];
  const out: number[] = [0, 0, 1, hc];
  for (let k = 0; k < 8; k += 1) {
    out.push(...plane(T(k), T(k + 1), S(k)));
    // The bezel (kite) through the table corner and the girdle under it (so it does not cut into the girdle).
    out.push(...plane(T(k), Gt(th(k)), add(Gt(th(k)), tan(th(k)))));
    out.push(...plane(S(k), Gt(th(k)), Gt(th(k) + Math.PI / 8)));
    out.push(...plane(S(k), Gt(th(k) + Math.PI / 8), Gt(th(k + 1))));
    out.push(...plane(C, Gb(th(k)), add(Gb(th(k)), tan(th(k)))));
    out.push(...plane(L(k), Gb(th(k)), Gb(th(k) + Math.PI / 8)));
    out.push(...plane(L(k), Gb(th(k) + Math.PI / 8), Gb(th(k + 1))));
  }
  for (let j = 0; j < 32; j += 1) {
    const a = Gt((j * Math.PI) / 16), b = Gt(((j + 1) * Math.PI) / 16);
    out.push(...plane(a, b, add(a, [0, 0, -1])));
  }
  return out;
}

/** An emerald (step) cut: a rectangle with cut corners, 3 steps on the crown, 4 on the pavilion down to a keel. 65
 * planes. */
function stepCut(aspect: number): number[] {
  const L = 1, Wd = 1 / aspect, c = 0.2, gt = 0.03;
  // The eight sides: outward normal in the plane and the distance to it.
  const sides: { m: V3; off: number }[] = [];
  for (const [mx, my] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) sides.push({ m: [mx, my, 0], off: mx ? L : Wd });
  const s2 = Math.SQRT1_2;
  for (const [mx, my] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) sides.push({ m: [mx * s2, my * s2, 0], off: (L + Wd - c) * s2 });
  const crownIn = [0, 0.1, 0.2, 0.3], crownZ = [0, 0.07, 0.13, 0.17];
  const pavIn = [0, 0.13, 0.27, 0.42, 0.62], pavZ = [-gt, -0.22, -0.4, -0.54, -0.64];
  const out: number[] = [0, 0, 1, crownZ[3]];
  for (const { m, off } of sides) {
    const t: V3 = [-m[1], m[0], 0];
    const pt = (inset: number, z: number): V3 => [m[0] * (off - inset), m[1] * (off - inset), z];
    for (let i = 0; i < 3; i += 1) {
      const a = pt(crownIn[i], crownZ[i]), b = pt(crownIn[i + 1], crownZ[i + 1]);
      out.push(...plane(a, b, add(a, t)));
    }
    out.push(...m, off);
    for (let i = 0; i < 4; i += 1) {
      const a = pt(pavIn[i], pavZ[i]), b = pt(pavIn[i + 1], pavZ[i + 1]);
      out.push(...plane(a, b, add(a, t)));
    }
  }
  return out;
}

/** The facets' planes (n, d each) of a gem's cut; empty for a cabochon (a dome, drawn analytically). */
export function cutPlanes(gem: Gem): Float32Array {
  if (gem.cut === 'cabochon') return new Float32Array(0);
  if (gem.cut === 'emerald') return new Float32Array(stepCut(gem.aspect));
  return new Float32Array(brilliant(outline(gem.cut, gem.aspect)));
}

/** The outline sampled at 32 angles (for the setting and the shadow). */
export function outlineSamples(gem: Gem): Float32Array {
  const out = new Float32Array(32);
  if (gem.cut === 'emerald') {
    const L = 1, Wd = 1 / gem.aspect, c = 0.2;
    for (let j = 0; j < 32; j += 1) {
      const f = (j / 32) * Math.PI * 2;
      const cx = Math.abs(Math.cos(f)), cy = Math.abs(Math.sin(f));
      // The ray from the middle meets the octagon at the nearest of its sides.
      out[j] = Math.min(cx > 1e-6 ? L / cx : 1e9, cy > 1e-6 ? Wd / cy : 1e9, (L + Wd - c) / (cx + cy));
    }
    return out;
  }
  const R = outline(gem.cut, gem.aspect);
  for (let j = 0; j < 32; j += 1) out[j] = R((j / 32) * Math.PI * 2);
  return out;
}
