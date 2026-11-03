import type { PointerState } from '../engine';
import { presetValues } from './kaleidoscopePresets';

/** The sliders every scene has (the tuning panel writes into this; scenes read it every frame). */
export type SceneParams = {
  /** Speed of everything that moves by itself. */
  speed: number;
  /** How strong the picture is (amount of light, particles, contrast: each scene decides). */
  intensity: number;
  /** How strongly the scene reacts to the cursor. */
  react: number;
  /** Turns all colours around the colour wheel, degrees. */
  hue: number;
  /** Shader scenes only: share of the screen's pixels that is shaded. */
  quality: number;
  /** A scene with more than one "screen" (like led-matrix's screensavers) reads this: 0 = pick automatically
   * (usually cycling on its own), 1, 2, 3… = a specific one, in the order the scene lists them. Scenes with a
   * single look ignore it. */
  preset: number;
  /** Lifelong-learning picture: -1 before activation, then 0…3 for this activation only. */
  lifeStory: number;
  /** Manual seven-page pop-up book, 0 = Monday. */
  weekBookDay: number;
  /** A scene with more than one physical look (like led-matrix's round lamps / square pixels / RGB chips)
   * reads this: 0, 1, 2… selects one, in the order the scene lists them. Scenes with a single look ignore it. */
  style: number;
  /** led-matrix only: how far the board is tipped/turned — 0 = a flat grid (no perspective, the pre-3D look),
   * 1 = the full tilt. Scenes without a 3D board ignore it. */
  tilt: number;
  /** led-matrix only: camera distance to the board — 1 = fits the card as before, higher = zoomed in (cropped
   * at the edges), lower = zoomed out (more empty card around it). Scenes without a 3D board ignore it. */
  zoom: number;
  /** Kinetic full-page scenes: independent motion, event and glow controls. */
  cinemaCamera: number;
  cinemaEvents: number;
  cinemaBloom: number;
  /** Platskart: 1 = the detailed look (denser mixed forest, birches, far tree line, flickering sun, more on the table). */
  platDetail: number;
  faceWidth: number;
  faceJaw: number;
  faceNose: number;
  faceEyes: number;
  faceMood: number;
  faceSkin: number;
  /** led-matrix only: the size/coarseness of each individual LED — 1 = as before, higher = fewer, bigger LEDs,
   * lower = more, smaller ones. Independent of `zoom` (the board's overall footprint stays put). Scenes without
   * this notion ignore it. */
  ledSize: number;
  gardenBranching: number;
  gardenSpread: number;
  gardenBend: number;
  gardenGravity: number;
  gardenCrown: number;
    gardenBloom: number;
    gardenLeafLength: number;
    gardenColorfulness: number;
    gardenOddity: number;
  gardenVariation: number;
  /** genome-garden: indexes into the curated genomes supplied in digiGarden.zip. */
  gardenGenomeA: number;
  gardenGenomeB: number;
  /** 0 = original A, 1 = by generation, 2 = by trait, 3 = by byte. */
  gardenCrossMode: number;
  gardenMutations: number;
  gardenScale: number;
  /** Genome garden: 0 = archive's all-byte random, 1 = structured random, 2 = archive crossing. */
  gardenGenerationMode: number;
  gardenSpeciesLeft: number;
  gardenSpeciesRight: number;
  gardenSeedLeft: number;
  gardenSeedRight: number;
  gardenGap: number;
  gardenRootY: number;
  /** Sparse edits into each tree's 26×14 DNA; feature 0 is reserved for format metadata. */
  gardenGeneOverrides: Record<number, number>[];
  gardenGenomeRevision: number;
  /** string-lights only: the 3D amber on the suitcases. */
  lightsAmber: boolean;
  /** string-lights only: which amber — 0 = the first one (a pebble with a beetle, straight on the suitcase),
   * 1 = the museum piece with a mosquito on a lit display base. */
  lightsAmberStyle: number;
  /** string-lights only: how fast the amber moves — the pebble turns round, the display piece rocks (0 = still). */
  lightsAmberSpin: number;
  /** string-lights only: brightness of the light inside the amber's display base. */
  lightsAmberGlow: number;
  /** string-lights only: 0 = the finished picture, 1 = the path-traced light alone, without the room's colours. */
  lightsView: number;
  /** string-lights only: smooth the light while it is still noisy; off shows the raw accumulated samples. */
  lightsDenoise: boolean;
  /** string-lights only: diffuse bounces after the direct light (0 = direct light only). */
  lightsBounces: number;
  /** string-lights only: bumped by the panel's restart button; the scene throws its accumulated light away when it changes. */
  lightsRestart: number;
  /** string-lights only: written by the scene — its sample counts, for the panel to show. */
  lightsStats: string;
  /** optics-lab: 0 = traced rays, 1 = the wave equation on a grid. */
  opticsMode: number;
  /** optics-lab: which set of pieces (see OPTICS_SET_LABELS). */
  opticsSet: number;
  /** optics-lab: colour of the cursor's laser — 0 white, 1 red, 2 green, 3 violet. */
  opticsLaser: number;
  /** optics-lab: how much the refractive index varies with colour, × real glass (spreads the rainbow). */
  opticsDispersion: number;
  /** optics-lab: pieces turn by themselves (R toggles it), at `opticsSpin` speed. */
  opticsAutoRotate: boolean;
  opticsSpin: number;
  /** optics-lab: speed of the light front crawling along the beams, × 650 px/s. */
  opticsBeamSpeed: number;
  /** optics-lab: brightness of the photon pulses streaming along the beams. */
  opticsPulses: number;
  /** optics-lab: bloom around the beams. */
  opticsGlow: number;
  /** optics-lab, waves: 0 = crests, 1 = time-averaged energy, 2 = both. */
  opticsWaveView: number;
  /** optics-lab, waves: grid cell size, css px (smaller = finer and heavier). */
  opticsWaveCell: number;
  /** optics-lab, waves: simulation steps per frame, × 8. */
  opticsWaveSpeed: number;
  /** optics-lab: bumped by the panel; the lasers switch on again from scratch. */
  opticsRestart: number;
  /** optics-lab: written by the scene, for the panel. */
  opticsStats: string;
  /** nixie-clock: the camera orbiting the clock — turn and tilt (degrees, dragging the scene changes them too), zoom
   * (1 = the default framing) and a slow turn on its own. */
  nixieYaw: number;
  nixiePitch: number;
  nixieZoom: number;
  nixieAutoRotate: boolean;
  /** nixie-clock, ray tracing: live (traced every frame from the lit digits) or baked (per tube, then re-weighted);
   * samples per light-map texel to bake up to, diffuse bounces, light-map size (texels per side), smoothing of young
   * maps, 0 = the picture / 1 = the light alone; bumped to bake again; written by the scene for the panel. */
  nixieLive: boolean;
  nixieSpp: number;
  nixieBounces: number;
  nixieLightmap: number;
  nixieDenoise: boolean;
  nixieView: number;
  nixieRestart: number;
  nixieStats: string;
  /** nixie-clock, light and materials: the tubes' glow, the room's light, varnish gloss and blur, glass reflections, bloom. */
  nixieGlow: number;
  nixieRoom: number;
  nixieGloss: number;
  nixieRough: number;
  nixieGlass: number;
  nixieBloom: number;
  /** kaleidoscope: ray-traced glass (false = the earlier flat drawing), how far the light follows the cursor (0 = not
   * at all), exposure, colour saturation, glints' strength, the glow round bright glints and their six-ray stars,
   * rainbow fringes (dispersion, × real glass), the shards' rounded edges (mm), how hard a yank tosses the pieces, and
   * after how many quiet seconds the pile freezes where it lies (0: never). */
  kalRays: boolean;
  kalLightFollow: number;
  kalExposure: number;
  kalSaturation: number;
  kalSparkle: number;
  kalGlow: number;
  kalStars: number;
  kalDispersion: number;
  kalBevel: number;
  kalToss: number;
  kalFreeze: number;
  /** kaleidoscope: which set of pieces fills the drum (index into PIECE_SETS, kaleidoscopeSets.ts), and how the pieces
   * spread over the window (0: they slide down into a heap round the hexagons' centres, 1: evenly, where they fall). */
  kalSet: number;
  kalSpread: number;
  /** kaleidoscope: whether the lamp follows the cursor (how far: kalLightFollow; off by default, since every move
   * restarts the refinement), how many traces the still picture averages, and a counter the tuning panel bumps to
   * open the window with the set's pieces. */
  kalLightCursor: boolean;
  kalSamples: number;
  kalShowSet: number;
  /** kaleidoscope: how much the light darkens towards the hexagons' edges (1: as designed, 0: none), and the
   * eyepieces' size — on wider screens and on phones (720 px wide and less) separately. */
  kalVignette: number;
  kalScale: number;
  kalScaleMobile: number;
  /** kaleidoscope on an HDR display: the monitor's peak in multiples of SDR white (set with the calibration strip; 1:
   * HDR off; it only limits the brightest glints), how bright the picture's white is (paper white), and how strongly
   * the highlights rise above it. */
  kalHdrPeak: number;
  kalHdrWhite: number;
  kalHdrGlints: number;
  /** kaleidoscope: colour saturation in HDR (Windows shows sRGB colours accurately in HDR, paler than a wide-gamut
   * monitor's stretched SDR), and whether the brightness histogram is shown. */
  kalHdrSaturation: number;
  kalHistogram: boolean;
  /** kaleidoscope in HDR: the glow and the stars round the glints, as a share of their SDR strength (in HDR the glints
   * themselves are bright, the halo that stands in for that brightness in SDR is mostly not needed). */
  kalHdrBloom: number;
  /** kaleidoscope in HDR: how much the glints' light lights the glass round them (in each pane's own colour). */
  kalHdrSpill: number;
  /** fountain: the jet's speed at the nozzle (m/s), wind across the view (m/s), sun strength, exposure, reflections
   * on the water, how murky the water is, foam, caustics on the basin floor, the camera's shutter for the falling
   * water (ms). */
  fntJet: number;
  fntWind: number;
  fntSun: number;
  fntExposure: number;
  fntReflect: number;
  fntTint: number;
  fntFoam: number;
  fntCaustics: number;
  fntShutter: number;
  /** fountain: the falling water (0 particles, 1 glass threads as before, 2 hybrid: threads breaking into particles),
   * where the streams break up in the hybrid (a share of their flight), drop size (×), smoothing (px), whiteness of the
   * aerated water. */
  fntWater: number;
  fntBreak: number;
  fntDrop: number;
  fntSmooth: number;
  fntAir: number;
  /** Experimental basin optics, kept off in the course until approved. */
  fntPool: number;
  /** glass-fountain: neon brightness, how fast its colour flows, its base hue (°), the lotus's warm lamp, the key
   * light, exposure, mist, glow, how far the camera follows the cursor, render scale. */
  gfNeonI: number;
  gfNeonSpeed: number;
  gfHue: number;
  gfWarm: number;
  gfKey: number;
  gfExposure: number;
  gfMist: number;
  gfGlow: number;
  gfOrbit: number;
  /** glass-fountain: the camera (0 drifts after the cursor, 1 turned by dragging), its turn and tilt (degrees) and zoom;
   * the particles' water: detail (more, smaller drops), smoothing passes, how much the water tints what is behind. */
  gfCamera: number;
  gfYaw: number;
  gfPitch: number;
  gfZoom: number;
  gfDetail: number;
  gfPasses: number;
  gfAbsorb: number;
  gfScale: number;
  /** glass-fountain: rendering (0 full ray tracing, 1 light, 2 none), every other row a frame (0/1), the water (0 as
   * before, 1 live film, 2 particles), the particles' flow (×), adhesion to the ball (cm/s²), how unsteady the pour is,
   * drop size (×), smoothing (×). */
  gfRender: number;
  gfInterlace: number;
  gfWater: number;
  gfRate: number;
  gfAdhesion: number;
  gfWobble: number;
  gfViscosity: number;
  gfDrop: number;
  gfSmooth: number;
  /** dragon-smoke: how much smoke, how heavy, how long it lives (s), swirl, the key light, the smoke's shadow, its inner
   * glow, exposure. */
  dsRate: number;
  dsHeavy: number;
  dsLife: number;
  dsSwirl: number;
  dsLight: number;
  dsShadow: number;
  dsGlow: number;
  dsExposure: number;
  /** dragon-burner: the model (0 the dragon on its castle, 1 the mountain with the mill, 2 the rock with the falls; see
   * BURNER_MODELS), how much smoke, how heavy it is, how freely the air moves, how fast it leaves the source, swirl,
   * lifetime (s), the key light, how dense it looks, exposure. */
  dbModel: number;
  dbAmount: number;
  dbHeavy: number;
  dbFlow: number;
  dbSpread: number;
  dbSwirl: number;
  dbLife: number;
  dbLight: number;
  dbDensity: number;
  dbExposure: number;
  /** dragon-burner: the smoke's grid (index in GRID_LEVELS), the camera's switch (0 fixed, 1 turned by the mouse), its
   * turn (°), tilt (°) and zoom (×); the smoke's drawing: its picture's size (× canvas), the march's precision (×),
   * powder, noise detail, how much of the frame before is kept, its shadow on the model. */
  dbGrid: number;
  dbCamera: number;
  dbYaw: number;
  dbPitch: number;
  dbZoom: number;
  dbSmokeRes: number;
  dbStep: number;
  dbPowder: number;
  dbDetail: number;
  dbTaa: number;
  dbShade: number;
  /** dragon-burner: how strongly the smoke clings to a model's channel (the falls), × its weight. */
  dbCling: number;
  /** dragon-burner, speed: skip empty blocks in the smoke's march (0/1), the pressure solver (0 Jacobi, 1 red-black
   * SOR) and its passes, step the smoke every other frame (0/1), lower the smoke's resolution by itself when frames are
   * slow (0/1). */
  dbSkip: number;
  /** voxel-led-cube: the variant (0 the cube, 1 snowman, 2 reindeer, 3 showcase); the figures' programme (0 auto, 1…5
   * held), steady glow, play of lights, speed, bloom, the curtain of lights behind, snow, the beat (0/1), the showcase
   * cube counting down to the New Year (0/1), exposure. */
  /** The 3D scenes' camera control (orbitControl.ts): on (0/1), turn and tilt from the scene's own view (degrees),
   * zoom (×). */
  camOn: number;
  camYaw: number;
  camPitch: number;
  camZoom: number;
  lcMode: number;
  /** Leisure only: 0 = none, 1 = preserved flat reactor, 2 = rigid-body 3D Skyline beside the fullscreen cube. */
  leisurePinball: number;
  /** snow-lantern: the lantern (0 bronze, 1 teal barn, 2 candle arch), the pump (0 side walls, 1 middle, 2 one wall), the
   * glitter's colour, what is shown; glitter amount, size, share of snow, pump, swirls, sinking, sparkle; the lantern's light,
   * the candles' flicker, bloom, exposure; baked: the room's light, zoom, samples per pixel, resolution. */
  nlModel: number;
  /** The snow lantern: 0 one, 1 the pair over the whole screen (bronze left, teal right). */
  nlPair: number;
  nlPump: number;
  nlPalette: number;
  nlView: number;
  nlGlitter: number;
  nlSize: number;
  nlSnow: number;
  nlPumpSpeed: number;
  nlSwirl: number;
  nlSettle: number;
  nlSparkle: number;
  nlLight: number;
  nlFlicker: number;
  nlBloom: number;
  nlExposure: number;
  nlRoom: number;
  nlZoom: number;
  nlSamples: number;
  nlRes: number;
  lfProgram: number;
  lfBase: number;
  lfPlay: number;
  lfSpeed: number;
  lfBloom: number;
  lfCurtain: number;
  lfSnow: number;
  lfBeat: number;
  lfCountdown: number;
  lfExposure: number;
  dbSolver: number;
  dbPasses: number;
  dbHalfRate: number;
  dbAuto: number;
  /** gems: the stone (index in GEMS, dearest first), the backing (0 fabric, 1 rock, 2 setting), cell size (desktop,
   * phone), the lamp's height (css px), intensity and warmth, the studio light, fire (× dispersion), glow, stars, how
   * much the cells' stones are turned, exposure, resolution. */
  gmGem: number;
  gmBacking: number;
  /** 0 the fast pass, 1 ray traced (gemsGL.ts). */
  gmTrace: number;
  gmCell: number;
  gmCellMobile: number;
  gmLampH: number;
  gmLampI: number;
  gmWarm: number;
  gmStudio: number;
  gmFire: number;
  gmGlow: number;
  gmStars: number;
  gmSpin: number;
  gmExposure: number;
  gmRes: number;
  /** Zero-gravity drop: 0 original single experiment, 1 right-hand card / independent course-side pair. */
  zgLayout: number;
  /** fogged-glass: how misted the glass gets, how fast the mist comes back, drops (how many), their size, the wipe's
   * width (css px), how strong the smears are, the street's lights, bokeh size, traffic, exposure, resolution. */
  fgFog: number;
  fgRegrow: number;
  fgDrops: number;
  fgDropSize: number;
  fgWipe: number;
  fgSmudge: number;
  fgLights: number;
  fgBokeh: number;
  fgTraffic: number;
  fgExposure: number;
  fgRes: number;
  /** fogged-glass: how out of focus the street is through clear glass (0 sharp … 1 bokeh). */
  fgFocus: number;
  /** fogged-glass: the mist's blur (0 … 2), how milky it is, how long a drop's trail stays clear, puddles on the asphalt. */
  fgBlur: number;
  fgVeil: number;
  /** fogged-glass: the condensation's fine grain over the mist (0 a plain blur). */
  fgGrain: number;
  /** fogged-glass: how the street is made (0 live, 1 baked, 2 looped video). */
  fgStreet: number;
  fgTrail: number;
  fgPuddles: number;
};

