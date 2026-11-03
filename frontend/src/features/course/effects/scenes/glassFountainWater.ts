/**
 * The neon glass fountain's water as particles (its «Вода: частицы» mode; drawn by glassFountainGL.ts as a liquid on
 * the screen). Centimetres and seconds, y up, as the tracer.
 *
 * Both streams leave their leaf's spout in a jittered, pulsing flow (the pour is never quite steady). In the air:
 * gravity and a little drag. The first stream ends in the lower leaf's dish. The second comes down on the glass ball,
 * and there the water clings: a drop that reaches the ball is held to its surface (its speed into the ball taken
 * away, a little friction) and runs down it under the part of gravity along the surface; it stays on while the ball
 * can bend its path — while v²/R is no more than gravity's push into the ball plus the adhesion — so the film wraps
 * round the top, thins over the sides and lets go below the equator, dripping from the bottom. On the ball the drops
 * keep apart (a push between close neighbours, over a grid), so they spread into a film and part into rivulets
 * instead of sliding as one thread. Below, the crystal lotus's outer petals catch what falls on them and shed it
 * outwards; whatever reaches the tray's water is gone and leaves a ripple there (a ring the tracer draws).
 */

import type { GlassLayout } from './glassFountainGL';

export type GlassWaterParams = {
  /** Flow, × the base rate. */
  rate: number;
  /** Adhesion to the glass, cm/s². */
  adhesion: number;
  /** How unsteady the pour is (0 … 2). */
  wobble: number;
  /** How viscous the film on the ball is (its damping, 1/s). */
  viscosity: number;
  /** Detail: × the number of drops, each smaller (radius × detail^(−1/3): the same water). */
  detail: number;
};

const G = 981;
const MAX = 24000;
/** A ripple in the tray: x, z, its start (s), strength. */
export type Ripple = [number, number, number, number];

