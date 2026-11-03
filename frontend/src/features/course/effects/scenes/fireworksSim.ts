/**
 * A generative fireworks show in 3D, in metres and seconds, without DOM or WebGL (fireworksGL.ts draws it).
 *
 * Shells are launched from behind the city 150–320 m away, rise against gravity and burst near the top of their
 * climb. Stars leave the burst at 25–60 m/s and slow down in the air (drag ∝ v²), fall, change colour, glitter,
 * split, crackle or trail sparks according to the shell's recipe; each shell is a new random mix of type, colours,
 * size and height. A "director" varies the rhythm: single shells, fanned salvos and now and then a dense finale
 * followed by a pause. The full-page show (`lavish`) adds rainbow, multicolour, pistil, Saturn, double-ring, heart,
 * fish, brocade and ghost shells, mines fired from the ground, salvos in rainbow order and a busier rhythm. Both write
 * LATVIJA (in the colours of the flag) and LĪGO (gold turning green) across the sky now and then. Every burst
 * is also a light (for the smoke, the roofs and the river) and leaves smoke that the wind carries away.
 */

export type Colour = [number, number, number];

/** Linear-light colours of the metal salts (and charcoal, titanium) that colour real stars. */
export const COLOURS: Record<string, Colour> = {
  red: [1, 0.06, 0.04],
  orange: [1, 0.32, 0.04],
  gold: [1, 0.55, 0.16],
  yellow: [1, 0.82, 0.22],
  green: [0.18, 1, 0.22],
  cyan: [0.15, 0.85, 1],
  blue: [0.12, 0.25, 1],
  purple: [0.6, 0.15, 1],
  pink: [1, 0.25, 0.55],
  silver: [0.92, 0.94, 1],
  magenta: [1, 0.08, 0.85],
  lime: [0.55, 1, 0.08],
  turquoise: [0.08, 1, 0.72],
  amber: [1, 0.62, 0.04],
  lavender: [0.7, 0.52, 1],
  coral: [1, 0.36, 0.28],
  white: [1, 1, 1],
};
const VIVID = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink', 'silver'];
/** The full-page show's wider choice of pure colours (white and silver only as the colour a star burns out to, so
 * many bursts together stay colourful instead of washing out to white). */
const LAVISH = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink', 'magenta', 'lime', 'turquoise', 'amber', 'lavender', 'coral'];

