export type LiquidDropsPhoto = {
  label: string;
  src: string;
  /** Photographer, and the page the photo comes from (Unsplash License needs no credit; it is given anyway). */
  author: string;
  page: string;
  /** Where the crop sits when the photo is taller than the screen: 0 = top edge, 1 = bottom edge. */
  focusY: number;
};

const PHOTO_DIR = '/course/effects/liquid-drops';

/** Real photographs, kept in public/course/effects/liquid-drops/ (3840 px wide; portraits are cut to 4096 px tall). */
export const LIQUID_DROPS_PHOTOS = {
  'photo-sauna': {
    label: 'Фото · Сауна',
    src: `${PHOTO_DIR}/sauna.webp`,
    author: 'Clay Banks',
    page: 'https://unsplash.com/photos/xY6H6qv6HmI',
    focusY: 0.5,
  },
  'photo-hot-spring': {
    label: 'Фото · Источник',
    src: `${PHOTO_DIR}/hot-spring.webp`,
    author: 'Mariola Grobelska',
    page: 'https://unsplash.com/photos/PAQg3VkM0pM',
    focusY: 0.5,
  },
  'photo-forest-pool': {
    label: 'Фото · Тропики',
    src: `${PHOTO_DIR}/forest-pool.webp`,
    author: 'Bayu Syaits',
    page: 'https://unsplash.com/photos/DRoFdPw4pAg',
    focusY: 0.6,
  },
  'photo-mountain-pool': {
    label: 'Фото · Горы',
    src: `${PHOTO_DIR}/mountain-pool.webp`,
    author: 'Chulho Choi',
    page: 'https://unsplash.com/photos/IAd1oQ6OdkU',
    focusY: 0.5,
  },
  'photo-monstera': {
    label: 'Фото · Монстера',
    src: `${PHOTO_DIR}/monstera.webp`,
    author: 'Luise and Nic',
    page: 'https://unsplash.com/photos/hETU8_b2IM0',
    focusY: 0.55,
  },
  'photo-cave-pool': {
    label: 'Фото · Грот',
    src: `${PHOTO_DIR}/cave-pool.webp`,
    author: 'Priyanka Chechi',
    page: 'https://unsplash.com/photos/LBLZUCah2K4',
    focusY: 0.5,
  },
} satisfies Record<string, LiquidDropsPhoto>;

export type LiquidDropsPhotoId = keyof typeof LIQUID_DROPS_PHOTOS;
export type LiquidDropsScene = 'mountain-pools' | 'sauna' | 'spa-leaves' | 'grotto' | 'custom' | LiquidDropsPhotoId;

const PHOTO_LABELS = Object.fromEntries(
  Object.entries(LIQUID_DROPS_PHOTOS).map(([id, photo]) => [id, photo.label]),
) as Record<LiquidDropsPhotoId, string>;

/** Order here is the order in the panel's "Сцена" list. */
export const LIQUID_DROPS_SCENE_LABELS: Record<LiquidDropsScene, string> = {
  'mountain-pools': 'Бассейны в горах',
  sauna: 'Сауна / баня',
  'spa-leaves': 'Тропический спа',
  grotto: 'Грот-бассейн',
  ...PHOTO_LABELS,
  custom: 'Своя картинка',
};

const PROCEDURAL_SCENE_INDEX = { 'mountain-pools': 0, sauna: 1, 'spa-leaves': 2, grotto: 3 } as const;

/** What the background shader switches on (`uScene`): 0-3 are painted in GLSL, 4 is "show the loaded picture". */
export function liquidDropsSceneIndex(scene: LiquidDropsScene): number {
  return scene in PROCEDURAL_SCENE_INDEX ? PROCEDURAL_SCENE_INDEX[scene as keyof typeof PROCEDURAL_SCENE_INDEX] : 4;
}

/** The picture a scene needs (a bundled photo or the visitor's own), or null for the painted scenes. */
export function liquidDropsImage(scene: LiquidDropsScene, customImage: string): { src: string; focusY: number } | null {
  if (scene === 'custom') return customImage ? { src: customImage, focusY: 0.5 } : null;
  const photo = (LIQUID_DROPS_PHOTOS as Record<string, LiquidDropsPhoto>)[scene];
  return photo ? { src: photo.src, focusY: photo.focusY } : null;
}

