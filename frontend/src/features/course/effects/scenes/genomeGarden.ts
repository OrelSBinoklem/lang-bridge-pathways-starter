import type { CanvasSceneDef } from './types';
import { clamp, fillGradient } from './kit';
import { makeRandom } from './pointer';
import { createGardenGenome, GARDEN_COLUMNS, GARDEN_FEATURES, resolveGardenForm } from './genomeGardenGenetics';

const LEVEL_LENGTH = [100, 70, 50, 40, 32, 26, 20, 15, 10, 5];
const MAX_AGENTS = 18000;
const MAX_STAMPS = 170000;

const gene = (dna: Uint8Array, feature: number, column: number) => dna[column * GARDEN_FEATURES + feature];
const between = (a: number, b: number, t: number) => a + (b - a) * t;
const bounded = (n: number) => clamp(n, 0, 255);

export type GrowthStamp = {
  x: number; y: number; fromX: number; fromY: number;
  radius: number; red: number; green: number; blue: number; tick: number;
};
export type GrowthResult = { stamps: GrowthStamp[]; ticks: number; minX: number; maxX: number; minY: number; maxY: number };
export type GrowthStyle = { form: number; crown: number; bloom: number; leafLength: number };

type Agent = {
  x: number; y: number; heading: number; turn: number; acceleration: number;
  size: number; sizeDelta: number; red: number; green: number; blue: number;
  redDelta: number; greenDelta: number; blueDelta: number;
  remaining: number; level: number; column: number;
};

