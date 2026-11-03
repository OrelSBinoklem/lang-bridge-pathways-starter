import type { SceneParams } from './types';
import { clamp } from './kit';
import { makeRandom } from './pointer';
import { decodeGenome, GENOME_PRESETS } from './genomeGardenPresets';

export const GARDEN_FEATURES = 26;
export const GARDEN_COLUMNS = 14;
export const GARDEN_FORM_COUNT = 11;

/** Row numbers and meanings are kept aligned with constant.pde in the owner's archive. */
export const GARDEN_GENE_LABELS = [
  'Начало / RGB', 'Красный', 'Зелёный', 'Синий', 'Цвет от родителя',
  'Разброс цвета', 'Изменение R', 'Изменение G', 'Изменение B',
  'Случайный поворот', 'Поворот за шаг', 'Ускорение поворота',
  'Угол дочерних ветвей', 'Разброс угла детей', 'Начальная толщина',
  'Толщина от родителя', 'Толщина от уровня', 'Разброс толщины',
  'Изменение толщины', 'Длина побега', 'Длина от уровня',
  'Разброс длины', 'Число потомков', 'Особый следующий ген', 'Тяга вверх / вниз',
] as const;

const address = (column: number, feature: number) => column * GARDEN_FEATURES + feature;
const byte = (value: number) => Math.round(clamp(value, 0, 255));
const pick = (random: () => number, lo: number, hi: number) => lo + random() * (hi - lo);
const blend = (a: number, b: number, t: number) => a + (b - a) * t;
const seedValue = (value: number) => Math.floor(clamp(value, 0, 1) * 0xffffffff);
const set = (dna: Uint8Array, column: number, feature: number, value: number) => { dna[address(column, feature)] = byte(value); };

function metadata(dna: Uint8Array) {
  set(dna, 0, 0, GARDEN_FEATURES);
  set(dna, 1, 0, GARDEN_COLUMNS);
  set(dna, 2, 0, 10);
}

/** Literal browser equivalent of set_random_DNA(): 24×14 independent trait bytes, plus four start bytes. */
function rawRandomGenome(seed: number): Uint8Array {
  const random = makeRandom(seed);
  const dna = new Uint8Array(GARDEN_FEATURES * GARDEN_COLUMNS);
  metadata(dna);
  for (let column = 0; column < 4; column += 1) set(dna, column, 1, random() * 256);
  for (let column = 0; column < GARDEN_COLUMNS; column += 1) {
    for (let feature = 2; feature < GARDEN_FEATURES; feature += 1) set(dna, column, feature, random() * 256);
  }
  return dna;
}

function hsl(hue: number, saturation: number, lightness: number): [number, number, number] {
  const h = ((hue % 360) + 360) % 360 / 60;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(h % 2 - 1));
  const [r, g, b] = h < 1 ? [chroma, x, 0] : h < 2 ? [x, chroma, 0]
    : h < 3 ? [0, chroma, x] : h < 4 ? [0, x, chroma]
      : h < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const m = lightness - chroma / 2;
  return [byte((r + m) * 255), byte((g + m) * 255), byte((b + m) * 255)];
}

export function resolveGardenForm(params: SceneParams, tree: number): number {
  const explicit = tree === 0 ? params.gardenSpeciesLeft : params.gardenSpeciesRight;
  if (explicit > 0) return Math.round(clamp(explicit, 1, GARDEN_FORM_COUNT));
  const leftSeed = seedValue(params.gardenSeedLeft);
  const seed = seedValue(tree === 0 ? params.gardenSeedLeft : params.gardenSeedRight);
  const select = (value: number) => {
    const random = makeRandom(value ^ 0x52514e4d);
    const strange = random() < clamp(params.gardenOddity, 0, 1) * 0.72;
    return strange ? 5 + Math.floor(random() * (GARDEN_FORM_COUNT - 4)) : 1 + Math.floor(random() * 4);
  };
  const auto = select(seed);
  if (tree === 0) return auto;
  const left = select(leftSeed);
  return auto === left ? auto % GARDEN_FORM_COUNT + 1 : auto;
}