/**
 * Everything the dat.GUI panel writes into. Lengths are in grid cells (one cell = the spacing
 * between neighbouring drops), so the look does not change with the screen size or the column count.
 */
export type LiquidDropsParams = {
  // Drops
  columns: number;
  /** Radius of a lone drop, in cells. */
  dropSize: number;
  /** Idle breathing/drift of the drops, 0 = still. */
  breathe: number;
  /** How far drops sit off the perfect lattice, in cells. */
  jitter: number;
  /** Spread of the drops' sizes, 0..1. */
  variation: number;
  // Merging
  /** 0 = separate drops, ~0.6 = drops joined by thin necks, ~0.7 = a network with small holes, 1 = one solid film. */
  merge: number;
  // Cursor
  cursor: boolean;
  /** Radius of the drop that follows the pointer, in cells. */
  cursorSize: number;
  /** How far the pointer drop pulls its neighbours, in cells. */
  pullRadius: number;
  pullStrength: number;
  /** 0 = stiff, 1 = wobbly jelly, up to 1.2 = barely damped. */
  jelly: number;
  // Glass
  /** Depth of the refracting bevel, in cells. */
  thickness: number;
  /** Index of refraction of the glass. */
  refraction: number;
  /** How far the background is displaced at the very edge, in cells. */
  refDistance: number;
  /** Strength of the lens formed by the bulge of each drop (magnifies what is under it). The shader uses a tenth of it, so 1 is already strong. */
  lens: number;
  dispersion: number;
  fresnel: number;
  fresnelRange: number;
  glare: number;
  /** Degrees; the direction the highlight comes from. */
  glareAngle: number;
  tint: number;
  tintColor: string;
  /** Radius of the frosted background seen through the glass, in cells. */
  blur: number;
  /** How much of the frosted background replaces the sharp one inside the glass. */
  frost: number;
  shadow: number;
  // Background
  scene: LiquidDropsScene;
  brightness: number;
  saturation: number;
  /** Speed of the background's own motion (steam, caustics); 0 freezes it. */
  motion: number;
  /** Object URL of a picture chosen in the panel, used when `scene` is 'custom'. */
  customImage: string;
  // Quality
  pixelRatioCap: number;
  bgScale: number;
};

/** The drop, cursor and glass settings a preset owns; the background and quality settings are left to the visitor. */
export type LiquidDropsLook = Pick<
  LiquidDropsParams,
  | 'columns' | 'dropSize' | 'breathe' | 'jitter' | 'variation' | 'merge'
  | 'cursor' | 'cursorSize' | 'pullRadius' | 'pullStrength' | 'jelly'
  | 'thickness' | 'refraction' | 'refDistance' | 'lens' | 'dispersion'
  | 'fresnel' | 'fresnelRange' | 'glare' | 'glareAngle'
  | 'tint' | 'tintColor' | 'blur' | 'frost' | 'shadow'
>;

/** The owner's second tuning, from the "Радужные капли" preset: rainbow-rimmed drops that cling to the cursor. This is the default. */
const RAINBOW: LiquidDropsLook = {
  columns: 32,
  dropSize: 0.3,
  breathe: 0.5,
  jitter: 0.15,
  variation: 0.4,
  merge: 0.175,
  cursor: true,
  cursorSize: 1.05,
  pullRadius: 4.1,
  pullStrength: 2,
  jelly: 1,
  thickness: 0.12,
  refraction: 1.9,
  refDistance: 0.35,
  lens: 0.07,
  dispersion: 1,
  fresnel: 0.3,
  fresnelRange: 0.07,
  glare: 0.5,
  glareAngle: 40,
  tint: 0,
  tintColor: '#bfeede',
  blur: 0,
  frost: 0,
  shadow: 0.35,
};

