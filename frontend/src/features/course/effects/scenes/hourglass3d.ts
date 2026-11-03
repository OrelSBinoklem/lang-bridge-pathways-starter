import type { CanvasSceneDef } from './types';
import { createOrbit } from './orbitControl';
import { clamp, rgb } from './kit';
import { HOURGLASS_2D } from './canvasScenes3';
import { FRAME, createHourglassRenderer } from './hourglassGL';
import { createSand } from './hourglassSand';

/**
 * A 3D hourglass on a desk, ray traced on the GPU (hourglassGL.ts) with physically behaved sand (hourglassSand.ts).
 * The room behind it — a dark wall and a walnut desk under a warm lamp — is lit once on the CPU into a linear-light
 * picture; the shader reads it wherever a ray leaves the glass and adds the hourglass's moving shadow.
 *
 * The cursor turns the hourglass round its axis (the glass bends the room differently, the pillars pass behind it);
 * a click turns it over, and when the sand has run out it turns over by itself. The glass is small on a course card,
 * so only its pixels are traced (1 ray each on a sharp screen, 2 otherwise, 4 at full quality), at most 30 times a
 * second.
 */

const CAM0: [number, number, number] = [0, 2.7, 9.5];
const CAM = CAM0;
/** Must match WALL_Z in the shader. */
const WALL_Z = -2.4;
const LIGHT: [number, number, number] = [-2.6, 5.2, 3.2];