/** New, visibly varied DNA: the archive's 25 agent controls remain real bytes at every generation. */
function coherentRandomGenome(params: SceneParams, tree: number, seed: number): Uint8Array {
  const random = makeRandom(seed ^ 0x73e2a407);
  const dna = new Uint8Array(GARDEN_FEATURES * GARDEN_COLUMNS);
  metadata(dna);
  const form = resolveGardenForm(params, tree);
  const wild = clamp(params.gardenVariation, 0, 2);
  const branching = clamp(params.gardenBranching, 0, 1.5);
  const spread = clamp(params.gardenSpread, 0.2, 1.8);
  const bend = clamp(params.gardenBend, 0, 1.8);
  const gravity = clamp(params.gardenGravity, -1, 1.5);
  const bloom = clamp(params.gardenBloom, 0, 1.5);
  const crown = clamp(params.gardenCrown, 0.2, 2);
  const leafLength = clamp(params.gardenLeafLength, 0.35, 2);
  const oddity = clamp(params.gardenOddity, 0, 1);
  const vivid = clamp(params.gardenColorfulness, 0, 2);
  // Paired pigments give each tree a readable identity, including blue, violet, gold and red
  // foliage. Previously almost every non-flowering form was constrained to muted green.
  const palettes = [
    [175, 315], [268, 42], [48, 190], [205, 25], [326, 165], [14, 193],
    [132, 286], [79, 38], [218, 184], [350, 45], [155, 52], [290, 198],
  ];
  const paletteFor = (value: number) => Math.floor(makeRandom(value ^ 0x0f351ca7)() * palettes.length);
  let paletteIndex = paletteFor(seed);
  if (tree === 1 && paletteIndex === paletteFor(seedValue(params.gardenSeedLeft))) {
    paletteIndex = (paletteIndex + 1 + Math.floor(random() * (palettes.length - 1))) % palettes.length;
  }
  if (form === 9) paletteIndex = 8; // frosted blue/cyan silhouette
  if (form === 10) paletteIndex = 9; // ember-red branches with golden tips
  const [leafBase, blossomBase] = palettes[paletteIndex];
  const leafHue = leafBase + pick(random, -18, 18);
  const blossomHue = blossomBase + pick(random, -22, 22);
  const trunk: [number, number, number] = [pick(random, 64, 128), pick(random, 43, 91), pick(random, 25, 63)];
  const saturation = clamp(0.32 + vivid * 0.45, 0.08, 1);
  const foliage = hsl(leafHue, form === 9 ? saturation * 0.58 : saturation,
    form === 9 ? pick(random, 0.61, 0.74) : pick(random, 0.48, 0.64));
  const flower = hsl(blossomHue, clamp(saturation * (0.52 + bloom * 0.52), 0.08, 1), pick(random, 0.53, 0.7));
  const coral = hsl(blossomHue, saturation, pick(random, 0.48, 0.65));
  const growthLength = pick(random, 0.72, 1.28);
  const heightProfile = pick(random, 0.72, 1.32);
  const canopyProfile = pick(random, 0.68, 1.45);
  const branchProfile = pick(random, -25, 25);
  set(dna, 0, 1, pick(random, 75, 140));
  for (let channel = 0; channel < 3; channel += 1) set(dna, channel + 1, 1, trunk[channel]);

  for (let column = 0; column < GARDEN_COLUMNS; column += 1) {
    const depth = Math.min(column, 9) / 9;
    const tip = depth > 0.64;
    const transition = clamp((depth - 0.42) / 0.45, 0, 1);
    const crownColor = form === 1 || form === 10 ? flower : form === 9 ? hsl(190, 0.36, 0.86)
      : form === 4 || form >= 5 ? coral :
      hsl(blend(leafHue, blossomHue, 0.32), saturation, 0.58);
    const color = trunk.map((component, channel) => blend(
      blend(component, foliage[channel], clamp(depth * 1.7, 0, 1)),
      crownColor[channel], transition,
    ));
    for (let channel = 0; channel < 3; channel += 1) {
      set(dna, column, channel + 2, color[channel] + pick(random, -27, 27) * wild);
      set(dna, column, channel + 7, pick(random, 118, 136));
    }
    set(dna, column, 5, pick(random, 10, tip ? 45 : 70));
    set(dna, column, 6, pick(random, 65, 175) * wild);
    set(dna, column, 10, 128 + pick(random, 2, form >= 5 ? 35 : 24) * wild);
    const turnSign = random() < 0.5 ? -1 : 1;
    const strangeBend = form === 5 && column > 1 ? 2.7 + oddity : form === 11 && column > 2 ? 2.2 : form === 4 ? 1.35 : 1;
    const turnStrength = pick(random, 0.0015, column === 0 ? 0.006 : 0.018) * bend * (tip ? 1.2 : 1) * strangeBend;
    set(dna, column, 11, turnSign < 0 ? 40 - turnStrength * 400 : 215 + turnStrength * 400);
    const curlChance = form === 5 && column > 2 ? 0.5 + oddity * 0.35 : form === 11 && column > 3 ? 0.55 : form === 4 ? 0.14 : 0.03;
    set(dna, column, 12, random() < curlChance * wild
      ? (turnSign < 0 ? pick(random, form === 5 ? 6 : 18, 20) : pick(random, 235, form === 5 ? 249 : 237)) : 127);
    const spreadShape = form === 3 ? 1.12 : form === 6 && column < 5 ? 1.25 + oddity * 0.2
      : form === 7 && column > 2 ? 1.45 + oddity * 0.2 : form === 8 && column < 4 ? 0.28
        : form === 8 && column >= 4 ? 1.8 : form === 9 ? 1.2 : form === 10 ? 0.62 : form === 11 ? 1.4 : 1;
    set(dna, column, 13, pick(random, tip ? 38 : 76, tip ? 120 : 164) * spread * spreadShape * canopyProfile);
    set(dna, column, 14, pick(random, 55, 180) * wild);
    const size = blend(pick(random, 72, 124), pick(random, form === 1 ? 8 : 10, 29), depth);
    set(dna, column, 15, size);
    set(dna, column, 16, pick(random, 0, 72));
    set(dna, column, 17, pick(random, 0, 18));
    set(dna, column, 18, pick(random, 195, 250) * wild);
    set(dna, column, 19, tip && form === 1 ? pick(random, 180, 244)
      : tip && (form === 2 || form === 3) ? pick(random, 4, 79)
        : pick(random, 83, 174));
    const trunkLength = form === 1 ? pick(random, 80, 145) : form === 2 ? pick(random, 155, 230)
      : form === 3 ? pick(random, 115, 185) : form === 6 ? pick(random, 175, 240)
        : form === 7 || form === 8 || form === 9 || form === 11 ? pick(random, 160, 225)
          : form === 10 ? pick(random, 130, 180) : pick(random, 65, 125);
    const length = column === 0 ? trunkLength * heightProfile
      : blend(pick(random, 138, 225), pick(random, 36, 98) * (tip ? leafLength : 1), depth) * growthLength;
    set(dna, column, 20, length * (form === 8 && column < 4 ? 1.25 : form === 9 && tip ? 1.35 : 1));
    set(dna, column, 21, column === 0 ? pick(random, 0, 75) : pick(random, 174, 225));
    set(dna, column, 22, pick(random, 60, 225) * wild);
    const count = 102 + branching * 63 + (crown - 1) * (tip ? 70 : 15) + pick(random, -48, 48) * wild - depth * 30
      + branchProfile + (form === 6 && column < 4 ? 12 * oddity : 0) - (form === 7 && column > 6 ? 25 * oddity : 0);
    set(dna, column, 23, form === 8 && column < 4 ? pick(random, 10, 45)
      : form === 8 && column === 4 ? pick(random, 185, 225)
        : form === 9 ? Math.min(count, 115)
          : form === 10 && column < 3 ? pick(random, 40, 95)
            : form === 10 ? pick(random, 150, 177)
              : form === 11 ? Math.min(count, 125) : count);
    set(dna, column, 24, random() * GARDEN_COLUMNS);
    const pull = column === 0 ? pick(random, 225, 248)
      : form === 11 ? pick(random, 215, 250)
      : !tip ? pick(random, 125, 216)
      : form === 2 || form === 8 && tip ? pick(random, 0, 45)
      : form === 3 && tip ? pick(random, 12, 100)
        : form === 6 ? pick(random, 215, 254)
          : form === 10 ? pick(random, 220, 254)
          : form === 7 && tip ? pick(random, 0, 65)
        : form === 1 && tip ? pick(random, 205, 252)
          : pick(random, 90, 210);
    set(dna, column, 25, pull + gravity * 65);
  }
  return dna;
}

