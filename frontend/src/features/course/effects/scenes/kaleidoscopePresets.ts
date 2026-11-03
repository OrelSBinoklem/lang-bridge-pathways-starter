import type { SceneParams } from './types';

/** The look — not the drum's contents (the set, how the pieces spread), nor whether the light follows the cursor, how
 * long the still picture is refined, or the preview's counter. */
type KalKey = Exclude<Extract<keyof SceneParams, `kal${string}`>, 'kalSet' | 'kalSpread' | 'kalLightCursor' | 'kalSamples' | 'kalShowSet' | 'kalScale' | 'kalScaleMobile' | 'kalHdrPeak' | 'kalHdrWhite' | 'kalHdrGlints' | 'kalHdrSaturation' | 'kalHistogram' | 'kalHdrBloom' | 'kalHdrSpill'>;
/** Everything the kaleidoscope's presets set (see KALEIDOSCOPE_SETTINGS in kaleidoscope.ts). */
export type KaleidoscopeLook = Pick<SceneParams, KalKey>;

/** The kaleidoscope's presets. The first one is the default (createSceneParams). */
export const KALEIDOSCOPE_PRESETS: readonly { id: string; label: string; values: KaleidoscopeLook }[] = [
  {
    // Bright and flashy: the light swings far with the cursor, strong glints and rainbow edges, hard tosses.
    id: 'sparkly',
    label: 'Блестяшка',
    values: {
      kalRays: true, kalLightFollow: 2, kalExposure: 2.65, kalSaturation: 1.3, kalSparkle: 1.5, kalGlow: 0.5, kalStars: 1.05,
      kalDispersion: 6, kalBevel: 0.5, kalToss: 3, kalFreeze: 2, kalVignette: 0,
    },
  },
  {
    id: 'standard',
    label: 'Стандартный',
    values: {
      kalRays: true, kalLightFollow: 0.6, kalExposure: 1.8, kalSaturation: 1.5, kalSparkle: 2, kalGlow: 0.7, kalStars: 0.8,
      kalDispersion: 4, kalBevel: 0.35, kalToss: 1, kalFreeze: 2, kalVignette: 0,
    },
  },
];

/**
 * On an SDR display the glints' rays are toned down (owner: «подуменьши дефолтные блики для всех подэффектов но только
 * для SDR»): this lies over every preset there (the defaults included); HDR keeps the presets as they are.
 */
export const SDR_LOOK: Partial<KaleidoscopeLook> = { kalStars: 0.3 };
export function isSdrDisplay() {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && !window.matchMedia('(dynamic-range: high)').matches;
  } catch {
    return false;
  }
}
/** A preset's values for this display (SDR_LOOK over them on an SDR one). */
export function presetValues(index: number): KaleidoscopeLook {
  return { ...KALEIDOSCOPE_PRESETS[index].values, ...(isSdrDisplay() ? SDR_LOOK : {}) };
}

/** Which preset the settings match exactly (with the piece set's own look over it, PieceSet.look), or −1 (changed by
 * hand). */
export function kaleidoscopePresetIndex(params: KaleidoscopeLook, overlay: Partial<KaleidoscopeLook> = {}): number {
  return KALEIDOSCOPE_PRESETS.findIndex((_, index) => {
    const want = { ...presetValues(index), ...overlay };
    return (Object.keys(want) as KalKey[]).every((key) => Math.abs(Number(params[key]) - Number(want[key])) < 1e-6);
  });
}
