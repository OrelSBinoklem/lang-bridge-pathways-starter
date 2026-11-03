/** Everything the tuning panel writes into for the three "Культура и язык" effects (the effects read it every frame). */

export type EmbroideryParams = {
  /** Stitches the needle makes per second while the cursor is over the card. */
  stitchRate: number;
  /** Cursor brush radius in minimal stitch nodes; runtime clamps it to at most six. */
  reach: number;
  /** Thickness of the thread. */
  thread: number;
  /** Stray fibres on the thread. */
  fuzz: number;
  /** Contrast of the thread's twist. */
  twist: number;
  /** Brightness of the cloth. */
  cloth: number;
  /** The needle keeps sewing by itself when the cursor is away. */
  autoSew: boolean;
  /** Show the word under a finished motif. */
  words: boolean;
  /** Unpicks everything. */
  reset: () => void;
  /** Counts the unpicks; the effect looks at it. */
  resetTick: number;
};

export function createEmbroideryParams(overrides: Partial<EmbroideryParams> = {}): EmbroideryParams {
  const params: EmbroideryParams = {
    stitchRate: 14,
    reach: 6,
    thread: 1,
    fuzz: 1,
    twist: 1,
    cloth: 1,
    autoSew: false,
    words: true,
    reset: () => {
      params.resetTick += 1;
    },
    resetTick: 0,
    ...overrides,
  };
  return params;
}

export type AmberParams = {
  /** How many words float in the amber. */
  words: number;
  /** Size of the light the cursor carries. */
  lamp: number;
  /** Brightness of the amber's glow. */
  glow: number;
  /** How much the amber's depth shifts with the cursor. */
  parallax: number;
  /** Bubbles and flecks. */
  inclusions: number;
  /** Sparkle of the light in the cracks. */
  sparkle: number;
  /** How milky the resin is: 0 is clear, 2 is thick with cloudy patches. */
  cloud: number;
  /** How deep and dark the amber's colour is (thickness of the resin). */
  depth: number;
  /** Subsurface scattering: how much the light spreads around the lamp inside the resin. */
  sss: number;
  /** Resolution of the rendering as a share of the screen's pixels (quality against speed). */
  quality: number;
};

export function createAmberParams(overrides: Partial<AmberParams> = {}): AmberParams {
  return { words: 34, lamp: 1, glow: 1, parallax: 1, inclusions: 1, sparkle: 1, cloud: 1, depth: 1, sss: 1, quality: .75, ...overrides };
}

export type SongFireParams = {
  /** Size of the flames. */
  flame: number;
  /** How hard the cursor blows on the fire. */
  wind: number;
  /** Amount of sparks. */
  sparks: number;
  /** How fast letters fly up to form the line. */
  letters: number;
  /** How long a finished line stays, seconds. */
  hold: number;
  /** Stars in the sky. */
  stars: number;
};

export function createSongFireParams(overrides: Partial<SongFireParams> = {}): SongFireParams {
  return { flame: 1, wind: 1, sparks: 1, letters: 1, hold: 4.5, stars: 1, ...overrides };
}