/** Same three crossover granularities as cross_DNA(), with an optional number of byte mutations. */
export function crossGardenGenomes(a: Uint8Array, b: Uint8Array, mode: number, mutations: number, seed: number): Uint8Array {
  if (a.length !== GARDEN_FEATURES * GARDEN_COLUMNS || b.length !== GARDEN_FEATURES * GARDEN_COLUMNS) throw new Error('Invalid garden genome');
  const random = makeRandom(seed);
  const child = new Uint8Array(a);
  if (mode === 1) {
    for (let column = 0; column < GARDEN_COLUMNS; column += 1) {
      if (random() < 0.5) for (let feature = 1; feature < GARDEN_FEATURES; feature += 1) child[address(column, feature)] = b[address(column, feature)];
    }
  } else if (mode === 2) {
    for (let feature = 1; feature < GARDEN_FEATURES; feature += 1) {
      if (random() < 0.5) for (let column = 0; column < GARDEN_COLUMNS; column += 1) child[address(column, feature)] = b[address(column, feature)];
    }
  } else if (mode === 3) {
    for (let column = 0; column < GARDEN_COLUMNS; column += 1) {
      for (let feature = 1; feature < GARDEN_FEATURES; feature += 1) {
        if (random() < 0.5) child[address(column, feature)] = b[address(column, feature)];
      }
    }
  }
  for (let i = 0; i < Math.round(clamp(mutations, 0, 350)); i += 1) {
    child[address(Math.floor(random() * GARDEN_COLUMNS), 1 + Math.floor(random() * (GARDEN_FEATURES - 1)))] = byte(random() * 255);
  }
  metadata(child);
  return child;
}

