import type { SceneDef } from './types';
import { SHADER_SCENES } from './shaderScenes';
import { CANVAS_SCENES_1 } from './canvasScenes1';
import { CANVAS_SCENES_2 } from './canvasScenes2';
import { CANVAS_SCENES_3 } from './canvasScenes3';
import { CANVAS_SCENES_4 } from './canvasScenes4';
import { CANVAS_SCENES_5 } from './canvasScenes5';
import { CANVAS_SCENES_6 } from './canvasScenes6';
import { PIXEL_HOURGLASS } from './pixelHourglass';
import { HOURGLASS_3D } from './hourglass3d';
import { VOXEL_LED_CUBE, PINBALL_REACTOR_CLASSIC, PINBALL_SKYLINE } from './ledCube';
import { FIREWORKS_SHOW } from './fireworks3d';
import { GENOME_GARDEN } from './genomeGarden';
import { NEON_SIGNS } from './neonSigns';
import { OPTICS_LAB } from './opticsLab';
import { GREETINGS_SPARKLER } from './greetingsSparkler';
import { PATIENT_MONITOR } from './patientMonitor';
import { FORGE_ANVIL } from './forgeAnvil';
import { BALLOON_BUNCH } from './balloonBunch';
import { NIGHT_HIGHWAY, HIGHWAY_PANORAMA } from './nightHighway';
import { PHOTO_GARLAND } from './photoGarland';
import { TRAIT_CONSTELLATIONS } from './traitConstellations';
import { ISO_TOWN } from './isoTown';
import { PLANNER_DESK } from './plannerDesk';
import { GEAR_TRAIN } from './gearTrain';
import { LEVEL_MOUNTAIN } from './levelMountain';
import { LCD_SCREEN } from './lcdScreen';
import { NIXIE_CLOCK } from './nixieClock';
import { SAND_ART } from './sandArt';
import { MANDALA_DRAW } from './mandalaDraw';
import { KALEIDOSCOPE } from './kaleidoscope';
import { FOUNTAIN_SCENE, FOUNTAIN_YARD } from './fountain';
import { GLASS_FOUNTAIN } from './glassFountain';
import { DRAGON_SMOKE } from './dragonSmoke';
import { DRAGON_BURNER, DRAGON_BURNER_CARD, DRAGON_BURNER_PAIR } from './dragonBurner';
import { FIREFLIES } from './fireflies';
import { WEEK_GARDENS, FOLDING_HOME } from './livingDioramas';
import { WEEK_BOOK } from './weekBook';
import { FAMILY_CAMPFIRE } from './familyCampfire';
import { DAY_ASTROLABE } from './dayAstrolabe';
import { SPIRAL_LIBRARY } from './spiralLibrary';
import { SNOW_GLOBE } from './snowGlobe';
import { GEMS_SCENE } from './gems';
import { FOGGED_GLASS, FOGGED_BLACKHEADS } from './foggedGlass';
import { PROM_BOARD } from './promBoard';
import { SNOW_LANTERN } from './snowLantern';
import { LIQUID_TIMER } from './liquidTimer';
import { ZERO_GRAVITY_DROP } from './zeroGravityDrop';
import { DOMINO_CASCADE } from './dominoCascade';
import { DOMINO_WORKSHOP } from './dominoWorkshop';
import { DOMINO_ARCHIPELAGO } from './dominoArchipelago';
import { CINEMATIC_SCENES } from './cinematic';
import { LIFELONG_SCENES } from './lifelongStories';
import { SHOWCASE_SCENES, STUDY_SCENES } from '../shader-lab/scenes';

export const ALL_SCENES: SceneDef[] = [
  ...SHADER_SCENES,
  ...CANVAS_SCENES_1,
  ...CANVAS_SCENES_2,
  ...CANVAS_SCENES_3,
  ...CANVAS_SCENES_4,
  ...CANVAS_SCENES_5,
  ...CANVAS_SCENES_6,
  HOURGLASS_3D,
  VOXEL_LED_CUBE,
  PINBALL_REACTOR_CLASSIC,
  PINBALL_SKYLINE,
  FIREWORKS_SHOW,
  PIXEL_HOURGLASS,
  GENOME_GARDEN,
  NEON_SIGNS,
  OPTICS_LAB,
  GREETINGS_SPARKLER,
  PATIENT_MONITOR,
  FORGE_ANVIL,
  BALLOON_BUNCH,
  NIGHT_HIGHWAY,
  HIGHWAY_PANORAMA,
  PHOTO_GARLAND,
  TRAIT_CONSTELLATIONS,
  ISO_TOWN,
  PLANNER_DESK,
  GEAR_TRAIN,
  LEVEL_MOUNTAIN,
  LCD_SCREEN,
  NIXIE_CLOCK,
  SAND_ART,
  MANDALA_DRAW,
  KALEIDOSCOPE,
  PROM_BOARD,
  FOUNTAIN_SCENE,
  FOUNTAIN_YARD,
  GLASS_FOUNTAIN,
  DRAGON_SMOKE,
  DRAGON_BURNER,
  DRAGON_BURNER_CARD,
  DRAGON_BURNER_PAIR,
  FIREFLIES,
  WEEK_GARDENS,
  FOLDING_HOME,
  WEEK_BOOK,
  FAMILY_CAMPFIRE,
  DAY_ASTROLABE,
  SPIRAL_LIBRARY,
  SNOW_GLOBE,
  GEMS_SCENE,
  FOGGED_GLASS,
  FOGGED_BLACKHEADS,
  SNOW_LANTERN,
  LIQUID_TIMER,
  ZERO_GRAVITY_DROP,
  DOMINO_CASCADE,
  DOMINO_WORKSHOP,
  DOMINO_ARCHIPELAGO,
  ...CINEMATIC_SCENES,
  ...LIFELONG_SCENES,
  ...SHOWCASE_SCENES,
  ...STUDY_SCENES,
];

const BY_ID = new Map(ALL_SCENES.map((scene) => [scene.id, scene]));

export function getScene(id: string): SceneDef | null {
  return BY_ID.get(id) ?? null;
}
