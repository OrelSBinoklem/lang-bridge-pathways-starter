import type { CanvasSceneDef } from './types';
import { FONT_SANS, TAU, clamp, fillGradient, mixHex, rgba } from './kit';

type Point3 = { x: number; y: number; z: number };
type ProjectedPoint = { x: number; y: number; z: number; scale: number; energy: number; color: number };

const LED_GRID = 20;

function buildCubePoints(surfaceOnly: boolean): Point3[] {
  const points: Point3[] = [];
  for (let z = 0; z < LED_GRID; z += 1) {
    for (let y = 0; y < LED_GRID; y += 1) {
      for (let x = 0; x < LED_GRID; x += 1) {
        const edge = x === 0 || y === 0 || z === 0 || x === LED_GRID - 1 || y === LED_GRID - 1 || z === LED_GRID - 1;
        if (surfaceOnly && !edge) continue;
        points.push({
          x: (x / (LED_GRID - 1) - 0.5) * 2,
          y: (y / (LED_GRID - 1) - 0.5) * 2,
          z: (z / (LED_GRID - 1) - 0.5) * 2,
        });
      }
    }
  }
  return points;
}

const SURFACE_POINTS = buildCubePoints(true);
const VOLUME_POINTS = buildCubePoints(false);
const CUBE_CORNERS: Point3[] = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => ({ x, y, z }))));
const CUBE_EDGES: Array<[number, number]> = [
  [0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7],
];

/**
 * A translucent 20³ LED volume drawn flat in 2D: the first version of the LED cube, now only the fallback of the real
 * one (ledCube.ts) when WebGL2 is missing. The dark surface modules establish the physical cube; animated inner voxels
 * make it read as a real volume, not a flat screen.
 */
