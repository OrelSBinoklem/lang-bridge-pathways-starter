/** What the cursor is on the water: a hand that pushes it, or a cup with a hole in the bottom to scoop it with. */
export type SunWaterCursorTool = 'push' | 'vessel';
/** When the pushing cursor acts: only while the mouse button is held, or all the time. */
export type SunWaterPushWhen = 'press' | 'always';

/**
 * Everything the tuning panel writes into for the "Солнце и вода" effect. The effect reads the object
 * every frame, so sliders that only change how things look or move need no rebuild; `detail` and
 * `fieldScale` change what is built and are noticed by the frame loop.
 */
export type SunWaterParams = {
  // Water
  /** Particle count relative to the first version of this effect (2 = twice as many, each one smaller). Up to 30. */
  detail: number;
  /** 0 = the water keeps moving almost forever, 1 = it stops quickly. See `dragFromDamping`. */
  damping: number;
  /** Gentle rocking of the whole pool, so calm water is never perfectly still. */
  swell: number;
  /** How often the pool throws a splash by itself (1 = a splash every few seconds). */
  geysers: number;
  /** How high a splash throws the water (1 = gentle). */
  splashPower: number;
  /** Strength of the cursor's push. */
  pointerPush: number;
  /** Amount of flying spray. */
  spray: number;
  // Cursor
  cursorTool: SunWaterCursorTool;
  pushWhen: SunWaterPushWhen;
  /** Size of the cup (1 = default). */
  vesselSize: number;
  /** Width of the hole in the cup's bottom (1 = default). */
  vesselHole: number;
  /** How fast water seeps through that hole (1 = default, a scoop lasts a few seconds). */
  vesselLeak: number;
  // Look
  /** Small moving ripples on the surface. */
  ripple: number;
  /** White water on crests and where the water moves fast. */
  foam: number;
  /** Moving light patterns inside the water. */
  caustics: number;
  /** Opacity of the water body. */
  clarity: number;
  /** Resolution of the shaded water surface, as a share of the card size (quality/speed). */
  fieldScale: number;
  // Sun
  /** Strength of the sun's reflection on water and spray. */
  glint: number;
  /** Tightness of that reflection (higher = smaller, sharper highlights). */
  shininess: number;
  /** Twinkling sparks on the surface facing the sun. */
  sparkle: number;
};

/** Highest particle detail the panel offers. It is heavy: 30 means about 14 000 particles on a wide card. */
export const MAX_SUN_WATER_DETAIL = 30;

export function createSunWaterParams(overrides: Partial<SunWaterParams> = {}): SunWaterParams {
  return {
    detail: 10,
    damping: 0.12,
    swell: 0.25,
    geysers: 1,
    splashPower: 1,
    pointerPush: 1,
    spray: 1,
    cursorTool: 'push',
    pushWhen: 'press',
    vesselSize: 1,
    vesselHole: 1,
    vesselLeak: 1,
    ripple: 0.6,
    foam: 1,
    caustics: 0.35,
    clarity: 0.94,
    fieldScale: 0.55,
    glint: 1,
    shininess: 70,
    sparkle: 1,
    ...overrides,
  };
}

/** Share of velocity lost per frame. The first version of the effect had 0.008 (damping ≈ 0.447). */
export function dragFromDamping(damping: number): number {
  const d = Math.min(Math.max(damping, 0), 1);
  return d * d * 0.04;
}