export function createSceneParams(overrides: Partial<SceneParams> = {}): SceneParams {
  return {
    speed: 1, intensity: 1, react: 1, hue: 0, quality: 0.75, preset: 0, lifeStory: -1, weekBookDay: 0, style: 0, tilt: 1, zoom: 1, ledSize: 1,
    gardenBranching: 0.28, gardenSpread: 0.66,
    gardenBend: 0.45, gardenGravity: 0.18, gardenCrown: 0.9, gardenBloom: 0.9,
    gardenLeafLength: 1, gardenVariation: 0.75, gardenColorfulness: 1.25, gardenOddity: 0.62,
    gardenGenomeA: 0, gardenGenomeB: 1, gardenCrossMode: 0, gardenMutations: 0, gardenScale: 1,
    gardenGenerationMode: 0, gardenSpeciesLeft: 0, gardenSpeciesRight: 0,
    gardenSeedLeft: Math.random(), gardenSeedRight: Math.random(), gardenGap: 1, gardenRootY: 0.79,
    gardenGeneOverrides: [{}, {}], gardenGenomeRevision: 0,
    lightsAmber: true, lightsAmberStyle: 0, lightsAmberSpin: 0.15, lightsAmberGlow: 1, lightsView: 0, lightsDenoise: true, lightsBounces: 2, lightsRestart: 0, lightsStats: '',
    opticsMode: 0, opticsSet: 0, opticsLaser: 0, opticsDispersion: 4, opticsAutoRotate: false, opticsSpin: 0.35,
    opticsBeamSpeed: 1, opticsPulses: 0.6, opticsGlow: 1, opticsWaveView: 2, opticsWaveCell: 2, opticsWaveSpeed: 1,
    opticsRestart: 0, opticsStats: '',
    nixieYaw: 0, nixiePitch: 10, nixieZoom: 1, nixieAutoRotate: false,
    nixieLive: false, nixieSpp: 64, nixieBounces: 1, nixieLightmap: 512, nixieDenoise: true, nixieView: 0, nixieRestart: 0, nixieStats: '',
    nixieGlow: 1, nixieRoom: 0.7, nixieGloss: 1, nixieRough: 0.35, nixieGlass: 1, nixieBloom: 1,
    // The kaleidoscope starts with its first preset ("Блестяшка").
    ...presetValues(0),
    kalSet: 0, kalSpread: 0.5, kalLightCursor: false, kalSamples: 256, kalShowSet: 0,
    kalScale: 1.5, kalScaleMobile: 1.5, kalHdrPeak: 2, kalHdrWhite: 1, kalHdrGlints: 0.5, kalHdrSaturation: 1.15, kalHistogram: false, kalHdrBloom: 0.2, kalHdrSpill: 1.95,
    fntJet: 7, fntWind: 0.4, fntSun: 1, fntExposure: 1, fntReflect: 1, fntTint: 1.3, fntFoam: 1, fntCaustics: 1, fntShutter: 22, fntWater: 2, fntBreak: 0.45, fntDrop: 1, fntSmooth: 1.5, fntAir: 1, fntPool: 0,
    gfNeonI: 1.3, gfNeonSpeed: 0.6, gfHue: 262, gfWarm: 1.7, gfKey: 0.9, gfExposure: 1.1, gfMist: 1.3, gfGlow: 0.8, gfOrbit: 0.6, gfCamera: 0, gfYaw: -22, gfPitch: 14, gfZoom: 1, gfDetail: 1.5, gfPasses: 3, gfAbsorb: 1, gfScale: 0.6, gfRender: 1, gfInterlace: 0, gfWater: 2, gfRate: 1, gfAdhesion: 450, gfWobble: 1, gfViscosity: 40, gfDrop: 1, gfSmooth: 1,
    dsRate: 1.5, dsHeavy: 0.8, dsLife: 8, dsSwirl: 0.3, dsLight: 1.2, dsShadow: 1, dsGlow: 1, dsExposure: 1,
    dbModel: 0, dbAmount: 1, dbHeavy: 3, dbFlow: 4, dbSpread: 3, dbSwirl: 0.35, dbLife: 40, dbLight: 1, dbDensity: 1, dbExposure: 1, dbGrid: 1, dbCamera: 0, dbYaw: 0, dbPitch: 0, dbZoom: 1, dbSmokeRes: 0.5, dbStep: 1, dbPowder: 0, dbDetail: 0, dbTaa: 0, dbShade: 0.65, dbCling: 3, nlModel: 0, nlPair: 1, nlPump: 0, nlPalette: 0, nlView: 0, nlGlitter: 1, nlSize: 1, nlSnow: 0.3, nlPumpSpeed: 1, nlSwirl: 1, nlSettle: 1, nlSparkle: 1, nlLight: 1, nlFlicker: 1, nlBloom: 1, nlExposure: 1.1, nlRoom: 1, nlZoom: 1, nlSamples: 24, nlRes: 1, camOn: 0, camYaw: 0, camPitch: 0, camZoom: 1, lcMode: 0, lfProgram: 0, lfBase: 1, lfPlay: 1, lfSpeed: 1, lfBloom: 1.1, lfCurtain: 1, lfSnow: 1, lfBeat: 0, lfCountdown: 1, lfExposure: 1, dbSkip: 1, dbSolver: 1, dbPasses: 26, dbHalfRate: 0, dbAuto: 0,
    gmGem: 8, gmBacking: 0, gmTrace: 0, gmCell: 1.4, gmCellMobile: 1.2, gmLampH: 420, gmLampI: 1.4, gmWarm: 0.2, gmStudio: 1, gmFire: 1.6, gmGlow: 0.8, gmStars: 0.7, gmSpin: 0.15, gmExposure: 1, gmRes: 1, zgLayout: 0,
    fgFog: 0.92, fgRegrow: 0.02, fgDrops: 1, fgDropSize: 1, fgWipe: 55, fgSmudge: 1, fgLights: 1.2, fgBokeh: 1, fgTraffic: 1, fgExposure: 1.1, fgRes: 1, fgFocus: 0.12, fgBlur: 1.4, fgVeil: 3, fgGrain: 1, fgStreet: 1, fgTrail: 0, fgPuddles: 1,
    cinemaCamera: 0.45, cinemaEvents: 1, cinemaBloom: 0.45, platDetail: 0, leisurePinball: 0,
    faceWidth: 1, faceJaw: 1, faceNose: 1, faceEyes: 1, faceMood: 0.4, faceSkin: 0.48,
    ...overrides,
  };
}

