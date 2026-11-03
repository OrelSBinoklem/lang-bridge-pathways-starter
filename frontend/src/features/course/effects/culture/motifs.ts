import type { Rgb } from './threadDraw';

/**
 * The patterns of the embroidered belt: six motifs on an 11 x 11 grid of cross stitches (a star, the sun, the moon,
 * an oak, a bird, a heart), the zigzag borders and the small dividers. They are built from formulas rather than
 * typed in, so that the shapes come out symmetric.
 */
export type ThreadKey = 'W' | 'G' | 'B' | 'K';

export const THREAD_COLORS: Record<ThreadKey, Rgb> = {
  W: [242, 234, 216], // undyed linen
  G: [228, 178, 70], // gold
  B: [58, 128, 158], // indigo blue
  K: [66, 122, 80], // green
};

export type MotifCell = { col: number; row: number; color: ThreadKey };
export type Motif = { id: string; cells: MotifCell[] };

export const MOTIF_SIZE = 11;
const C = 5; // the centre cell

function build(fn: (dx: number, dy: number) => ThreadKey | null): MotifCell[] {
  const cells: MotifCell[] = [];
  for (let row = 0; row < MOTIF_SIZE; row += 1) {
    for (let col = 0; col < MOTIF_SIZE; col += 1) {
      const color = fn(col - C, row - C);
      if (color) cells.push({ col, row, color });
    }
  }
  return cells;
}

const heartInside = (dx: number, dy: number) => {
  const u = dx / 4.3;
  const v = -(dy - 0.5) / 4.1;
  const a = u * u + v * v - 1;
  return a * a * a - u * u * v * v * v <= 0;
};

const BIRD = [
  '...........',
  '.W.......W.',
  '..WW...WW..',
  '...WW.WW...',
  '....WGW....',
  '.....G.....',
  '....GGG....',
  '....GGG....',
  '.....G.....',
  '....G.G....',
  '...........',
];

export const MOTIFS: Motif[] = [
  {
    id: 'auseklis',
    cells: build((dx, dy) => {
      if (dx === 0 && dy === 0) return 'W';
      if (dx === 0 || dy === 0) return 'G';
      if (Math.abs(dx) === Math.abs(dy) && Math.abs(dx) >= 2 && Math.abs(dx) <= 3) return 'W';
      return null;
    }),
  },
  {
    id: 'saule',
    cells: build((dx, dy) => {
      const d = Math.hypot(dx, dy);
      if (d <= 1.2) return 'G';
      if (d >= 2.3 && d <= 3.1) return 'W';
      if (d >= 3.9 && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) return 'G';
      return null;
    }),
  },
  {
    id: 'meness',
    cells: build((dx, dy) => {
      const star = [[3, -3], [2, -3], [4, -3], [3, -2], [3, -4], [4, 3]];
      if (star.some(([sx, sy]) => sx === dx && sy === dy)) return 'G';
      const inA = Math.hypot(dx + 0.4, dy) <= 4.6;
      const inB = Math.hypot(dx - 1.7, dy + 0.5) <= 3.7;
      return inA && !inB ? 'W' : null;
    }),
  },
  {
    id: 'ozols',
    cells: build((dx, dy) => {
      if ([[-2, -3], [1, -4], [2, -1]].some(([sx, sy]) => sx === dx && sy === dy)) return 'G';
      if (Math.hypot(dx, dy + 2) <= 3.6) return 'K';
      if (dx === 0 && dy >= 1 && dy <= 5) return 'G';
      if (Math.abs(dx) === 1 && dy === 5) return 'G';
      return null;
    }),
  },
  {
    id: 'putns',
    cells: (() => {
      const cells: MotifCell[] = [];
      BIRD.forEach((line, row) => {
        [...line].forEach((ch, col) => {
          if (ch === 'W' || ch === 'G') cells.push({ col, row, color: ch });
        });
      });
      return cells;
    })(),
  },
  {
    id: 'sirds',
    cells: build((dx, dy) => {
      if (!heartInside(dx, dy)) return null;
      const edge = !heartInside(dx + 1, dy) || !heartInside(dx - 1, dy) || !heartInside(dx, dy + 1) || !heartInside(dx, dy - 1);
      return edge ? 'W' : 'G';
    }),
  },
];

/** Height (in cells) of the zigzag border at a column, 1 to 3. */
export const zigzagHeight = (col: number) => [1, 2, 3, 2][((col % 4) + 4) % 4];

/** The little cross between two motifs, relative to its centre. */
export const DIVIDER: Array<[number, number]> = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];

/** A separate vocabulary of shapes for the left side of the large embroidery. */
export const LEFT_MOTIFS: Motif[] = [
  { id: 'zieds', cells: build((dx, dy) => {
    const d = Math.hypot(dx, dy);
    if (d <= 1.2) return 'G';
    const petal = Math.min(Math.hypot(dx - 2.4, dy), Math.hypot(dx + 2.4, dy), Math.hypot(dx, dy - 2.4), Math.hypot(dx, dy + 2.4));
    return petal < 1.8 ? 'W' : null;
  }) },
  { id: 'rombs', cells: build((dx, dy) => {
    const d = Math.abs(dx) + Math.abs(dy);
    return d === 5 ? 'W' : d === 3 ? 'B' : d === 0 ? 'G' : null;
  }) },
  { id: 'taurenis', cells: build((dx, dy) => {
    if (dx === 0 && Math.abs(dy) <= 3) return 'G';
    if (dy === -4 && Math.abs(dx) === 1) return 'G';
    const upper = Math.hypot((Math.abs(dx) - 2.5) / 1.8, (dy + 1.5) / 2);
    const lower = Math.hypot((Math.abs(dx) - 2) / 1.5, (dy - 2) / 1.5);
    return upper <= 1 ? 'B' : lower <= 1 ? 'W' : null;
  }) },
  { id: 'egle', cells: build((dx, dy) => {
    if (dx === 0 && dy >= -4) return dy > 3 ? 'G' : 'K';
    for (const top of [-4, -2, 0]) {
      const depth = dy - top;
      if (depth >= 0 && depth <= 3 && Math.abs(dx) === depth) return 'K';
    }
    return null;
  }) },
  { id: 'lapa', cells: build((dx, dy) => {
    if (dx === dy && Math.abs(dx) <= 4) return 'G';
    const along = (dx + dy) * .707, across = (dx - dy) * .707;
    return (along / 5.4) ** 2 + (across / 2.8) ** 2 <= 1 ? 'K' : null;
  }) },
  { id: 'vilnis', cells: build((dx, dy) => {
    const wave = Math.round(Math.sin((dx + 5) * Math.PI / 5) * 1.5);
    return dy === wave - 2 ? 'B' : dy === wave + 2 ? 'W' : null;
  }) },
];

export type EmbroideryComposition = 'card' | 'full' | 'left' | 'right';

/** Keep the legacy card/right sequence; the left uses different geometry, not a shifted copy. */
export function embroideryPattern(slot: number, band: number, slots: number, composition: EmbroideryComposition) {
  const left = composition === 'left' || composition === 'full' && slot < Math.floor(slots / 2);
  const index = slot + band * 2;
  const motif = left ? LEFT_MOTIFS[index % LEFT_MOTIFS.length] : MOTIFS[index % MOTIFS.length];
  return { motif, word: left ? MOTIFS.length + index % LEFT_MOTIFS.length : index % MOTIFS.length };
}