export const VOXEL_LED_CUBE_2D: CanvasSceneDef = {
  kind: 'canvas',
  id: 'voxel-led-cube',
  label: 'Объёмный LED-куб 20³',
  defaultParams: { speed: 0.55, intensity: 1, react: 0.7 },
  palettes: [
    ['#020b14', '#37dced', '#4e80ff', '#c9fff0'],
    ['#120719', '#df65ff', '#687dff', '#fff0a3'],
  ],
  create(c) {
    const W = c.width;
    const H = c.height;
    let clock = 0;
    let impulse = 0;
    let pointer = { x: W / 2, y: H / 2, active: false };

    const project = (point: Point3, yaw: number, pitch: number, size: number): ProjectedPoint => {
      const cy = Math.cos(yaw); const sy = Math.sin(yaw);
      const cp = Math.cos(pitch); const sp = Math.sin(pitch);
      const rx = point.x * cy + point.z * sy;
      const rz = point.z * cy - point.x * sy;
      const ry = point.y * cp - rz * sp;
      const depth = point.y * sp + rz * cp;
      const perspective = 2.65 / (2.65 + depth * 0.72);
      return { x: rx * size * perspective, y: ry * size * perspective, z: depth, scale: perspective, energy: 0, color: 1 };
    };

    const volumeEnergy = (point: Point3, mode: number): { energy: number; color: number } => {
      const radius = Math.hypot(point.x, point.y, point.z);
      if (mode === 0) {
        // A luminous expanding radar sphere sweeps through all 20×20×20 positions.
        const shell = 0.14 + 0.08 * Math.sin(clock * 1.7);
        const wave = Math.abs(radius - (0.25 + ((clock * 0.23) % 0.86)));
        return { energy: clamp(1 - wave / shell, 0, 1), color: radius > 0.7 ? 2 : 1 };
      }
      if (mode === 1) {
        // Three intertwined signal helices make a visibly three-dimensional animation.
        const spiral = Math.abs(Math.sin(Math.atan2(point.z, point.x) * 3 - point.y * 6 + clock * 3.1));
        const body = 1 - Math.abs(radius - (0.48 + 0.18 * Math.sin(clock + point.y * 4))) / 0.2;
        return { energy: clamp((spiral - 0.76) * 4.2, 0, 1) * clamp(body, 0, 1), color: point.y > 0 ? 3 : 1 };
      }
      // A rotating torus and a pulsing central core feel like a data packet travelling through a volumetric display.
      const torus = 1 - (Math.abs(Math.hypot(point.x, point.z) - 0.58) + Math.abs(point.y * 0.76 + Math.sin(clock * 1.8) * 0.1)) / 0.16;
      const core = 1 - radius / (0.15 + 0.05 * Math.sin(clock * 2.3));
      return { energy: clamp(Math.max(torus, core), 0, 1), color: torus > core ? 2 : 3 };
    };

    return {
      update(dt, t, p) {
        clock = t;
        pointer = p;
        impulse = Math.max(0, impulse - dt * 0.75);
        if (p.clicked && c.params.react > 0) impulse = 1;
      },
      draw(g) {
        fillGradient(g, W, H, c.palette[0], mixHex(c.palette[0], '#000205', 0.68));
          const mobileBody = c.body && W <= 700;
          const centreX = mobileBody ? W * 0.5 : c.body ? W * 0.68 : W * 0.63;
          const centreY = c.body ? H * 0.52 : H * 0.53;
          const size = (mobileBody ? Math.min(W * 0.31, H * 0.28) : Math.min(W, H) * (c.body ? 0.245 : 0.42)) * (1 + impulse * 0.06);
        const yaw = clock * 0.34 + (pointer.active ? (pointer.x / W - 0.5) * 0.22 * c.params.react : 0);
        const pitch = -0.34 + Math.sin(clock * 0.22) * 0.12 + (pointer.active ? (pointer.y / H - 0.5) * 0.12 * c.params.react : 0);
        const mode = Math.floor(clock / 5.8) % 3;
        const active: ProjectedPoint[] = [];

        // Draw only the lit voxels from all 8,000 physical positions. The cube still has a true 20³ lattice,
        // but keeping dark interior LEDs implicit protects the full-page animation budget.
        for (const point of VOLUME_POINTS) {
          const animation = volumeEnergy(point, mode);
          if (animation.energy < 0.16) continue;
          const projected = project(point, yaw, pitch, size);
          projected.energy = animation.energy;
          projected.color = animation.color;
          active.push(projected);
        }
        active.sort((a, b) => b.z - a.z);

        g.save();
        g.translate(centreX, centreY);
        g.globalCompositeOperation = 'lighter';
        for (const voxel of active) {
          const r = clamp(1.1 + voxel.scale * 2.25 + voxel.energy * 1.45, 1.15, 5.4);
          g.fillStyle = rgba(c.palette[voxel.color], (0.18 + voxel.energy * 0.72) * c.params.intensity);
          g.fillRect(voxel.x - r, voxel.y - r, r * 2, r * 2);
          if (voxel.energy > 0.72) {
            g.fillStyle = rgba('#ffffff', voxel.energy * 0.7);
            g.fillRect(voxel.x - r * 0.42, voxel.y - r * 0.42, Math.max(1, r * 0.7), Math.max(1, r * 0.7));
          }
        }
        g.globalCompositeOperation = 'source-over';

        // 2,168 dark LED modules are the three-dimensional enclosure. Their low opacity keeps the inside visible.
        for (const point of SURFACE_POINTS) {
          const led = project(point, yaw, pitch, size);
          const r = clamp(0.62 + led.scale * 1.15, 0.75, 2.1);
          const edgeLight = clamp((led.z + 1.35) / 2.7, 0.05, 0.42);
          g.fillStyle = rgba('#021017', 0.58 + edgeLight * 0.28);
          g.fillRect(led.x - r, led.y - r, r * 2, r * 2);
          g.fillStyle = rgba(c.palette[1], edgeLight * 0.5);
          g.fillRect(led.x - r * 0.44, led.y - r * 0.44, Math.max(0.7, r * 0.78), Math.max(0.7, r * 0.78));
        }

        const corners = CUBE_CORNERS.map((corner) => project(corner, yaw, pitch, size));
        g.strokeStyle = rgba(c.palette[1], 0.38 + impulse * 0.28);
        g.lineWidth = 1.1;
        for (const [from, to] of CUBE_EDGES) {
          g.beginPath(); g.moveTo(corners[from].x, corners[from].y); g.lineTo(corners[to].x, corners[to].y); g.stroke();
        }
        g.restore();

        // A restrained instrument label helps the background read as an object without competing with page text.
        if (c.body) {
          g.fillStyle = rgba(c.palette[3], 0.32); g.font = `700 10px ${FONT_SANS}`; g.letterSpacing = '1.8px';
          g.fillText(`VOLUME • ${LED_GRID}³`, centreX - size * 0.7, centreY + size * 1.32);
          g.letterSpacing = '0px';
          g.fillStyle = rgba(c.palette[1], 0.1); g.beginPath(); g.arc(centreX, centreY, size * 1.18 + Math.sin(clock * 1.8) * 6, 0, TAU); g.stroke();
        }
      },
    };
  },
};