/** Bounded, deterministic browser interpretation of the archive's agent/genome mechanics. */
export function growGardenGenome(dna: Uint8Array, seed: number, style?: GrowthStyle): GrowthResult {
  if (dna.length !== GARDEN_FEATURES * GARDEN_COLUMNS) throw new Error('Invalid garden genome');
  const random = makeRandom(seed);
  const crownRandom = makeRandom(seed ^ 0x516d3a2b);
  const crownDensity = 0.7 + crownRandom() * 0.65;
  const crownSpan = 0.7 + crownRandom() * 0.65;
  const stamps: GrowthStamp[] = [];
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  let createdAgents = 0;

  function addStamp(x: number, y: number, radius: number, red: number, green: number, blue: number, tick: number, fromX = x, fromY = y) {
    if (stamps.length >= MAX_STAMPS) return;
    stamps.push({ x, y, fromX, fromY, radius, red: bounded(red), green: bounded(green), blue: bounded(blue), tick });
    minX = Math.min(minX, x - radius, fromX - radius); maxX = Math.max(maxX, x + radius, fromX + radius);
    minY = Math.min(minY, y - radius, fromY - radius); maxY = Math.max(maxY, y + radius, fromY + radius);
  }

  function growTerminalCrown(agent: Agent, tick: number) {
    if (!style || style.form < 1) return;
    const form = style.form;
    // Open gaps between ornamental clusters keep the underlying genome-grown branches visible.
    if ((form === 11 && random() > 0.19) || (form === 5 && random() > 0.57)) return;
    const crown = clamp(style.crown, 0.2, 2);
    const baseCount = form === 8 ? 9 : form === 9 ? 2 : form === 10 ? 10 : form === 11 ? 4
      : form === 3 || form === 7 ? 8 : form === 1 || form === 6 ? 7 : 5;
    const count = Math.round(clamp(baseCount * crown * crownDensity, 2, 17));
    const baseLength = form === 8 ? 68 : form === 9 ? 22 : form === 10 ? 75 : form === 11 ? 38
      : form === 5 ? 52 : form === 6 ? 43 : form === 7 ? 50
        : form === 3 ? 47 : form === 2 ? 35 : form === 1 ? 30 : 25;
    const length = baseLength * clamp(style.leafLength, 0.35, 2) * crownSpan;
    const flowerLight = form === 1 ? 18 * clamp(style.bloom, 0, 1.5) : 0;
    for (let petal = 0; petal < count && stamps.length < MAX_STAMPS; petal += 1) {
      const angle = form === 1 || form === 5 || form === 11
        ? agent.heading + petal * Math.PI * 2 / count + (random() - 0.5) * 0.3
        : form === 6 || form === 8 || form === 10
          ? Math.PI + (petal / Math.max(1, count - 1) - 0.5) * (form === 8 ? 2.6 : form === 10 ? 1.15 : 1.7)
        : agent.heading + (petal / Math.max(1, count - 1) - 0.5) * (form === 3 || form === 7 ? 2.45 : 1.8);
      const petalLength = length * pickLength(random());
      const bend = (random() - 0.5) * (form === 4 ? 35 : 15);
      const steps = form === 5 || form === 11 ? 14 : 8;
      let previousX = agent.x;
      let previousY = agent.y;
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        const spiralAngle = angle + Math.PI * 2.2 * t;
        const loopRadius = petalLength * Math.sin(Math.PI * t);
        const x = form === 11 ? agent.x + Math.sin(angle + Math.PI * 2 * t) * loopRadius
          : form === 5 ? agent.x + Math.sin(spiralAngle) * petalLength * (0.2 + 0.65 * t)
          : form === 7 ? agent.x + (petal / Math.max(1, count - 1) - 0.5) * petalLength * 1.85 * t
            : agent.x + Math.sin(angle) * petalLength * t + bend * t * t;
        const y = form === 11 ? agent.y + Math.cos(angle + Math.PI * 2 * t) * loopRadius
          : form === 5 ? agent.y + Math.cos(spiralAngle) * petalLength * (0.2 + 0.65 * t)
          : form === 7 ? agent.y - 24 * Math.sin(Math.PI * t) + 20 * t * t
            : agent.y + Math.cos(angle) * petalLength * t
              + (form === 2 || form === 3 || form === 8 ? petalLength * (form === 8 ? 0.9 : 0.48) * t * t : 0)
              - (form === 6 ? 15 * Math.sin(Math.PI * t) : 0);
        const radius = Math.max(1.7, (form === 9 ? 1.8 : form === 8 ? 3.4 : form === 10 ? 4.4
          : form === 11 ? 2.2 : form === 1 ? 5.5 : form === 5 ? 2.8 : form === 6 ? 4.8 : form === 3 ? 3.3 : 3.7)
          * (0.32 + 0.68 * Math.sin(Math.PI * t)));
        addStamp(x, y, radius,
          agent.red + flowerLight + (form === 4 || form === 6 ? 20 * t : 0),
          agent.green + flowerLight + (form === 10 ? 65 * t : 0),
          agent.blue + flowerLight + (form === 1 ? 8 * t : form === 10 ? -55 * t : 0),
          tick, previousX, previousY);
        previousX = x;
        previousY = y;
      }
    }
  }

  function createAgent(parent: Agent | null, heading: number, x: number, y: number, column: number, level: number, mirror: number): Agent | null {
    if (createdAgents >= MAX_AGENTS) return null;
    createdAgents += 1;
    const row = (feature: number) => gene(dna, feature, column);
    const depth = Math.min(LEVEL_LENGTH.length - 1, level);
    const previousSize = parent?.size ?? row(1) / 6;
    const inheritedSize = row(16) < 50 ? row(15) / 6 : row(16) > 200 ? previousSize : between(row(15) / 6, previousSize, (row(16) - 50) / 150);
    const levelSize = 30 - depth * 3;
    const sized = row(17) < 20 ? inheritedSize : row(17) > 100 ? levelSize : between(inheritedSize, levelSize, (row(17) - 20) / 80);
    const size = sized + (row(18) >= 200 ? (random() * 2 - 1) * ((row(18) - 200) / 55) * sized / 3 : 0);
    const lengthBase = row(20) / 5;
    const length = row(21) >= 200 ? between(lengthBase, LEVEL_LENGTH[depth], (row(21) - 200) / 55) : lengthBase;
    const lengthJitter = row(22) >= 50 ? (random() * 2 - 1) * ((row(22) - 50) / 205) * length / 3 : 0;
    const remaining = Math.max(0, Math.floor(length + lengthJitter));
    const color = (feature: number, parentComponent: number) => {
      const inheritance = row(5);
      let component = inheritance > 100 ? parentComponent : between(row(feature), parentComponent, inheritance / 100);
      if (row(6) >= 50) component += (random() * 2 - 1) * ((row(6) - 50) / 205) * 25;
      return bounded(component);
    };
    const changeColor = (value: number) => value >= 136 ? (value - 136) / 119 * 8 : value <= 119 ? (value - 119) / 119 * 8 : 0;
    const sizeDelta = row(19) >= 175 ? (row(19) - 175) / 80 * 0.5 : row(19) <= 80 ? (row(19) - 80) / 80 * 0.5 : 0;
    const changeAngle = row(11) <= 40 ? (40 - row(11)) / 40 * 0.1 : row(11) >= 215 ? -(row(11) - 215) / 40 * 0.1 : 0;
    const accelerate = row(12) <= 20 ? (20 - row(12)) / 20 * 0.0125 : row(12) >= 235 ? -(row(12) - 235) / 20 * 0.0125 : 0;
    const baseRed = parent?.red ?? gene(dna, 1, 1);
    const baseGreen = parent?.green ?? gene(dna, 1, 2);
    const baseBlue = parent?.blue ?? gene(dna, 1, 3);
    return {
      x, y, heading, turn: changeAngle * mirror, acceleration: accelerate * mirror,
      size, sizeDelta, red: color(2, baseRed), green: color(3, baseGreen), blue: color(4, baseBlue),
      redDelta: changeColor(row(7)), greenDelta: changeColor(row(8)), blueDelta: changeColor(row(9)),
      remaining, level: depth, column,
    };
  }

  const first = createAgent(null, Math.PI, 0, 0, 0, 0, random() < 0.5 ? -1 : 1);
  let active: Agent[] = first ? [first] : [];
  let tick = 0;
  while (active.length > 0 && tick < 1500 && stamps.length < MAX_STAMPS) {
    const next: Agent[] = [];
    for (const agent of active) {
      const row = (feature: number) => gene(dna, feature, agent.column);
      if (agent.remaining > 0) {
        agent.heading += agent.turn;
        agent.turn += agent.acceleration;
        if (row(10) >= 128) agent.heading += ((row(10) - 128) / 127) * (random() - 0.5);
        if (agent.heading > Math.PI) agent.heading -= Math.PI * 2;
        if (agent.heading < -Math.PI) agent.heading += Math.PI * 2;
        const thickness = Math.max(1, Math.abs(agent.size));
        if (row(25) < 55) {
          const pull = ((55 - row(25)) / 100) / thickness;
          agent.heading += agent.heading < 0 ? pull : -pull;
        } else if (row(25) > 200) {
          const pull = ((row(25) - 200) / 10000) * thickness;
          agent.heading += agent.heading < 0 ? -pull : pull;
        }
        const previousX = agent.x;
        const previousY = agent.y;
        agent.x += 3 * Math.sin(agent.heading);
        agent.y += 3 * Math.cos(agent.heading);
        agent.red = bounded(agent.red + agent.redDelta);
        agent.green = bounded(agent.green + agent.greenDelta);
        agent.blue = bounded(agent.blue + agent.blueDelta);
        agent.size += agent.sizeDelta;
        const radius = Math.max(3, Math.abs(agent.size)) / 2;
        addStamp(agent.x, agent.y, radius, agent.red, agent.green, agent.blue, tick, previousX, previousY);
        agent.remaining -= 1;
        next.push(agent);
      } else if (agent.level < LEVEL_LENGTH.length - 1) {
        const countByte = row(23);
        const children = countByte < 50 ? 1
          : countByte < 100 ? (random() < (countByte - 50) / 49 ? 2 : 1)
            : countByte < 150 ? 2
              : countByte < 180 ? (random() < (countByte - 150) / 29 ? 3 : 2)
                : 3;
        const spread = row(13) / 160;
        const angleJitter = row(14) >= 50 ? ((row(14) - 50) / 205) * 0.8 : 0;
        const nextColumn = (agent.column + 1) % GARDEN_COLUMNS;
        const spawn = (offset: number, mirror: number, special = false) => {
          const column = special ? row(24) % GARDEN_COLUMNS : nextColumn;
          const level = special ? agent.level + 1 + countByte % 4 : agent.level + 1;
          const angle = agent.heading + offset + (random() * 2 - 1) * angleJitter;
          const child = createAgent(agent, angle, agent.x, agent.y, column, level, mirror);
          if (child) next.push(child);
        };
        if (children === 1) spawn(0, random() < 0.5 ? -1 : 1);
        else {
          if (children === 3) spawn(0, random() < 0.5 ? -1 : 1);
          spawn(spread, 1, countByte >= 232);
          spawn(-spread, -1, countByte >= 232);
        }
      } else growTerminalCrown(agent, tick);
      if (next.length >= MAX_AGENTS || stamps.length >= MAX_STAMPS) break;
    }
    active = next;
    tick += 1;
  }
  if (stamps.length === 0) return { stamps, ticks: tick, minX: -1, maxX: 1, minY: -1, maxY: 1 };
  return { stamps, ticks: tick, minX, maxX, minY, maxY };
}