export function createGlassWater(L: GlassLayout, seed = 1) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const px = new Float32Array(MAX), py = new Float32Array(MAX), pz = new Float32Array(MAX);
  const vx = new Float32Array(MAX), vy = new Float32Array(MAX), vz = new Float32Array(MAX);
  const rad = new Float32Array(MAX);
  /** 0 free, 1 flying, 2 on the ball, 3 on a petal. */
  const st = new Uint8Array(MAX);
  const free: number[] = [];
  for (let i = MAX - 1; i >= 0; i -= 1) free.push(i);
  let count = 0;
  const ripples: Ripple[] = [];
  let time = 0;
  const carry = [0, 0];

  // A grid on the ball for keeping the film's drops apart.
  const GN = 24;
  const cellHead = new Int32Array(GN * GN * GN);
  const cellNext = new Int32Array(MAX);
  const gExt = L.ballR + 1;

  /** A drop leaving spout k, already `tau` seconds on its way (drops leaving within one step are spread over it,
   * not bunched at the lip). */
  const spawn = (k: number, p: GlassWaterParams, tau: number) => {
    const i = free.pop();
    if (i === undefined) return;
    const sp = k === 0 ? L.spout1 : L.spout2;
    const a = k === 0 ? L.dir1 : L.dir2;
    const speed = (k === 0 ? 26 : 22) * (1 + 0.12 * p.wobble * Math.sin(time * 5.3 + k) + 0.05 * (rnd() - 0.5));
    // Across the lip: the stream is a ribbon a few millimetres wide, wobbling sideways.
    const side = (rnd() - 0.5) * 0.45 + 0.25 * p.wobble * Math.sin(time * 3.1 + k * 2);
    const ca = Math.cos(a), sa = Math.sin(a);
    px[i] = sp[0] - sa * side; py[i] = sp[1] + (rnd() - 0.5) * 0.15; pz[i] = sp[2] + ca * side;
    vx[i] = ca * speed + (rnd() - 0.5) * 3 * p.wobble; vy[i] = -2 + (rnd() - 0.5) * 3; vz[i] = sa * speed + (rnd() - 0.5) * 3 * p.wobble;
    rad[i] = (0.14 + rnd() * 0.09) * Math.cbrt(1 / Math.max(p.detail, 0.2));
    px[i] += vx[i] * tau; pz[i] += vz[i] * tau; py[i] += vy[i] * tau - 0.5 * G * tau * tau; vy[i] -= G * tau;
    st[i] = 1;
    count += 1;
  };
  const kill = (i: number) => {
    st[i] = 0;
    free.push(i);
    count -= 1;
  };
  const ripple = (x: number, z: number, amp: number) => {
    // Nearby ripples merge (no more than one ring per spot at a time).
    for (const r of ripples) if ((r[0] - x) ** 2 + (r[1] - z) ** 2 < 0.8 && time - r[2] < 0.12) { r[3] = Math.min(1.5, r[3] + amp * 0.3); return; }
    ripples.push([x, z, time, amp]);
    if (ripples.length > 16) ripples.shift();
  };

  return {
    px, py, pz, vx, vy, vz, rad, st,
    get count() { return count; },
    ripples,
    get time() { return time; },
    step(dtIn: number, p: GlassWaterParams) {
      const sub = Math.max(1, Math.ceil(dtIn / (1 / 120)));
      const dt = dtIn / sub;
      for (let ss = 0; ss < sub; ss += 1) {
        time += dt;
        // The pour pulses: a slow swell and quick flutter.
        const pulse = Math.max(0.2, 1 + 0.35 * p.wobble * Math.sin(time * 1.7) + 0.15 * p.wobble * Math.sin(time * 6.1));
        carry[0] += 1100 * p.rate * p.detail * pulse * dt;
        carry[1] += 1500 * p.rate * p.detail * pulse * dt;
        for (let k = 0; k < 2; k += 1) {
          const m = Math.floor(carry[k]);
          for (let j = 0; j < m; j += 1) spawn(k, p, dt * (1 - (j + 0.5) / m));
          carry[k] -= m;
        }
        // The film's neighbours.
        cellHead.fill(-1);
        const cs = (2 * gExt) / GN;
        for (let i = 0; i < MAX; i += 1) {
          if (st[i] !== 2) continue;
          const gi = Math.min(GN - 1, Math.max(0, Math.floor((px[i] - L.ball[0] + gExt) / cs)));
          const gj = Math.min(GN - 1, Math.max(0, Math.floor((py[i] - L.ball[1] + gExt) / cs)));
          const gk = Math.min(GN - 1, Math.max(0, Math.floor((pz[i] - L.ball[2] + gExt) / cs)));
          const c = (gk * GN + gj) * GN + gi;
          cellNext[i] = cellHead[c];
          cellHead[c] = i;
        }
        const spacing = 0.26 * Math.cbrt(1 / Math.max(p.detail, 0.2));
        for (let i = 0; i < MAX; i += 1) {
          const state = st[i];
          if (state === 0) continue;
          if (state === 1) {
            const sp = Math.hypot(vx[i], vy[i], vz[i]);
            const drag = 0.02 * sp;
            vx[i] -= vx[i] * drag * dt; vz[i] -= vz[i] * drag * dt;
            vy[i] += (-G - vy[i] * drag) * dt;
            px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
          } else if (state === 2) {
            // On the ball: held to its surface, running down it.
            let nx = px[i] - L.ball[0], ny = py[i] - L.ball[1], nz = pz[i] - L.ball[2];
            const r = Math.hypot(nx, ny, nz) || 1;
            nx /= r; ny /= r; nz /= r;
            // Gravity along the surface.
            const gn = -G * ny;
            let ax = -gn * nx, ay = -G - gn * ny, az = -gn * nz;
            // Neighbours push apart (over the grid's cell and its neighbours).
            const gi = Math.min(GN - 1, Math.max(0, Math.floor((px[i] - L.ball[0] + gExt) / cs)));
            const gj = Math.min(GN - 1, Math.max(0, Math.floor((py[i] - L.ball[1] + gExt) / cs)));
            const gk = Math.min(GN - 1, Math.max(0, Math.floor((pz[i] - L.ball[2] + gExt) / cs)));
            for (let dk = -1; dk <= 1; dk += 1) {
              for (let dj = -1; dj <= 1; dj += 1) {
                for (let di = -1; di <= 1; di += 1) {
                  const a = gi + di, b = gj + dj, cc = gk + dk;
                  if (a < 0 || b < 0 || cc < 0 || a >= GN || b >= GN || cc >= GN) continue;
                  for (let j = cellHead[(cc * GN + b) * GN + a]; j >= 0; j = cellNext[j]) {
                    if (j === i) continue;
                    const dx = px[i] - px[j], dy = py[i] - py[j], dz = pz[i] - pz[j];
                    const d2 = dx * dx + dy * dy + dz * dz;
                    if (d2 > spacing * spacing || d2 < 1e-8) continue;
                    const d = Math.sqrt(d2);
                    const push = (spacing - d) / spacing * 900;
                    ax += (dx / d) * push; ay += (dy / d) * push; az += (dz / d) * push;
                  }
                }
              }
            }
            vx[i] += ax * dt; vy[i] += ay * dt; vz[i] += az * dt;
            // Only along the surface; the film is viscous: it creeps over the glass at a few centimetres a second, not
            // sliding freely (a thin film on a ball runs at roughly g·h²/ν).
            const vn = vx[i] * nx + vy[i] * ny + vz[i] * nz;
            vx[i] -= vn * nx; vy[i] -= vn * ny; vz[i] -= vn * nz;
            const damp = Math.exp(-dt * p.viscosity);
            vx[i] *= damp; vy[i] *= damp; vz[i] *= damp;
            px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
            // Back onto the surface (a film rad thick).
            const R = L.ballR + rad[i] * 0.6;
            let qx = px[i] - L.ball[0], qy = py[i] - L.ball[1], qz = pz[i] - L.ball[2];
            const ql = Math.hypot(qx, qy, qz) || 1;
            qx /= ql; qy /= ql; qz /= ql;
            px[i] = L.ball[0] + qx * R; py[i] = L.ball[1] + qy * R; pz[i] = L.ball[2] + qz * R;
            // Lets go when the ball can no longer bend its path (or it reaches the lotus under the ball).
            const v2 = vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i];
            if (v2 / R > p.adhesion + G * qy || qy < -0.93 || (qy < -0.55 && rnd() < dt * 2)) {
              st[i] = 1;
              vx[i] += qx * 4; vy[i] += qy * 4; vz[i] += qz * 4;
            }
          } else if (state === 3) {
            // On a petal: sliding outwards and down its slope, then off its tip.
            const dx = px[i] - L.lotus[0], dz = pz[i] - L.lotus[2];
            const r = Math.hypot(dx, dz) || 1;
            const out = 14 * dt;
            px[i] += (dx / r) * out + vx[i] * dt; pz[i] += (dz / r) * out + vz[i] * dt;
            vx[i] *= Math.exp(-dt * 4); vz[i] *= Math.exp(-dt * 4);
            const r2 = r + out;
            py[i] = 0.42 + 0.06 * (r2 - 3.05) ** 2 + 0.17 + rad[i] * 0.5;
            if (r2 > 4.9) {
              st[i] = 1;
              vx[i] = (dx / r) * 14; vz[i] = (dz / r) * 14; vy[i] = 0;
            }
          }
          // Collisions of a falling drop.
          if (st[i] !== 1) continue;
          // The ball: it catches the drop.
          const bx = px[i] - L.ball[0], by = py[i] - L.ball[1], bz = pz[i] - L.ball[2];
          const br = Math.hypot(bx, by, bz);
          if (br < L.ballR + rad[i] * 0.6 && vx[i] * bx + vy[i] * by + vz[i] * bz < 0) {
            // A hard hit throws a little back off (a splash), the rest clings.
            const vnIn = -(vx[i] * bx + vy[i] * by + vz[i] * bz) / br;
            if (vnIn > 120 && rnd() < 0.12) {
              const k = 0.35;
              vx[i] = vx[i] * 0.4 + (bx / br) * vnIn * k + (rnd() - 0.5) * 30;
              vy[i] = vy[i] * 0.2 + (by / br) * vnIn * k;
              vz[i] = vz[i] * 0.4 + (bz / br) * vnIn * k + (rnd() - 0.5) * 30;
            } else {
              st[i] = 2;
              const vn = (vx[i] * bx + vy[i] * by + vz[i] * bz) / br;
              vx[i] -= (vn * bx) / br; vy[i] -= (vn * by) / br; vz[i] -= (vn * bz) / br;
              vx[i] *= 0.7; vy[i] *= 0.7; vz[i] *= 0.7;
            }
            continue;
          }
          // The lower leaf's dish catches the first stream.
          const lx = px[i] - L.leaf1[0], lz = pz[i] - L.leaf1[2];
          if (lx * lx + lz * lz < L.leaf1R * L.leaf1R * 0.7 && py[i] < L.leaf1[1] + 0.3 && vy[i] < 0) {
            kill(i);
            continue;
          }
          // The lotus's outer petals.
          const ox = px[i] - L.lotus[0], oz = pz[i] - L.lotus[2];
          const orr = Math.hypot(ox, oz);
          if (orr > 1.3 && orr < 4.9 && vy[i] < 0) {
            const surf = 0.42 + 0.06 * (orr - 3.05) ** 2 + 0.17;
            if (py[i] < surf + rad[i] * 0.5 && py[i] > surf - 0.6) {
              st[i] = 3;
              vx[i] *= 0.3; vz[i] *= 0.3; vy[i] = 0;
              continue;
            }
          }
          // The tray's water.
          if (py[i] < L.waterY && Math.max(Math.abs(px[i]), Math.abs(pz[i])) < L.tray) {
            ripple(px[i], pz[i], Math.min(1, -vy[i] / 300));
            kill(i);
            continue;
          }
          if (py[i] < -12) kill(i);
        }
      }
      while (ripples.length && time - ripples[0][2] > 3) ripples.shift();
    },
  };
}

export type GlassWater = ReturnType<typeof createGlassWater>;
