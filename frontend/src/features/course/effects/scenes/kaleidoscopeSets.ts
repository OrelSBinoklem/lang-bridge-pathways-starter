/**
 * Generators of the kaleidoscope's pieces: each set is a way of filling the object cell, with its own idea, shapes,
 * palette and surface — from hand-cut glass to sea-tumbled frosted pebbles, cut crystals, pressed flowers, frost-covered
 * ice, amber splinters. A set says what to make (with the random source it is given, so every ✦ makes new pieces by the
 * same rules); kaleidoscope.ts (makePieces) makes the bodies. About a hundred pieces a set, so the physics and the tracer
 * cost the same whichever is chosen.
 *
 * `rough` is the surface's roughness, 0…1: 0 polished glass, ~0.3 satin, 1 sand-blasted. The tracer scatters light on it
 * (kaleidoscopeGlass.ts, frostN): rough glass glows milky and soft, its glints spread into a sheen.
 */

import type { KaleidoscopeLook } from './kaleidoscopePresets';

export type RGB = [number, number, number];

/** How a set asks for its pieces (sizes in mm; colours sRGB 0–255). */
export type PieceFactory = {
  /**
   * A flat glass shard: a polygon of `sides` corners (at most 8) round a radius `size`; `jitter` how unevenly broken
   * (0 a regular polygon), `aspect` stretched into a splinter, `cut` flat facets round the edge instead of a worn one.
   */
  shard(o: { size: number; sides: number; jitter?: number; aspect?: number; thick?: number; col: RGB; col2?: RGB | null; clear?: boolean; rough?: number; cut?: boolean }): void;
  /** A glass bead, a pearl (opaque, nacre) or, rough, a matte grain. */
  bead(o: { r: number; col: RGB; pearl?: boolean; rough?: number }): void;
  /** A bugle bead (glass, or silver/gold lined). */
  rod(o: { half: number; r: number; col: RGB; metal?: boolean }): void;
  /** A metal foil flake: 0 gold, 1 silver, 2 holographic, 3 copper. */
  flake(o: { a: number; metal: number }): void;
  /** A thin translucent petal (egg-shaped) or, `pointed`, a leaf. */
  petal(o: { len: number; width: number; col: RGB; rough?: number; pointed?: boolean }): void;
  /** A small scallop shell (a fan), opaque nacre with ribs. */
  shell(o: { r: number; col: RGB }): void;
};

export type PieceSet = {
  id: string;
  label: string;
  /** The set's idea, in a few words. */
  idea: string;
  /** What is in it. */
  note: string;
  /** Its own look, laid over the settings while this set is in the drum (the owner's choice per set). */
  look?: Partial<KaleidoscopeLook>;
  build(rand: () => number, f: PieceFactory): void;
};

const pick = <T,>(rand: () => number, list: readonly T[]) => list[Math.floor(rand() * list.length)];
const range = (rand: () => number, a: number, b: number) => a + rand() * (b - a);

const CLASSIC_GLASS: RGB[] = [
  [208, 20, 44], [242, 156, 17], [19, 160, 90], [27, 88, 214], [140, 43, 217], [15, 181, 176], [255, 95, 162], [255, 210, 26], [226, 240, 255],
];