function hash2(x: number, y: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise2(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const toLinear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/**
 * The wall and the desk as the camera sees them, in linear light: albedo × (the lamp, inverse-square, Lambert + a soft
 * gloss on the desk's oil finish, and a cool fill). Alpha is the lamp's direct share, which the hourglass's shadow
 * takes away. Rows from the bottom, one texel per device pixel.
 */
function bakeRoom(w: number, h: number, principal: [number, number], focal: number, lightColor: [number, number, number], CAM: [number, number, number] = CAM0) {
  const out = new Float32Array(w * h * 4);
  const amb = [0.075, 0.08, 0.1];
  for (let iy = 0; iy < h; iy += 1) {
    for (let ix = 0; ix < w; ix += 1) {
      let dx = (ix + 0.5 - principal[0]) / focal;
      let dy = (iy + 0.5 - principal[1]) / focal;
      let dz = -1;
      const len = Math.hypot(dx, dy, dz);
      dx /= len;
      dy /= len;
      dz /= len;
      let px: number;
      let py: number;
      let pz: number;
      const nx = 0;
      let ny = 0;
      let nz = 1;
      let albedo: number[];
      let gloss = 0;
      const tTable = dy < 0 ? -CAM[1] / dy : Infinity;
      if (tTable < Infinity && CAM[2] + dz * tTable >= WALL_Z) {
        px = CAM[0] + dx * tTable;
        py = 0;
        pz = CAM[2] + dz * tTable;
        ny = 1;
        nz = 0;
        // Walnut planks running along the desk, 0.9 units wide, with long wavy grain.
        const plank = Math.floor(pz / 0.9);
        const seam = Math.abs(pz / 0.9 - Math.round(pz / 0.9)) * 0.9;
        const warp = noise2(px * 0.35 + plank * 17, pz * 3) * 2.2;
        const streak = 0.5 + 0.5 * Math.sin(pz * 38 + warp * 6 + plank * 3.1);
        const n = 0.55 * streak + 0.45 * noise2(px * 1.6 + plank * 9, pz * 24);
        const tone = 0.8 + 0.4 * hash2(plank, 7);
        albedo = [(0.03 + 0.09 * n) * tone, (0.015 + 0.047 * n) * tone, (0.008 + 0.022 * n) * tone];
        if (seam < 0.012) albedo = albedo.map((v) => v * 0.35);
        gloss = 0.1;
      } else {
        const tWall = (WALL_Z - CAM[2]) / dz;
        px = CAM[0] + dx * tWall;
        py = CAM[1] + dy * tWall;
        pz = WALL_Z;
        // Dark green-grey plaster.
        const n = 0.85 + 0.15 * noise2(px * 3, py * 3) + 0.08 * (noise2(px * 22, py * 22) - 0.5);
        albedo = [0.05 * n, 0.066 * n, 0.066 * n];
      }
      const lx = LIGHT[0] - px;
      const ly = LIGHT[1] - py;
      const lz = LIGHT[2] - pz;
      const d2 = lx * lx + ly * ly + lz * lz;
      const dl = Math.sqrt(d2);
      const cos = Math.max(0, (nx * lx + ny * ly + nz * lz) / dl);
      // Where the wall meets the desk, less light gets in.
      const corner = 1 - 0.55 * Math.exp(-(py + (pz - WALL_Z)) / 0.18);
      const o = (iy * w + ix) * 4;
      let direct = 0;
      let total = 0;
      for (let k = 0; k < 3; k += 1) {
        let spec = 0;
        if (gloss > 0) {
          // Blinn highlight of the lamp on the oiled desk (half vector between the lamp and the camera).
          const vx = CAM[0] - px;
          const vy = CAM[1] - py;
          const vz = CAM[2] - pz;
          const vl = Math.hypot(vx, vy, vz);
          const hx = lx / dl + vx / vl;
          const hy = ly / dl + vy / vl;
          const hz = lz / dl + vz / vl;
          spec = gloss * Math.max(0, hy / Math.hypot(hx, hy, hz)) ** 60 * (lightColor[k] / d2) * 4;
        }
        const lamp = (albedo[k] * lightColor[k] * cos) / d2 + spec;
        const value = (lamp + albedo[k] * amb[k]) * corner;
        out[o + k] = value;
        direct += lamp * corner;
        total += value;
      }
      out[o + 3] = total > 0 ? direct / total : 0;
    }
  }
  return out;
}

export const HOURGLASS_3D: CanvasSceneDef = {
  kind: 'canvas',
  id: 'hourglass',
  label: 'Песочные часы',
  palettes: HOURGLASS_2D.palettes,
  create(c) {
    const W = c.width;
    const H = c.height;
    const S = Math.min(c.dpr, 2);
    const aw = Math.max(2, Math.round(W * S));
    const ah = Math.max(2, Math.round(H * S));
    // The hourglass stands on the right of the card (its text is on the left), filling most of its height.
    const tall = (c.body ? 0.55 : 0.9) * H;
    const cx = c.body ? W * 0.5 : Math.max(W * 0.5, W - tall * 1.05);
    const focal = (tall * S * CAM[2]) / (FRAME.half * 2);
    const principal: [number, number] = [cx * S, ah * (c.body ? 0.2 : 0.045) + (focal * CAM[1]) / CAM[2]];
    // The lamp: warm, bright enough to light the hourglass's middle about as much as a sunny room.
    const d2 = LIGHT[0] ** 2 + (LIGHT[1] - FRAME.half) ** 2 + LIGHT[2] ** 2;
    const lightColor: [number, number, number] = [1.0 * 1.35 * d2, 0.8 * 1.35 * d2, 0.58 * 1.35 * d2];
    const [sr, sg, sb] = rgb(c.palette[1]).map(toLinear);
    const peak = Math.max(sr, sg, sb, 1e-3);
    const sand: [number, number, number] = [(sr / peak) * 0.55, (sg / peak) * 0.55, (sb / peak) * 0.55];
    const renderer = createHourglassRenderer({
      width: aw,
      height: ah,
      room: bakeRoom(aw, ah, principal, focal, lightColor),
      cam: CAM,
      principal,
      focal,
      light: LIGHT,
      lightColor,
      sand,
      foot: CAM[2] / focal,
    });
    if (!renderer) return HOURGLASS_2D.create(c);

    const glass = createSand();
    let view = glass.step(0, 40);
    let yaw = 0.35;
    let clock = 0;
    // The camera control: a drag turns the glass round at once; tilting (the camera higher or lower, still looking
    // level) and zoom (closer) need the room baked again for the new camera — a moment after it stops moving.
    const orbit = createOrbit(c, { pitch: [-12, 40], zoom: [0.6, 2.5] });
    const baseY = ah * (c.body ? 0.2 : 0.045);
    let viewSeen = 0;
    let viewAt = 0;
    let viewBaked = true;
    let sinceFrame = Infinity;
    const toLocal = new Float32Array(9);
    const frame = {
      toLocal,
      center: [0, FRAME.half, 0] as [number, number, number],
      parity: 1,
      top: [0, 0, 0, 0] as [number, number, number, number],
      bottom: [0, 0, 0, 0] as [number, number, number, number],
      stream: [0, 0, 0, 0] as [number, number, number, number],
      time: 0,
      exposure: 1,
      samples: 2,
    };

    return {
      update(dt, t, pIn) {
        const p = orbit.update(pIn);
        const step = Math.min(dt, 0.05);
        clock += step;
        if (orbit.version !== viewSeen) {
          viewSeen = orbit.version;
          viewAt = clock;
          viewBaked = false;
        }
        if (!viewBaked && clock - viewAt > 0.15) {
          viewBaked = true;
          const dist = CAM0[2] / orbit.zoom;
          const height = clamp(CAM0[1] + dist * Math.tan(orbit.pitch), 0.45, 14);
          const cam: [number, number, number] = [0, height, dist];
          const pr: [number, number] = [principal[0], baseY + (focal * height) / dist];
          renderer.setView({ cam, principal: pr, focal, room: bakeRoom(aw, ah, pr, focal, lightColor, cam), foot: dist / focal });
          sinceFrame = Infinity;
        }
        if (p.clicked && !glass.turning) glass.turnOver();
        view = glass.step(step, 40 / clamp(c.params.speed, 0.1, 5));
        const target = p.active ? (p.x / W - 0.5) * 1.8 * c.params.react + 0.35 : 0.35 + Math.sin(t * 0.22) * 0.55;
        yaw += (target - yaw) * Math.min(1, step * 3);
        sinceFrame += step;
      },
      draw(g) {
        if (sinceFrame >= 1 / 30) {
          sinceFrame = 0;
          // The glass turned over k times plus the current turn; the sand's own frame flips with each finished turn.
          const angle = (view.parity === 1 ? 0 : Math.PI) + view.turn;
          const ext = FRAME.half * Math.abs(Math.cos(angle)) + FRAME.capR * Math.abs(Math.sin(angle));
          const lift = Math.max(ext, FRAME.half) + 0.28 * Math.sin(view.turn);
          const cz = Math.cos(-angle);
          const sz = Math.sin(-angle);
          const cy = Math.cos(-yaw - orbit.yaw);
          const sy = Math.sin(-yaw - orbit.yaw);
          // world → glass = Ry(−yaw) · Rz(−angle), stored column by column.
          const m = [
            [cy * cz, -cy * sz, sy],
            [sz, cz, 0],
            [-sy * cz, sy * sz, cy],
          ];
          for (let col = 0; col < 3; col += 1) for (let row = 0; row < 3; row += 1) toLocal[col * 3 + row] = m[row][col];
          frame.center[1] = lift;
          frame.parity = view.parity;
          frame.top[0] = view.level;
          frame.top[1] = view.funnel;
          frame.top[2] = view.upperDrop;
          frame.bottom[0] = view.bed;
          frame.bottom[1] = view.apex;
          frame.bottom[2] = view.lowerDrop;
          frame.stream[0] = view.tail;
          frame.stream[1] = view.head;
          frame.stream[2] = view.land;
          frame.stream[3] = view.streaming ? 1 : 0;
          frame.time = clock % 600;
          frame.exposure = clamp(c.params.intensity, 0.2, 3);
          // A sharp (high-dpi) screen already has several pixels per point: one ray each is enough there.
          frame.samples = c.params.quality >= 0.9 ? 4 : c.params.quality >= 0.6 && S < 1.5 ? 2 : 1;
          renderer.render(frame);
        }
        g.drawImage(renderer.canvas, 0, 0, W, H);
        orbit.draw(g);
      },
      dispose() {
        orbit.dispose();
        renderer.dispose();
      },
    };
  },
};