/** A fully saturated colour of hue `h` (0…1), linear light. */
function hue(h: number): Colour {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return 1 - Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

/**
 * Letters for the word shells, as fat rounded "balloon" letters: each glyph is a skeleton of strokes in a box one
 * unit tall (y up), inflated by R_BUBBLE. Stars sit along the balloon's outline and, sparser, inside it as glitter.
 */
const arc = (cx: number, cy: number, rx: number, ry: number, from: number, to: number, n: number): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
const R_BUBBLE = 0.14;
const SKELETONS: Record<string, { w: number; strokes: [number, number][][] }> = {
  L: { w: 0.5, strokes: [[[0, 1], [0, 0], [0.5, 0]]] },
  A: { w: 0.62, strokes: [[[0, 0], [0, 0.62], ...arc(0.31, 0.62, 0.31, 0.38, Math.PI, 0, 10).slice(1), [0.62, 0]], [[0, 0.4], [0.62, 0.4]]] },
  T: { w: 0.66, strokes: [[[0, 1], [0.66, 1]], [[0.33, 1], [0.33, 0]]] },
  V: { w: 0.64, strokes: [[[0, 1], [0.32, 0], [0.64, 1]]] },
  I: { w: 0, strokes: [[[0, 1], [0, 0]]] },
  Ī: { w: 0.1, strokes: [[[0.05, 1], [0.05, 0]], [[-0.1, 1.36], [0.2, 1.36]]] },
  J: { w: 0.5, strokes: [[[0.5, 1], [0.5, 0.3], ...arc(0.25, 0.3, 0.25, 0.3, 0, -Math.PI, 10).slice(1)]] },
  G: { w: 0.74, strokes: [[...arc(0.37, 0.5, 0.37, 0.5, Math.PI * 0.2, Math.PI * 1.97, 22), [0.74, 0.44], [0.42, 0.44]]] },
  O: { w: 0.74, strokes: [arc(0.37, 0.5, 0.37, 0.5, 0, Math.PI * 2, 26)] },
};

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

/** Keeps points no closer than `gap` to one another (greedy, in the order given). */
function spaced(points: [number, number][], gap: number) {
  const kept: [number, number][] = [];
  for (const p of points) if (kept.every((q) => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 >= gap * gap)) kept.push(p);
  return kept;
}

type WordStar = { x: number; y: number; fill: boolean };
type Letter = { cx: number; cy: number; stars: WordStar[] };
type Word = { width: number; letters: Letter[] };

/** The balloon letters of a word, centred on 0,0, in letter heights: an outline every 0.065, glitter every 0.12. */
function balloonWord(text: string): Word {
  const h = 0.02;
  const r = R_BUBBLE;
  const letters: Letter[] = [];
  let x0 = 0;
  for (const ch of text) {
    const g = SKELETONS[ch];
    if (!g) continue;
    const ys = g.strokes.flat().map((p) => p[1]);
    const dist = (x: number, y: number) => {
      let d = Infinity;
      for (const s of g.strokes) for (let i = 0; i < s.length - 1; i += 1) d = Math.min(d, segmentDistance(x, y, s[i][0], s[i][1], s[i + 1][0], s[i + 1][1]));
      return d;
    };
    const outline: [number, number][] = [];
    const inside: [number, number][] = [];
    for (let y = Math.min(...ys) - r - h; y <= Math.max(...ys) + r + h; y += h) {
      for (let x = -r - h; x <= g.w + r + h; x += h) {
        const d = dist(x, y);
        if (Math.abs(d - r) < h * 0.6) outline.push([x, y]);
        else if (d < r - 0.06) inside.push([x, y]);
      }
    }
    const stars = [
      ...spaced(outline, 0.065).map(([x, y]) => ({ x: x0 + r + x, y, fill: false })),
      ...spaced(inside, 0.12).map(([x, y]) => ({ x: x0 + r + x, y, fill: true })),
    ];
    letters.push({ cx: x0 + r + g.w / 2, cy: 0.5, stars });
    x0 += g.w + 2 * r + 0.07;
  }
  const width = x0 - 0.07;
  for (const l of letters) {
    for (const s of l.stars) {
      s.x -= width / 2;
      s.y -= 0.5;
    }
    l.cx -= width / 2;
    l.cy -= 0.5;
  }
  return { width, letters };
}
const WORDS = [balloonWord('LATVIJA'), balloonWord('LĪGO')];

export const GRAVITY = 9.81;
/** Stars stored per instance for the renderer: position, previous position, colour, size (m), power. */
export const STAR_FLOATS = 11;
export const LIGHT_FLOATS = 7;
export const PUFF_FLOATS = 6;
export const MAX_STARS = 8000;
export const MAX_LIGHTS = 12;
export const MAX_PUFFS = 64;

type Kind = 'rocket' | 'star' | 'spark' | 'comet' | 'pop';
type Shell = {
  type: string;
  radius: number;
  a: Colour;
  b: Colour;
  /** Colour change time (share of a star's life), >1: none. */
  change: number;
  /** Word shells: which word (index in WORDS) the stars write. */
  word?: number;
};
type Particle = {
  kind: Kind;
  x: number; y: number; z: number;
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  age: number; life: number;
  a: Colour; b: Colour; change: number;
  size: number; power: number; drag: number;
  /** Sparks trailed per second (and their colour), glitter (share of time dark, flickering), split time. */
  trail: number; trailColour: Colour; trailCarry: number;
  glitter: number;
  split: number;
  crackle: boolean;
  /** Random sideways pushes, m/s²: stars that swim like fish. */
  wiggle: number;
  /** Linear drag, 1/s: slows every star of a word shell in the same proportion, so the letters keep their shape. */
  damp: number;
  /** Share of its life after which a star fades out. */
  fadeFrom: number;
  shell?: Shell;
  /** Sub-bursts: a multi-break shell's rocket bursts again this many times. */
  breaks?: number;
};
type Light = { x: number; y: number; z: number; c: Colour; power: number; age: number; life: number };
type Puff = { x: number; y: number; z: number; r: number; grow: number; density: number; age: number; life: number };

export type SceneBox = {
  /** Where launches may be, metres at the reference depth: the left and right edge of the view (x = ±half·z/ref). */
  halfWidth: number;
  /** Depth of the reference plane, and the nearest and farthest launch. */
  ref: number;
  near: number;
  far: number;
  /** Burst heights, metres. */
  low: number;
  high: number;
  /** Share of shells launched on the right half of the view (the card's text is on the left). */
  rightBias: number;
  /** The full-page show: more colours and shell types, fountains from the ground, a busier rhythm, rainbow salvos. */
  lavish?: boolean;
};

export function createShow(box: SceneBox, rand: () => number) {
  const parts: Particle[] = [];
  const lights: Light[] = [];
  const puffs: Puff[] = [];
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const colour = () => COLOURS[pick(box.lavish ? LAVISH : VIVID)];
  let nextShow = 0.3;
  let finale = 0;
  let wind = 2.5;
  let clock = 0;
  /** Things to happen later in the show (the letters of a word popping one by one). */
  const events: { at: number; run: () => void }[] = [];
  const later = (delay: number, run: () => void) => events.push({ at: clock + delay, run });
  /** While a word is in the sky the show holds its breath: no launches, the city puts its lights out (`dim`). */
  let wordUntil = -1;
  let dim = 0;

  const add = (p: Partial<Particle> & { kind: Kind; x: number; y: number; z: number }) => {
    if (parts.length >= MAX_STARS) return;
    parts.push({
      px: p.x, py: p.y, pz: p.z, vx: 0, vy: 0, vz: 0, age: 0, life: 1, a: COLOURS.gold, b: COLOURS.gold, change: 2,
      size: 0.6, power: 3, drag: 0.04, trail: 0, trailColour: COLOURS.gold, trailCarry: 0, glitter: 0, split: 0, crackle: false, wiggle: 0, damp: 0, fadeFrom: 0.6,
      ...p,
    });
  };
  const light = (x: number, y: number, z: number, c: Colour, power: number, life: number) => {
    lights.push({ x, y, z, c, power, age: 0, life });
    if (lights.length > 24) lights.splice(0, lights.length - 24);
  };
  const puff = (x: number, y: number, z: number, r: number, grow: number, density: number, life: number) => {
    puffs.push({ x, y, z, r, grow, density, age: 0, life });
    if (puffs.length > MAX_PUFFS) puffs.splice(0, puffs.length - MAX_PUFFS);
  };

  /** A random recipe: type, colours, size. */
  const recipe = (): Shell => {
    const type = pick(
      box.lavish
        ? ['peony', 'chrysanthemum', 'willow', 'palm', 'ring', 'crossette', 'crackle', 'dahlia', 'strobe', 'multi', 'kamuro',
          'rainbow', 'rainbow', 'multicolor', 'multicolor', 'pistil', 'pistil', 'saturn', 'double-ring', 'heart', 'fish', 'brocade', 'ghost']
        : ['peony', 'peony', 'chrysanthemum', 'willow', 'palm', 'ring', 'crossette', 'crackle', 'dahlia', 'strobe', 'multi', 'kamuro'],
    );
    const a = colour();
    let b = rand() < 0.45 ? colour() : a;
    if (type === 'willow' || type === 'kamuro') b = COLOURS.gold;
    return { type, radius: 0.7 + rand() * 0.6, a: type === 'willow' || type === 'kamuro' || type === 'palm' ? COLOURS.gold : a, b, change: b === a ? 2 : 0.35 + rand() * 0.3 };
  };

  const launch = (shell: Shell, x?: number, height?: number, tilt = 0, depth?: number) => {
    const z = depth ?? box.near + rand() * (box.far - box.near);
    const scale = z / box.ref;
    const side = rand() < box.rightBias ? rand() : -rand();
    const lx = x ?? side * box.halfWidth * 0.85 * scale;
    const h = height ?? box.low + rand() * (box.high - box.low);
    const v = Math.sqrt(2 * GRAVITY * h) * 1.02;
    add({
      kind: 'rocket', x: lx, y: 0, z, vx: tilt * v * 0.15 + (rand() - 0.5) * 2, vy: v, vz: (rand() - 0.5) * 2, life: 12,
      a: COLOURS.gold, b: COLOURS.gold, size: 0.5, power: 2.2, drag: 0.002, trail: 45, trailColour: [1, 0.6, 0.25], shell,
      breaks: shell.type === 'multi' ? 5 : 0,
    });
    puff(lx, 2, z, 4, 1.2, 0.35, 5);
  };

  /** Letter height of the word shells, metres: big enough to read in the card and on the full page alike. */
  const letterHeight = Math.min(40, Math.max(22, box.halfWidth * 0.08));
  let nextWord = 0;
  let lastWord = -4;
  /** A word shell — LATVIJA and LĪGO in turn — fired straight up where the whole word will fit in the view. */
  const launchWord = () => {
    const word = nextWord;
    nextWord = (nextWord + 1) % WORDS.length;
    const z = box.ref * (0.9 + rand() * 0.2);
    const half = (WORDS[word].width * letterHeight) / 2;
    const room = Math.max(0, box.halfWidth * (z / box.ref) * 0.92 - half);
    // In a card the word goes right, clear of the card's title on the left.
    const side = !box.lavish || rand() < 0.5 ? 1 : -1;
    const x = side * room * (box.lavish ? rand() * 0.8 : 0.25 + rand() * 0.55);
    const h = box.low + (box.high - box.low) * (0.4 + rand() * 0.35);
    launch({ type: 'word', radius: 1, a: COLOURS.red, b: COLOURS.white, change: 0.8, word }, x, h, 0, z);
    // The show holds its breath from the launch (the burst sets when it ends).
    wordUntil = clock + 60;
    finale = 0;
  };

  const burst = (r: Particle) => {
    const s = r.shell!;
    const { x, y, z } = r;
    const size = s.radius;
    const mean: Colour = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, (s.a[2] + s.b[2]) / 2];
    // Many bursts at once on the full page: each lights the smoke less and leaves thinner smoke, or the sky whitens.
    const haze = box.lavish ? 0.6 : 1;
    light(x, y, z, mean, 2.2 * size * haze, 1.4);
    for (let k = 0; k < 5; k += 1) puff(x + (rand() - 0.5) * 30 * size, y + (rand() - 0.5) * 25 * size, z, 14 * size, 3.5, 0.3 * haze, 8 + rand() * 5);
    const sphere = (n: number, speed: number, fill: (dx: number, dy: number, dz: number, i: number) => void) => {
      for (let i = 0; i < n; i += 1) {
        const t = (i + 0.5) / n;
        const phi = Math.acos(1 - 2 * t);
        const th = i * 2.39996 + rand() * 0.25;
        const sp = speed * (0.92 + rand() * 0.16);
        fill(Math.sin(phi) * Math.cos(th) * sp, Math.cos(phi) * sp, Math.sin(phi) * Math.sin(th) * sp, i);
      }
    };
    const star = (dx: number, dy: number, dz: number, extra: Partial<Particle>) =>
      add({ kind: 'star', x, y, z, vx: r.vx * 0.3 + dx, vy: r.vy * 0.3 + dy, vz: r.vz * 0.3 + dz, a: s.a, b: s.b, change: s.change, ...extra });
    const base = 46 * size;
    switch (s.type) {
      case 'willow':
      case 'kamuro':
        sphere(80 + Math.floor(rand() * 40), base * 0.75, (dx, dy, dz) =>
          star(dx, dy, dz, { life: 3.8 + rand() * 1.5, drag: 0.09, size: 0.5, power: 1.6, trail: 26, trailColour: [1, 0.55, 0.18], glitter: s.type === 'kamuro' ? 0.35 : 0 }));
        break;
      case 'palm':
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2 + rand() * 0.3;
          const up = 0.4 + rand() * 0.5;
          star(Math.cos(a) * base * 1.1, up * base, Math.sin(a) * base * 1.1, { kind: 'comet', life: 2.2 + rand() * 0.5, drag: 0.05, size: 1.1, power: 3.5, trail: 60, trailColour: [1, 0.58, 0.2] });
        }
        break;
      case 'ring': {
        // A flat ring, tilted at random.
        const ax = rand() * Math.PI;
        const n = 64 + Math.floor(rand() * 30);
        for (let i = 0; i < n; i += 1) {
          const a = (i / n) * Math.PI * 2;
          const cx = Math.cos(a) * base * 1.1;
          const cy = Math.sin(a) * base * 1.1 * Math.cos(ax);
          const cz = Math.sin(a) * base * 1.1 * Math.sin(ax);
          star(cx, cy, cz, { life: 1.5 + rand() * 0.4, size: 0.7, power: 3.4 });
        }
        sphere(20, base * 0.35, (dx, dy, dz) => star(dx, dy, dz, { life: 1.2, size: 0.6, power: 2.6, a: COLOURS.silver, b: COLOURS.silver, change: 2 }));
        break;
      }
      case 'crossette':
        sphere(20 + Math.floor(rand() * 8), base * 1.05, (dx, dy, dz) => star(dx, dy, dz, { life: 1.9, size: 0.9, power: 3.6, split: 0.55 + rand() * 0.15 }));
        break;
      case 'crackle':
        sphere(70 + Math.floor(rand() * 30), base, (dx, dy, dz) => star(dx, dy, dz, { life: 1.3 + rand() * 0.5, size: 0.6, power: 2.8, crackle: true, a: COLOURS.gold, b: s.a, change: 0.5 }));
        break;
      case 'dahlia':
        sphere(26 + Math.floor(rand() * 14), base * 1.1, (dx, dy, dz) => star(dx, dy, dz, { life: 2.2 + rand() * 0.4, size: 1.3, power: 4.5 }));
        break;
      case 'strobe':
        sphere(90, base * 0.95, (dx, dy, dz) => star(dx, dy, dz, { life: 2.4 + rand() * 0.8, size: 0.6, power: 3.5, glitter: 0.55, a: COLOURS.silver, b: COLOURS.silver, change: 2 }));
        break;
      case 'chrysanthemum':
        sphere(100 + Math.floor(rand() * 60), base, (dx, dy, dz) => star(dx, dy, dz, { life: 1.8 + rand() * 0.5, size: 0.65, power: 3.2, trail: 10, trailColour: [1, 0.7, 0.35] }));
        break;
      case 'multi':
        sphere(55, base * 0.7, (dx, dy, dz) => star(dx, dy, dz, { life: 1.4 + rand() * 0.3, size: 0.6, power: 3 }));
        break;
      case 'rainbow':
        // Every star its own hue, round the shell: the whole rainbow in one burst.
        sphere(130 + Math.floor(rand() * 50), base, (dx, dy, dz) => {
          const c = hue((Math.atan2(dz, dx) / (Math.PI * 2) + 1 + (dy / base) * 0.15 + s.radius) % 1);
          star(dx, dy, dz, { life: 1.8 + rand() * 0.6, size: 0.7, power: 3.8, a: c, b: rand() < 0.3 ? COLOURS.white : c, change: 0.7 });
        });
        break;
      case 'multicolor': {
        // Stars of four colours mixed through the shell.
        const set = [colour(), colour(), colour(), colour()];
        sphere(120 + Math.floor(rand() * 60), base, (dx, dy, dz, i) => {
          const c = set[i % set.length];
          star(dx, dy, dz, { life: 1.7 + rand() * 0.6, size: 0.7, power: 3.8, a: c, b: c, change: 2 });
        });
        break;
      }
      case 'pistil':
        // A peony with a small sphere of another colour inside it.
        sphere(110 + Math.floor(rand() * 40), base, (dx, dy, dz) => star(dx, dy, dz, { life: 1.8 + rand() * 0.5, size: 0.65, power: 3.6, a: s.a, b: s.a, change: 2 }));
        sphere(45, base * 0.42, (dx, dy, dz) => star(dx, dy, dz, { life: 1.4 + rand() * 0.3, size: 0.7, power: 4.2, a: s.b === s.a ? colour() : s.b, b: COLOURS.white, change: 0.75 }));
        break;
      case 'saturn': {
        // A sphere with a ring round it, in two colours.
        const tilt = (rand() - 0.5) * 1.2;
        const ring = s.b === s.a ? colour() : s.b;
        sphere(60, base * 0.55, (dx, dy, dz) => star(dx, dy, dz, { life: 1.7, size: 0.7, power: 3.8, a: s.a, b: s.a, change: 2 }));
        for (let i = 0; i < 80; i += 1) {
          const a = (i / 80) * Math.PI * 2;
          star(Math.cos(a) * base * 1.15, Math.sin(a) * base * 1.15 * Math.sin(tilt), Math.sin(a) * base * 1.15 * Math.cos(tilt), { life: 1.8, size: 0.65, power: 3.8, a: ring, b: ring, change: 2 });
        }
        break;
      }
      case 'double-ring': {
        // Two rings at right angles, each its own colour.
        const other = colour();
        const spin = rand() * Math.PI;
        for (let i = 0; i < 70; i += 1) {
          const a = (i / 70) * Math.PI * 2;
          const u = Math.cos(a) * base * 1.1;
          const v = Math.sin(a) * base * 1.1;
          star(u * Math.cos(spin), v, u * Math.sin(spin), { life: 1.6, size: 0.7, power: 3.8, a: s.a, b: s.a, change: 2 });
          star(-u * Math.sin(spin), v, u * Math.cos(spin), { life: 1.6, size: 0.7, power: 3.8, a: other, b: other, change: 2 });
        }
        break;
      }
      case 'heart': {
        // A heart facing the river (and the viewer), pink or red, turning white as it fades.
        const c = rand() < 0.5 ? COLOURS.pink : COLOURS.red;
        for (let i = 0; i < 80; i += 1) {
          const t = (i / 80) * Math.PI * 2;
          const hx = 16 * Math.sin(t) ** 3;
          const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
          star((hx / 17) * base, (hy / 17) * base, (rand() - 0.5) * 4, { life: 1.9, size: 0.75, power: 4, a: c, b: COLOURS.white, change: 0.8, drag: 0.06 });
        }
        break;
      }
      case 'word': {
        // A word in balloon letters. The letters pop one after another — a small bang at each letter's centre whose
        // stars fly out to its outline and fill (linear drag slows them all in the same proportion, so the letter
        // keeps its shape). Like any firework the word never stands still: from the first moment its stars sink at
        // their slow terminal speed and drift with the wind, dripping sparks, each at a slightly different pace, so
        // the letters soften as they go; then they burn out one by one, crackling. LATVIJA is in the flag's colours,
        // carmine with a white band across the middle; LĪGO is gold filled with oak-leaf green, with little flowers
        // popping round it like a midsummer wreath.
        const idx = s.word ?? 0;
        const w = WORDS[idx];
        const latvija = idx === 0;
        const H = letterHeight;
        const first = 0.35;
        const each = 0.32;
        const fadeAt = first + w.letters.length * each + 1.1 + 2.8;
        wordUntil = clock + fadeAt + 1.6;
        light(x, y, z, latvija ? COLOURS.red : COLOURS.gold, 2.5 * haze, 1);
        w.letters.forEach((l, k) => {
          const at = first + k * each;
          later(at, () => {
            const cx = x + l.cx * H;
            const cy = y + l.cy * H;
            for (const st of l.stars) {
              const band = Math.abs(st.y) < 0.1;
              const a = latvija ? (band ? COLOURS.white : COLOURS.red) : st.fill ? COLOURS.green : COLOURS.gold;
              const b = latvija ? COLOURS.white : st.fill ? COLOURS.lime : COLOURS.yellow;
              // Each star its own drag (±10%): the same final place, but a slightly different fall, so the letter
              // slowly loosens instead of sliding down as a rigid picture.
              const damp = 2.8 * (0.9 + rand() * 0.2);
              const fade = fadeAt - at - 0.6 + rand() * 0.9;
              const life = fade + 0.9 + rand() * 0.8;
              add({
                kind: 'star', x: cx, y: cy, z,
                vx: (st.x - l.cx) * H * damp + (rand() - 0.5) * 0.6, vy: (st.y - l.cy) * H * damp + (rand() - 0.5) * 0.6, vz: (rand() - 0.5) * 1,
                damp, life, fadeFrom: fade / life, change: fade / life, a, b, drag: 0,
                size: st.fill ? 0.6 : 0.8, power: st.fill ? 0.9 : latvija && !band ? 1.5 : 1.8, glitter: st.fill ? 0.25 : 0.05,
                trail: !st.fill && rand() < 0.5 ? 1.4 : 0, trailColour: latvija ? [1, 0.55, 0.4] : [1, 0.7, 0.3], crackle: rand() < 0.35,
              });
            }
            // The pop: a flash, a puff of smoke, a few sparks.
            light(cx, cy, z, latvija ? COLOURS.red : COLOURS.gold, 1.6 * haze, 0.7);
            puff(cx, cy, z, 5, 2, 0.2 * haze, 5);
            for (let q = 0; q < 10; q += 1) {
              const ang = rand() * Math.PI * 2;
              add({ kind: 'spark', x: cx, y: cy, z, vx: Math.cos(ang) * 14, vy: Math.sin(ang) * 14, life: 0.4 + rand() * 0.3, a: COLOURS.silver, b: COLOURS.silver, size: 0.4, power: 2, drag: 0.2 });
            }
          });
        });
        // Round the hanging word: little flowers (LĪGO) or red and white sparkles (LATVIJA).
        const wreath = [COLOURS.pink, COLOURS.yellow, COLOURS.blue, COLOURS.white, COLOURS.purple];
        const from = first + w.letters.length * each + 0.4;
        for (let q = 0; q < 9; q += 1) {
          later(from + q * 0.28 + rand() * 0.2, () => {
            const ang = rand() * Math.PI * 2;
            const fx = x + Math.cos(ang) * (w.width / 2 + 0.45) * H * (0.9 + rand() * 0.2);
            const fy = y + Math.sin(ang) * 1.05 * H;
            const col = latvija ? (q % 2 ? COLOURS.white : COLOURS.red) : wreath[q % wreath.length];
            for (let i = 0; i < 16; i += 1) {
              const a = (i / 16) * Math.PI * 2;
              add({ kind: 'star', x: fx, y: fy, z, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, life: 1.3 + rand() * 0.3, a: col, b: latvija ? col : COLOURS.yellow, change: 0.6, size: 0.5, power: 2.2, drag: 0.12 });
            }
          });
        }
        break;
      }
      case 'fish':
        // Stars that swim off in wriggles.
        sphere(60, base * 0.8, (dx, dy, dz) => star(dx, dy, dz, { life: 2.4 + rand() * 0.6, size: 0.55, power: 3.2, wiggle: 70, a: rand() < 0.5 ? s.a : COLOURS.gold, b: COLOURS.gold, change: 2 }));
        break;
      case 'brocade':
        // Gold trails like a willow, the stars burning out in colour.
        sphere(90 + Math.floor(rand() * 30), base * 0.85, (dx, dy, dz) =>
          star(dx, dy, dz, { life: 3 + rand() * 0.8, drag: 0.07, size: 0.55, power: 2.4, trail: 18, trailColour: [1, 0.6, 0.2], a: COLOURS.gold, b: s.a === COLOURS.gold ? colour() : s.a, change: 0.65 }));
        break;
      case 'ghost':
        // Strobing stars that change colour as they fly.
        sphere(100, base * 0.95, (dx, dy, dz) => star(dx, dy, dz, { life: 2.3 + rand() * 0.6, size: 0.6, power: 3.8, glitter: 0.35, a: s.a, b: s.b === s.a ? colour() : s.b, change: 0.45 }));
        break;
      default:
        sphere(110 + Math.floor(rand() * 70), base, (dx, dy, dz) => star(dx, dy, dz, { life: 1.7 + rand() * 0.6, size: 0.65, power: 3.3 }));
    }
    if (s.type === 'multi' && (r.breaks ?? 0) > 0) {
      // A few small shells thrown out of the first burst, each bursting a moment later.
      for (let k = 0; k < (r.breaks ?? 0); k += 1) {
        const a = rand() * Math.PI * 2;
        add({
          kind: 'rocket', x, y, z, vx: Math.cos(a) * 22, vy: 6 + rand() * 10, vz: Math.sin(a) * 22, life: 0.45 + rand() * 0.35,
          size: 0.3, power: 1.2, drag: 0.02, trail: 20, trailColour: [1, 0.6, 0.3],
          shell: { type: 'peony', radius: 0.35 + rand() * 0.15, a: colour(), b: colour(), change: 0.5 }, breaks: 0,
        });
      }
    }
  };

  /** A mine: coloured stars fired straight from the ground, fanning up in a cone (no shell, no rocket). */
  const mine = () => {
    const z = box.near + rand() * (box.far - box.near);
    const side = rand() < box.rightBias ? rand() : -rand();
    const x = side * box.halfWidth * 0.8 * (z / box.ref);
    const set = [colour(), colour(), colour()];
    const n = 50 + Math.floor(rand() * 30);
    for (let i = 0; i < n; i += 1) {
      const a = rand() * Math.PI * 2;
      const spread = rand() * 0.45;
      const sp = 38 + rand() * 20;
      const c = set[i % set.length];
      add({
        kind: 'star', x, y: 1, z, vx: Math.cos(a) * Math.sin(spread) * sp, vy: Math.cos(spread) * sp, vz: Math.sin(a) * Math.sin(spread) * sp,
        life: 1.6 + rand() * 0.8, a: c, b: c, change: 2, size: 0.6, power: 3.4, drag: 0.03, trail: 6, trailColour: c,
      });
    }
    light(x, 25, z, set[0], 1.2, 1.2);
    puff(x, 6, z, 8, 2.5, 0.3, 7);
  };

  const director = (dt: number) => {
    if (clock < wordUntil) return;
    const lavish = !!box.lavish;
    nextShow -= dt;
    if (finale > 0) {
      finale -= dt;
      if (nextShow <= 0) {
        if (lavish && rand() < 0.2) mine();
        else launch(recipe());
        nextShow = lavish ? 0.12 + rand() * 0.22 : 0.12 + rand() * 0.25;
      }
      if (finale <= 0) nextShow = lavish ? 2 + rand() * 1.5 : 3 + rand() * 2;
      return;
    }
    if (nextShow > 0) return;
    const roll = rand();
    if (roll < (lavish ? 0.11 : 0.1)) {
      finale = 3 + rand() * 2;
    } else if (roll < (lavish ? 0.46 : 0.36)) {
      // A salvo: the same shell three to five times, fanned across the sky (on the full page, each in the next colour
      // of the rainbow).
      const s = recipe();
      const n = 3 + Math.floor(rand() * 3);
      const z = box.near + rand() * (box.far - box.near);
      const h = box.low + rand() * (box.high - box.low);
      const centre = (rand() < box.rightBias ? 0.35 : -0.35) * box.halfWidth * (z / box.ref);
      const from = rand();
      for (let i = 0; i < n; i += 1) {
        const shell = lavish ? { ...s, a: hue((from + i / n) % 1), b: rand() < 0.4 ? COLOURS.white : hue((from + i / n) % 1), change: 0.6 } : s;
        launch(shell, centre + (i - (n - 1) / 2) * 45 * (z / box.ref), h * (0.9 + rand() * 0.2), (i - (n - 1) / 2) / n);
      }
      nextShow = lavish ? 1.1 + rand() * 0.9 : 1.2 + rand() * 1.0;
    } else if (lavish && roll < 0.58) {
      mine();
      nextShow = 0.3 + rand() * 0.5;
    } else if (clock - lastWord > 24 && rand() < (lavish ? 0.2 : 0.28)) {
      // Now and then a word: LATVIJA or LĪGO written in the sky, with a moment's calm around it to be read.
      launchWord();
      lastWord = clock;
      nextShow = 1.6 + rand() * 0.8;
    } else {
      launch(recipe());
      nextShow = lavish ? 0.35 + rand() * 0.7 : 0.35 + rand() * 0.8;
    }
  };

  const step = (dt: number) => {
    clock += dt;
    for (let i = events.length - 1; i >= 0; i -= 1) {
      if (events[i].at > clock) continue;
      const e = events[i];
      events.splice(i, 1);
      e.run();
    }
    dim += ((clock < wordUntil ? 1 : 0) - dim) * Math.min(1, dt * 1.1);
    wind = 2.5 + Math.sin(clock * 0.05) * 1.5;
    director(dt);
    const n = parts.length;
    for (let i = n - 1; i >= 0; i -= 1) {
      const p = parts[i];
      p.px = p.x;
      p.py = p.y;
      p.pz = p.z;
      p.age += dt;
      const speed = Math.hypot(p.vx, p.vy, p.vz);
      const slow = Math.max(0, 1 - p.drag * speed * dt);
      p.vx = p.vx * slow + wind * p.drag * 2 * dt;
      p.vy = p.vy * slow - GRAVITY * dt;
      p.vz *= slow;
      if (p.damp > 0) {
        // Linear drag relative to the air, which moves with the wind: the star sinks at g/damp and drifts along.
        const f = Math.exp(-p.damp * dt);
        p.vx = wind + (p.vx - wind) * f;
        p.vy *= f;
        p.vz *= f;
      }
      if (p.wiggle > 0) {
        p.vx += (rand() - 0.5) * p.wiggle * dt * 2;
        p.vy += (rand() - 0.5) * p.wiggle * dt * 2;
        p.vz += (rand() - 0.5) * p.wiggle * dt * 2;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.trail > 0) {
        p.trailCarry += p.trail * dt;
        while (p.trailCarry >= 1) {
          p.trailCarry -= 1;
          const k = rand();
          add({
            kind: 'spark', x: p.px + (p.x - p.px) * k, y: p.py + (p.y - p.py) * k, z: p.pz + (p.z - p.pz) * k,
            vx: p.vx * 0.1 + (rand() - 0.5) * 3, vy: p.vy * 0.1 + (rand() - 0.5) * 3, vz: (rand() - 0.5) * 3,
            life: p.kind === 'rocket' ? 0.35 + rand() * 0.3 : 0.7 + rand() * 0.9, a: p.trailColour, b: p.trailColour, size: 0.35, power: 1.4, drag: 0.2,
          });
        }
      }
      if (p.kind === 'rocket') {
        if (p.vy < 3 || p.age > p.life) {
          burst(p);
          parts[i] = parts[parts.length - 1];
          parts.pop();
        }
        continue;
      }
      if (p.split > 0 && p.age > p.split * p.life) {
        // Crossette: the star breaks into four, flying off square to its path.
        p.split = 0;
        for (let k = 0; k < 4; k += 1) {
          const a = (k / 4) * Math.PI * 2 + rand() * 0.4;
          // On the full page every piece takes a colour of its own.
          const c = box.lavish ? colour() : p.b;
          add({ kind: 'star', x: p.x, y: p.y, z: p.z, vx: p.vx * 0.4 + Math.cos(a) * 20, vy: p.vy * 0.4 + Math.sin(a) * 20, vz: p.vz * 0.4 + (rand() - 0.5) * 10, life: 0.9, a: c, b: c, size: 0.6, power: 3.2, drag: 0.05 });
        }
        parts[i] = parts[parts.length - 1];
        parts.pop();
        continue;
      }
      if (p.age >= p.life) {
        if (p.crackle) {
          for (let k = 0; k < 5; k += 1) add({ kind: 'pop', x: p.x + (rand() - 0.5) * 3, y: p.y + (rand() - 0.5) * 3, z: p.z, life: 0.05 + rand() * 0.1, a: COLOURS.silver, b: COLOURS.silver, size: 0.9, power: 6, drag: 0.5 });
        }
        parts[i] = parts[parts.length - 1];
        parts.pop();
      }
    }
    for (let i = lights.length - 1; i >= 0; i -= 1) {
      lights[i].age += dt;
      if (lights[i].age > lights[i].life) lights.splice(i, 1);
    }
    for (let i = puffs.length - 1; i >= 0; i -= 1) {
      const q = puffs[i];
      q.age += dt;
      q.r += q.grow * dt;
      q.grow *= Math.exp(-dt * 0.25);
      q.x += wind * dt;
      q.y += 0.6 * dt;
      if (q.age > q.life) puffs.splice(i, 1);
    }
  };

  /** Fills the renderer's buffers; returns the counts. */
  const write = (stars: Float32Array, lightOut: Float32Array, puffOut: Float32Array) => {
    let n = 0;
    for (const p of parts) {
      const k = p.age / p.life;
      let power = p.power;
      if (p.kind === 'star' || p.kind === 'comet') {
        // A flash as it ignites, a steady burn with some flicker, fading out at the end.
        power *= (k < 0.05 ? 1.8 : 1) * (1 - Math.max(0, k - p.fadeFrom) / Math.max(0.05, 1 - p.fadeFrom)) ** 1.3 * (0.85 + rand() * 0.3);
        if (p.glitter > 0 && rand() < p.glitter) power *= 0.05;
      } else if (p.kind === 'spark') power *= (1 - k) ** 2;
      else if (p.kind === 'pop') power *= 1 - k;
      if (power <= 0.01) continue;
      const c = k > p.change ? p.b : p.a;
      const o = n * STAR_FLOATS;
      stars[o] = p.x;
      stars[o + 1] = p.y;
      stars[o + 2] = p.z;
      stars[o + 3] = p.px;
      stars[o + 4] = p.py;
      stars[o + 5] = p.pz;
      stars[o + 6] = c[0];
      stars[o + 7] = c[1];
      stars[o + 8] = c[2];
      stars[o + 9] = p.size;
      stars[o + 10] = power;
      n += 1;
      if (n >= MAX_STARS) break;
    }
    // The strongest lights: a flash when a shell bursts, then its stars' glow dying away.
    const lit = lights
      .map((l) => ({ l, p: l.power * (l.age < 0.12 ? 2.5 : 1) * Math.max(0, 1 - l.age / l.life) ** 1.5 }))
      .sort((a, b) => b.p - a.p)
      .slice(0, MAX_LIGHTS);
    lightOut.fill(0);
    lit.forEach(({ l, p }, i) => {
      lightOut.set([l.x, l.y - l.age * 3, l.z, l.c[0] * p, l.c[1] * p, l.c[2] * p, 1], i * LIGHT_FLOATS);
    });
    let m = 0;
    for (const q of puffs) {
      const fade = Math.min(1, q.age / 0.4) * (1 - q.age / q.life);
      if (fade <= 0) continue;
      puffOut.set([q.x, q.y, q.z, q.r, q.density * fade, 0], m * PUFF_FLOATS);
      m += 1;
    }
    return { stars: n, lights: lit.length, puffs: m, dim };
  };

  return {
    step,
    write,
    /** A shell launched towards a point clicked at (x, height) on the reference plane. */
    fireAt(x: number, height: number) {
      const shell = recipe();
      const z = box.ref;
      const v = Math.sqrt(2 * GRAVITY * Math.max(20, height)) * 1.02;
      add({ kind: 'rocket', x, y: 0, z, vy: v, life: 12, size: 0.5, power: 2.2, drag: 0.002, trail: 45, trailColour: [1, 0.6, 0.25], shell, breaks: shell.type === 'multi' ? 5 : 0 });
    },
    get count() {
      return parts.length;
    },
  };
}