/** Produces one tree's independent genome, then applies any edited cells from the full 14×25 matrix. */
export function createGardenGenome(params: SceneParams, tree: number): Uint8Array {
  const index = tree === 0 ? 0 : 1;
  const seed = seedValue(index === 0 ? params.gardenSeedLeft : params.gardenSeedRight);
  let dna: Uint8Array;
  if (params.gardenGenerationMode === 0) dna = rawRandomGenome(seed);
  else if (params.gardenGenerationMode === 2) {
    const a = decodeGenome(GENOME_PRESETS[Math.round(clamp(params.gardenGenomeA, 0, GENOME_PRESETS.length - 1))].dna);
    const b = decodeGenome(GENOME_PRESETS[Math.round(clamp(params.gardenGenomeB, 0, GENOME_PRESETS.length - 1))].dna);
    dna = crossGardenGenomes(a, b, params.gardenCrossMode, params.gardenMutations, seed);
  } else dna = coherentRandomGenome(params, index, seed);
  const edits = params.gardenGeneOverrides[index] ?? {};
  for (const [key, value] of Object.entries(edits)) {
    const offset = Number(key);
    if (Number.isInteger(offset) && offset >= 1 && offset < dna.length && offset % GARDEN_FEATURES !== 0) dna[offset] = byte(value);
  }
  return dna;
}