/** The owner's first tuning: small clear beads on a lattice, barely any rim light. */
const CLEAR_BEADS: LiquidDropsLook = {
  columns: 27,
  dropSize: 0.31,
  breathe: 0.4,
  jitter: 0.12,
  variation: 0,
  merge: 0,
  cursor: true,
  cursorSize: 1.5,
  pullRadius: 4,
  pullStrength: 0.85,
  jelly: 0.55,
  thickness: 0.31,
  refraction: 1.05,
  refDistance: 0.23,
  lens: 0.2,
  dispersion: 0.27,
  fresnel: 0,
  fresnelRange: 0.05,
  glare: 0,
  glareAngle: 40,
  tint: 0,
  tintColor: '#bfeede',
  blur: 0,
  frost: 0.14,
  shadow: 0.35,
};

export type LiquidDropsPreset = { label: string; look: LiquidDropsLook };

/** Every preset lists all its settings (built on a base look), so choosing one always gives the same result. */
export const LIQUID_DROPS_PRESETS: Record<string, LiquidDropsPreset> = {
  rainbow: { label: 'Радужные капли', look: RAINBOW },
  'clear-beads': { label: 'Чистые бусины', look: CLEAR_BEADS },
  'liquid-glass': {
    label: 'Жидкое стекло',
    look: {
      ...CLEAR_BEADS,
      columns: 30, dropSize: 0.32, breathe: 0.6, jitter: 0.14, variation: 0.6, merge: 0.62,
      thickness: 0.25, refraction: 1.55, refDistance: 0.25, lens: 0.5, dispersion: 0.5,
      fresnel: 0.55, fresnelRange: 0.08, glare: 0.6, tint: 0.12, blur: 0.35, frost: 0.25,
    },
  },
  dew: {
    label: 'Роса',
    look: {
      ...CLEAR_BEADS,
      columns: 46, dropSize: 0.27, breathe: 0.2, jitter: 0.3, variation: 1, merge: 0.18, cursorSize: 1.2,
      thickness: 0.3, refraction: 1.5, refDistance: 0.22, lens: 0.8, dispersion: 0.1,
      fresnel: 0.25, fresnelRange: 0.06, glare: 0.9, glareAngle: 55, blur: 0.2, frost: 0.1, shadow: 0.5,
    },
  },
  gel: {
    label: 'Густой гель',
    look: {
      ...CLEAR_BEADS,
      columns: 22, dropSize: 0.34, breathe: 0.8, jitter: 0.2, variation: 0.8, merge: 0.7,
      pullRadius: 5, pullStrength: 1.1, jelly: 0.8,
      thickness: 0.5, refraction: 1.7, refDistance: 0.3, lens: 0.6, dispersion: 0.35,
      fresnel: 0.4, fresnelRange: 0.1, glare: 0.5, tint: 0.18, tintColor: '#a8e6cf', blur: 0.5, frost: 0.35, shadow: 0.45,
    },
  },
  frosted: {
    label: 'Матовое стекло',
    look: {
      ...CLEAR_BEADS,
      columns: 24, dropSize: 0.34, breathe: 0.4, jitter: 0.1, variation: 0.3, merge: 0.6,
      thickness: 0.3, refraction: 1.4, refDistance: 0.2, lens: 0.2, dispersion: 0.1,
      fresnel: 0.5, fresnelRange: 0.1, glare: 0.4, tint: 0.2, tintColor: '#e6fff5', blur: 1, frost: 0.85, shadow: 0.3,
    },
  },
  'big-lenses': {
    label: 'Крупные линзы',
    look: {
      ...CLEAR_BEADS,
      columns: 12, dropSize: 0.38, breathe: 0.5, jitter: 0.1, variation: 0.5, merge: 0.5,
      cursorSize: 1.2, pullRadius: 3,
      thickness: 0.4, refraction: 1.8, refDistance: 0.45, lens: 1.2, dispersion: 0.5,
      fresnel: 0.35, fresnelRange: 0.08, glare: 0.7, tint: 0.05, blur: 0.3, frost: 0.1,
    },
  },
};

export const LIQUID_DROPS_DEFAULT_PRESET = 'rainbow';

export function createLiquidDropsParams(overrides: Partial<LiquidDropsParams> = {}): LiquidDropsParams {
  return {
    ...RAINBOW,
    scene: 'sauna',
    brightness: 1,
    saturation: 1.05,
    motion: 1,
    customImage: '',
    pixelRatioCap: 1.5,
    bgScale: 0.75,
    ...overrides,
  };
}