const pickLength = (random: number) => 0.72 + random * 0.56;

type Specimen = { growth: GrowthResult; cursor: number; scale: number; offsetX: number; offsetY: number };

export const GENOME_GARDEN: CanvasSceneDef = {
  kind: 'canvas', id: 'genome-garden', label: 'Генетический сад',
  palettes: [['#0b151c', '#c3eab0', '#f0ddfa', '#91cfc3']],
  defaultParams: { gardenGenerationMode: 0, gardenScale: 1 },
  create(c) {
    const p = c.params;
    const layer = document.createElement('canvas');
    const pixelRatio = c.body ? 1 : c.dpr;
    layer.width = Math.round(c.width * pixelRatio);
    layer.height = Math.round(c.height * pixelRatio);
    const context = layer.getContext('2d');
    if (!context) throw new Error('Garden canvas is unavailable');
    const brush: CanvasRenderingContext2D = context;
    const settings = () => [
      p.gardenGenerationMode, p.gardenSpeciesLeft, p.gardenSpeciesRight,
      p.gardenSeedLeft, p.gardenSeedRight, p.gardenGenomeA, p.gardenGenomeB,
      p.gardenCrossMode, p.gardenMutations, p.gardenScale, p.gardenGap, p.gardenRootY,
      p.gardenVariation, p.gardenBranching, p.gardenSpread, p.gardenBend,
      p.gardenGravity, p.gardenCrown, p.gardenBloom, p.gardenLeafLength,
      p.gardenColorfulness, p.gardenOddity,
      p.gardenGenomeRevision,
    ].join('|');
    let signature = settings();
    let specimens: Specimen[] = [];
    let progress = 0;
    let checkTimer = 0;

    function regenerate() {
      specimens = [];
      brush.setTransform(1, 0, 0, 1, 0, 0);
      brush.clearRect(0, 0, layer.width, layer.height);
      const count = c.body ? 2 : 1;
      for (let index = 0; index < count; index += 1) {
        const seed = Math.floor((index === 0 ? p.gardenSeedLeft : p.gardenSeedRight) * 2147483647);
        const dna = createGardenGenome(p, index);
        const growth = growGardenGenome(dna, seed + 391, p.gardenGenerationMode === 1 ? {
          form: resolveGardenForm(p, index), crown: p.gardenCrown, bloom: p.gardenBloom,
          leafLength: p.gardenLeafLength,
        } : undefined);
        const rawWidth = Math.max(1, growth.maxX - growth.minX);
        const sideWidth = Math.max(92, (c.width - Math.min(760, c.width * 0.68)) / 2);
        const fitWidth = count === 1 ? c.width * 0.38 : sideWidth * 1.25;
        const rootY = c.height * clamp(p.gardenRootY, 0.65, 0.87);
        const topRoom = rootY - c.height * 0.16;
        const bottomRoom = c.height * 0.91 - rootY;
        const scale = Math.min(
          fitWidth / rawWidth,
          topRoom / Math.max(1, -growth.minY),
          bottomRoom / Math.max(1, growth.maxY),
        ) * clamp(p.gardenScale, 0.4, 1.5);
        const edgeFactor = clamp(0.52 - (p.gardenGap - 1) * 0.18, 0.32, 0.9);
        const centerX = count === 1 ? c.width * 0.78
          : index === 0 ? sideWidth * edgeFactor : c.width - sideWidth * edgeFactor;
        const offsetX = centerX - (growth.minX + growth.maxX) * 0.5 * scale;
        const offsetY = rootY;
        specimens.push({ growth, cursor: 0, scale, offsetX, offsetY });
      }
      progress = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 1 : 0;
    }
    regenerate();

    function paintStamp(stamp: GrowthStamp, scale: number, offsetX: number, offsetY: number) {
      const x = stamp.x * scale + offsetX;
      const y = stamp.y * scale + offsetY;
      const fromX = stamp.fromX * scale + offsetX;
      const fromY = stamp.fromY * scale + offsetY;
      const width = Math.max(1.1, stamp.radius * scale * 2);
      brush.lineCap = 'round';
      brush.lineJoin = 'round';
      const segment = (dx: number, dy: number, color: string) => {
        brush.strokeStyle = color;
        brush.lineWidth = width;
        brush.beginPath();
        brush.moveTo(fromX + dx, fromY + dy);
        brush.lineTo(x + dx, y + dy);
        brush.stroke();
      };
      segment(scale, scale, 'rgba(0,0,0,0.12)');
      segment(-scale, -scale, 'rgba(255,255,255,0.06)');
      segment(0, 0, `rgba(${stamp.red | 0},${stamp.green | 0},${stamp.blue | 0},0.88)`);
    }

    function paintPot(g: CanvasRenderingContext2D, specimen: Specimen) {
      const x = specimen.offsetX;
      const y = specimen.offsetY;
      const width = clamp(83 * specimen.scale, c.body ? 70 : 36, c.body ? 124 : 88);
      // The body's height and the rim's ellipse used to both derive from a too-flat `height`, so the whole pot
      // read as squashed; the rim now keeps its own, rounder ratio independent of how tall the body is.
      const height = width * 0.58;
      const rimRadiusY = width * 0.17;
      g.save();
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath(); g.ellipse(x, y + height + 3, width * 0.56, width * 0.08, 0, 0, Math.PI * 2); g.fill();
      const clay = g.createLinearGradient(x - width * 0.5, y, x + width * 0.5, y + height);
      clay.addColorStop(0, '#83624d'); clay.addColorStop(0.32, '#51392e');
      clay.addColorStop(0.7, '#392821'); clay.addColorStop(1, '#251c19');
      g.fillStyle = clay;
      g.beginPath();
      g.moveTo(x - width * 0.49, y + 3); g.lineTo(x + width * 0.49, y + 3);
      g.lineTo(x + width * 0.38, y + height); g.quadraticCurveTo(x, y + height + 4, x - width * 0.38, y + height);
      g.closePath(); g.fill();
      g.fillStyle = '#2c211c';
      g.beginPath(); g.ellipse(x, y + 3, width * 0.5, rimRadiusY, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#98725b'; g.lineWidth = Math.max(2, width * 0.04);
      g.beginPath(); g.ellipse(x, y + 2, width * 0.5, rimRadiusY, 0, 0, Math.PI); g.stroke();
      g.restore();
    }

    return {
      update(dt) {
        checkTimer += dt;
        if (checkTimer > 0.2) {
          checkTimer = 0;
          const next = settings();
          if (next !== signature) { signature = next; regenerate(); }
        }
        progress = Math.min(1, progress + dt * 0.14 * clamp(p.speed, 0, 3));
      },
      draw(g) {
        fillGradient(g, c.width, c.height, '#182b2a', '#071814');
        const halo = g.createRadialGradient(c.width * 0.5, c.height * 0.38, 12, c.width * 0.5, c.height * 0.38, c.width * 0.55);
        halo.addColorStop(0, 'rgba(119,171,130,0.13)'); halo.addColorStop(1, 'rgba(119,171,130,0)');
        g.fillStyle = halo; g.fillRect(0, 0, c.width, c.height);
        for (const specimen of specimens) paintPot(g, specimen);
        brush.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        for (const specimen of specimens) {
          const targetTick = progress * specimen.growth.ticks;
          let painted = 0;
          while (specimen.cursor < specimen.growth.stamps.length && painted < 3500) {
            const stamp = specimen.growth.stamps[specimen.cursor];
            if (stamp.tick > targetTick) break;
            paintStamp(stamp, specimen.scale, specimen.offsetX, specimen.offsetY);
            specimen.cursor += 1;
            painted += 1;
          }
        }
        g.save();
        g.globalAlpha = clamp(p.intensity, 0, 2) * 0.96;
        if (p.hue) g.filter = `hue-rotate(${p.hue}deg)`;
        g.drawImage(layer, 0, 0, c.width, c.height);
        g.restore();
      },
    };
  },
};