export const PIECE_SETS: readonly PieceSet[] = [
  {
    id: 'classic',
    label: 'Классика',
    idea: 'Как в детском калейдоскопе: всего понемногу',
    note: 'Колотое цветное стекло (часть дихроичного), бусины и жемчуг, стеклярус, металлические блёстки. Стекло гладкое, края обтёрты.',
    build(rand, f) {
      for (let i = 0; i < 30; i += 1) {
        const col = pick(rand, CLASSIC_GLASS);
        f.shard({ size: range(rand, 1.9, 3.5), sides: 4 + Math.floor(rand() * 3), col, col2: rand() < 0.25 ? pick(rand, CLASSIC_GLASS) : null, clear: col[2] > 240 && col[0] > 200 });
      }
      for (let i = 0; i < 12; i += 1) {
        const pearl = rand() < 0.35;
        f.bead({ r: range(rand, 1.1, 1.9), col: pearl ? [246, 240, 228] : pick(rand, CLASSIC_GLASS), pearl });
      }
      for (let i = 0; i < 8; i += 1) {
        const metal = rand() < 0.4;
        f.rod({ half: range(rand, 1.6, 2.8), r: range(rand, 0.7, 0.9), col: metal ? pick(rand, [[226, 184, 74], [214, 220, 228]] as RGB[]) : pick(rand, CLASSIC_GLASS), metal });
      }
      for (let i = 0; i < 44; i += 1) f.flake({ a: range(rand, 0.5, 0.95), metal: Math.floor(rand() * 4) });
    },
  },
  {
    id: 'sea',
    label: 'Морское стекло',
    look: { kalExposure: 1.6 },
    idea: 'Годы в прибое: всё обкатано и матово',
    note: 'Круглые окатыши из бутылочного стекла (морская волна, бирюза, кобальт, бутылочное, янтарное, молочное), сплошь матовые, как после песка; ракушки, жемчуг, песчинки, немного серебра.',
    build(rand, f) {
      const sea: RGB[] = [[150, 214, 192], [118, 200, 214], [44, 96, 186], [64, 142, 86], [176, 116, 52], [236, 240, 234], [170, 222, 226]];
      for (let i = 0; i < 26; i += 1) f.shard({ size: range(rand, 1.8, 3.2), sides: 9 + Math.floor(rand() * 3), jitter: 0.3, aspect: range(rand, 1, 1.4), thick: 1.3, col: pick(rand, sea), rough: range(rand, 0.75, 1) });
      for (let i = 0; i < 9; i += 1) f.shell({ r: range(rand, 1.3, 2.0), col: pick(rand, [[248, 234, 220], [250, 222, 214], [240, 236, 226]] as RGB[]) });
      for (let i = 0; i < 7; i += 1) f.bead({ r: range(rand, 0.9, 1.5), col: [246, 240, 230], pearl: true });
      for (let i = 0; i < 16; i += 1) f.bead({ r: range(rand, 0.5, 0.8), col: pick(rand, [[222, 200, 160], [206, 186, 150], [236, 224, 196]] as RGB[]), rough: 1 });
      for (let i = 0; i < 20; i += 1) f.flake({ a: range(rand, 0.45, 0.8), metal: rand() < 0.7 ? 1 : 2 });
    },
  },
  {
    id: 'jewels',
    label: 'Драгоценности',
    idea: 'Ювелирная огранка: строгая геометрия и огонь',
    note: 'Правильные треугольники и шестигранники с острыми гранями по краю (рубин, изумруд, сапфир, аметист, цитрин, «бриллиант»), прозрачные стразы, гранат, золотой стеклярус и золотая фольга. Всё отполировано.',
    build(rand, f) {
      const gems: RGB[] = [[196, 8, 40], [0, 146, 76], [16, 52, 206], [128, 28, 190], [244, 172, 18], [246, 248, 255]];
      for (let i = 0; i < 24; i += 1) {
        const col = pick(rand, gems);
        f.shard({ size: range(rand, 1.6, 2.8), sides: rand() < 0.5 ? 3 : 6, jitter: 0, thick: 1.5, col, clear: col[0] > 240 && col[2] > 240, cut: true });
      }
      for (let i = 0; i < 12; i += 1) f.bead({ r: range(rand, 0.6, 0.95), col: [248, 250, 255] });
      for (let i = 0; i < 8; i += 1) f.bead({ r: range(rand, 1.0, 1.5), col: [120, 8, 22] });
      for (let i = 0; i < 10; i += 1) f.rod({ half: range(rand, 1.5, 2.6), r: range(rand, 0.55, 0.75), col: [226, 184, 74], metal: true });
      for (let i = 0; i < 34; i += 1) f.flake({ a: range(rand, 0.5, 0.9), metal: rand() < 0.8 ? 0 : 2 });
    },
  },
  {
    id: 'flowers',
    label: 'Сухоцветы',
    idea: 'Гербарий: мягкое, живое, без острых углов',
    note: 'Тонкие лепестки (розовые, малиновые, сиреневые, жёлтые, оранжевые, белые), зелёные листики, семена, немного золота. Всё полуматовое и просвечивает, как засушенное между страниц.',
    build(rand, f) {
      const petals: RGB[] = [[252, 124, 172], [232, 62, 112], [152, 92, 212], [196, 164, 238], [255, 214, 60], [255, 150, 42], [252, 246, 240]];
      for (let i = 0; i < 46; i += 1) f.petal({ len: range(rand, 3.6, 6), width: range(rand, 1.8, 2.9), col: pick(rand, petals), rough: range(rand, 0.3, 0.65) });
      for (let i = 0; i < 14; i += 1) f.petal({ len: range(rand, 4.5, 7), width: range(rand, 1.3, 2), col: pick(rand, [[92, 162, 62], [140, 192, 82], [66, 130, 58]] as RGB[]), rough: range(rand, 0.15, 0.4), pointed: true });
      for (let i = 0; i < 12; i += 1) f.bead({ r: range(rand, 0.5, 0.8), col: pick(rand, [[150, 96, 40], [196, 150, 60], [90, 60, 30]] as RGB[]), rough: 0.8 });
      for (let i = 0; i < 18; i += 1) f.flake({ a: range(rand, 0.45, 0.8), metal: 0 });
    },
  },
  {
    id: 'ice',
    label: 'Лёд и иней',
    look: { kalExposure: 1.65, kalSaturation: 1.75, kalSparkle: 0.5 },
    idea: 'Мороз: прозрачное рядом с заиндевевшим',
    note: 'Колотый лёд — прозрачные и бледно-голубые осколки, у каждого своя степень инея (от чистого до совсем матового), часть с сине-фиолетовым отливом; прозрачные бусины, серебряный стеклярус и блёстки.',
    build(rand, f) {
      const ice: RGB[] = [[196, 226, 255], [150, 198, 255], [118, 176, 242], [178, 222, 250], [206, 196, 255], [232, 244, 255]];
      for (let i = 0; i < 30; i += 1) {
        const frosty = rand();
        f.shard({
          size: range(rand, 1.8, 3.6), sides: 3 + Math.floor(rand() * 4), jitter: 0.8, col: pick(rand, ice),
          col2: rand() < 0.35 ? pick(rand, [[90, 140, 255], [170, 110, 255], [80, 220, 240]] as RGB[]) : null,
          clear: frosty < 0.3, rough: frosty < 0.35 ? 0 : (frosty - 0.35) * 1.4,
        });
      }
      for (let i = 0; i < 10; i += 1) f.bead({ r: range(rand, 0.9, 1.6), col: [236, 244, 255], rough: rand() < 0.3 ? 0.6 : 0 });
      for (let i = 0; i < 8; i += 1) f.rod({ half: range(rand, 1.6, 2.8), r: range(rand, 0.6, 0.8), col: [214, 220, 228], metal: true });
      for (let i = 0; i < 48; i += 1) f.flake({ a: range(rand, 0.45, 0.9), metal: rand() < 0.75 ? 1 : 2 });
    },
  },
  {
    id: 'amber',
    label: 'Янтарь и огонь',
    idea: 'Разбитое: длинные острые щепки тёплого стекла',
    note: 'Узкие осколки-щепки янтарного, медового, оранжевого, красного и вишнёвого стекла, чуть атласные; гранатовые и янтарные бусины, немного жемчуга, золото и медь.',
    build(rand, f) {
      const fire: RGB[] = [[255, 172, 40], [240, 150, 20], [250, 108, 20], [212, 34, 20], [132, 12, 22], [255, 208, 90]];
      for (let i = 0; i < 28; i += 1) f.shard({ size: range(rand, 1.7, 3.1), sides: 3 + Math.floor(rand() * 2), jitter: 0.5, aspect: range(rand, 1.6, 2.4), col: pick(rand, fire), col2: rand() < 0.2 ? pick(rand, fire) : null, rough: range(rand, 0.1, 0.3) });
      for (let i = 0; i < 12; i += 1) {
        const pearl = rand() < 0.25;
        f.bead({ r: range(rand, 1.0, 1.8), col: pearl ? [250, 236, 214] : pick(rand, [[240, 150, 30], [150, 20, 24], [255, 190, 70]] as RGB[]), pearl });
      }
      for (let i = 0; i < 10; i += 1) f.rod({ half: range(rand, 1.6, 2.8), r: range(rand, 0.6, 0.85), col: rand() < 0.6 ? [226, 184, 74] : [214, 128, 84], metal: true });
      for (let i = 0; i < 44; i += 1) f.flake({ a: range(rand, 0.5, 0.95), metal: rand() < 0.55 ? 0 : 3 });
    },
  },
];