/** The cursor as scenes see it: in px of the scene, top left origin, and smoothed. When nobody is pointing it wanders. */
export type ScenePointer = {
  x: number;
  y: number;
  /** Unsmoothened cursor, for direct manipulation during a short drag. */
  rawX: number;
  rawY: number;
  /** Speed, px/s. */
  vx: number;
  vy: number;
  /** A real cursor is over the scene (otherwise x, y wander by themselves). */
  active: boolean;
  /** Left button (or a finger) down. */
  pressed: boolean;
  /** True for one frame after a press begins. */
  clicked: boolean;
};

export type SceneCtx = {
  /** Interface language for decorative copy; Latvian learning text stays Latvian. */
  locale?: 'ru' | 'uk';
  /** False when the course has hidden its central content for effect focus. */
  contentVisible?: boolean;
  width: number;
  height: number;
  dpr: number;
  /** CSS colours of the chosen palette. */
  palette: string[];
  params: SceneParams;
  /** Drawn on a whole page, not on a card: scenes may be sparser and less busy. */
  body: boolean;
  /** Independent side of a fullscreen background; absent for original card scenes. */
  region?: 'full' | 'left' | 'right';
  /** Camera chrome belongs in previews/focus mode, not over course lesson controls. */
  cameraControls?: boolean | 'below-toolbar';
  /** Live visibility; input handlers must not use stale hover state while paused. */
  isVisible?: () => boolean;
  /** Embedded controls, including shared orbit chrome, use physical touch coordinates. */
  registerPointerControl?: (hitTest: (x: number, y: number) => boolean) => void;
  /** Repeatable random numbers, 0 <= r < 1. */
  rand: () => number;
};

export type SceneInstance = {
  /** Canvas controls stay under the finger while the scene uses the elevated touch aim. */
  isControlPoint?(x: number, y: number): boolean;
  /** Event-driven visibility for native video/other work outside the canvas RAF. */
  setVisible?(visible: boolean): void;
  /** Progressive startup may still need frames even when the final picture must be static. */
  ready?(): boolean;
  update(dt: number, t: number, pointer: ScenePointer): void;
  draw(g: CanvasRenderingContext2D): void;
  /** Frees what the canvas can't (a WebGL context of its own) when the scene is unmounted or rebuilt. */
  dispose?(): void;
};

export type CanvasSceneDef = {
  kind: 'canvas';
  id: string;
  label: string;
  palettes: string[][];
  /** A still composition: render on load/resize/selection, then stop the frame loop. */
  static?: boolean;
  /** Panel starting values for just this scene (e.g. led-matrix ships tuned for its glass LEDs, board flat)
   * — merged under `createSceneParams()`'s own defaults, so a scene only needs to name what it wants different. */
  defaultParams?: Partial<SceneParams>;
  /** Static scenes need only one draw when reduced motion is requested; simulations may need a preroll. */
  warmupFrames?: number;
  /** Opt-in high-density canvas; legacy scenes keep their existing pixel budget. */
  pixelRatioCap?: number;
  create(ctx: SceneCtx): SceneInstance;
};

export type ShaderSceneDef = {
  kind: 'shader';
  id: string;
  label: string;
  palettes: string[][];
  defaultParams?: Partial<SceneParams>;
  /** Opt-in resolution policy; existing course shaders retain their historical budget. */
  pixelBudget?: number;
  pixelRatioCap?: number;
  adaptiveQuality?: boolean;
  /** GLSL: `vec3 scene(vec2 uv, vec2 P, vec2 M, float t)`, see shaderLib.ts. */
  fragment: string;
};

export type LoadedSceneDef = CanvasSceneDef | ShaderSceneDef;
/** Catalog metadata is cheap; shader strings, physics and models load only when this scene is mounted. */
export type LazySceneDef = Omit<CanvasSceneDef, 'kind' | 'create'> & {
  kind: 'lazy'; sourceKind: LoadedSceneDef['kind']; load: () => Promise<LoadedSceneDef>;
  pixelBudget?: number; adaptiveQuality?: boolean;
};
export type SceneDef = LoadedSceneDef | LazySceneDef;

export type { PointerState };
