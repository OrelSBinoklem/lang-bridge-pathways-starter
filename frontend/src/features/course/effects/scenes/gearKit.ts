import { TAU, mixHex, rgba } from './kit';

/**
 * Shared machinery for scenes with real-looking gears (the workshop gear train, the watch movement).
 *
 * A gear is painted once into a sprite: an involute-like tooth outline (addendum m, dedendum 1.25m, teeth thicker at
 * the root than at the tip), lathe rings, spoke windows cut out, a raised hub and a hex nut on the axle. Everything
 * that depends on where the light is — the bow-tie sheen of turned metal, which points at the light whatever the
 * gear's angle, and the overall light-to-shade gradient — is laid on every frame in screen space, only where the gear
 * has metal (source-atop on a small canvas of its own). A soft shadow sprite is painted once as well.
 *
 * Meshing: gear b driven by gear a, touching at angle θ (from a's centre towards b's), turns at −z_a/z_b of a's rate,
 * with a phase that puts a gap of b wherever a has a tooth: φ_b = θ + π + π/z_b − (φ_a − θ)·z_a/z_b. Both phases are
 * linear in the driving angle, so a whole train is described by φ_i = c_i + k_i·φ₀ (see `solveTrain`).
 */

export type GearMaterial = { base: string; light: string; dark: string };
export const BRASS: GearMaterial = { base: '#c9a24a', light: '#f4dc92', dark: '#6a4a18' };
export const STEEL: GearMaterial = { base: '#a8b0b8', light: '#eef2f6', dark: '#3a4048' };
export const COPPER: GearMaterial = { base: '#c87a4e', light: '#f6c0a0', dark: '#5a2a14' };
export const GUNMETAL: GearMaterial = { base: '#6c747c', light: '#c8d0d8', dark: '#22262c' };
export const GOLD: GearMaterial = { base: '#d8b050', light: '#fff0b0', dark: '#7a5a1a' };

export type GearSpec = { z: number; m: number; mat: GearMaterial; spokes?: number; hub?: number; ringed?: boolean; /** A watch escape wheel's club teeth instead of gear teeth. */ escape?: boolean };
export type GearSprite = { cv: HTMLCanvasElement; shadow: HTMLCanvasElement; half: number; ra: number; rp: number; rf: number; S: number };

export const pitchRadius = (z: number, m: number) => (m * z) / 2;

/** The tooth outline of a gear centred at 0,0, tooth 0 pointing along +x. */
export function gearOutline(g: CanvasRenderingContext2D, z: number, m: number) {
  const rp = pitchRadius(z, m);
  const ra = rp + m;
  const rf = rp - 1.25 * m;
  const step = TAU / z;
  const hwRoot = (Math.PI / z) * 0.62;
  const hwPitch = (Math.PI / z) * 0.5;
  const hwTip = (Math.PI / z) * 0.3;
  const at = (a: number, r: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];
  g.beginPath();
  for (let k = 0; k < z; k += 1) {
    const a = k * step;
    const p0 = at(a - step / 2, rf);
    if (k === 0) g.moveTo(...p0);
    g.arc(0, 0, rf, a - step / 2, a - hwRoot);
    g.quadraticCurveTo(...at(a - hwPitch * 1.02, rp), ...at(a - hwTip, ra));
    g.arc(0, 0, ra, a - hwTip, a + hwTip);
    g.quadraticCurveTo(...at(a + hwPitch * 1.02, rp), ...at(a + hwRoot, rf));
    g.arc(0, 0, rf, a + hwRoot, a + step / 2);
  }
  g.closePath();
}

/** A Swiss lever escape wheel: slanted teeth ending in a small flat club (the impulse face), tooth 0 along +x. */
export function escapeOutline(g: CanvasRenderingContext2D, z: number, m: number) {
  const rp = pitchRadius(z, m);
  const ra = rp + m;
  const rf = rp - 1.25 * m;
  const step = TAU / z;
  const at = (a: number, r: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];
  g.beginPath();
  for (let k = 0; k < z; k += 1) {
    const a = k * step;
    if (k === 0) g.moveTo(...at(a - step * 0.35, rf));
    g.quadraticCurveTo(...at(a - step * 0.12, rf + (ra - rf) * 0.4), ...at(a, ra));
    g.lineTo(...at(a + step * 0.16, ra - (ra - rf) * 0.12));
    g.lineTo(...at(a + step * 0.2, ra - (ra - rf) * 0.35));
    g.quadraticCurveTo(...at(a + step * 0.26, rf + (ra - rf) * 0.2), ...at(a + step * 0.5, rf));
    g.arc(0, 0, rf, a + step * 0.5, a + step * 0.65);
  }
  g.closePath();
}

export function makeGearSprite(spec: GearSpec, S: number, rand: () => number): GearSprite {
  const { z, m, mat } = spec;
  const outline = spec.escape ? escapeOutline : gearOutline;
  const rp = pitchRadius(z, m);
  const ra = rp + m;
  const rf = rp - 1.25 * m;
  const pad = m * 3;
  const half = ra + pad;
  const make = () => {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(half * 2 * S);
    cv.height = cv.width;
    const g = cv.getContext('2d')!;
    g.scale(S, S);
    g.translate(half, half);
    return { cv, g };
  };
  const { cv, g } = make();
  outline(g, z, m);
  const body = g.createRadialGradient(0, 0, 0, 0, 0, ra);
  body.addColorStop(0, mixHex(mat.base, mat.light, 0.12));
  body.addColorStop(0.85, mat.base);
  body.addColorStop(1, mixHex(mat.base, mat.dark, 0.35));
  g.fillStyle = body;
  g.fill();
  g.save();
  outline(g, z, m);
  g.clip();
  // Lathe rings.
  for (let r = 1; r < ra; r += 0.7 + rand() * 1.2) {
    g.strokeStyle = rand() < 0.5 ? rgba(mat.light, 0.05 + rand() * 0.08) : rgba(mat.dark, 0.05 + rand() * 0.08);
    g.lineWidth = 0.4 + rand() * 0.6;
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.stroke();
  }
  g.restore();
  const hub = spec.hub ?? Math.max(m * 2.2, rp * 0.22);
  const rimIn = rf - 2 * m;
  const spokes = spec.spokes ?? 0;
  if (spokes > 0 && rimIn > hub * 1.8) {
    // Windows between the spokes, cut through, with rounded corners.
    g.save();
    g.globalCompositeOperation = 'destination-out';
    const sw = Math.max(m * 1.1, rimIn * 0.12);
    for (let s = 0; s < spokes; s += 1) {
      const a0 = (s / spokes) * TAU;
      const a1 = ((s + 1) / spokes) * TAU;
      const gapOut = sw / 2 / rimIn;
      const gapIn = sw / 2 / (hub * 1.5);
      g.beginPath();
      g.arc(0, 0, rimIn - m * 0.3, a0 + gapOut, a1 - gapOut);
      g.arc(0, 0, hub * 1.5 + m * 0.3, a1 - gapIn, a0 + gapIn, true);
      g.closePath();
      g.fill();
      g.lineJoin = 'round';
      g.lineWidth = m * 0.6;
      g.stroke();
    }
    g.restore();
    // The rim's inner edge and the spokes' edges catch a darker line.
    g.strokeStyle = rgba(mat.dark, 0.45);
    g.lineWidth = Math.max(0.6, m * 0.18);
    g.beginPath();
    g.arc(0, 0, rimIn, 0, TAU);
    g.stroke();
  } else if (spec.ringed !== false) {
    g.strokeStyle = rgba(mat.dark, 0.35);
    g.lineWidth = Math.max(0.6, m * 0.15);
    g.beginPath();
    g.arc(0, 0, rimIn, 0, TAU);
    g.stroke();
    g.strokeStyle = rgba(mat.light, 0.25);
    g.beginPath();
    g.arc(0, 0, rimIn - m * 0.2, 0, TAU);
    g.stroke();
  }
  // The raised hub, the axle and its nut.
  const hg = g.createRadialGradient(-hub * 0.3, -hub * 0.3, 0, 0, 0, hub * 1.5);
  hg.addColorStop(0, mixHex(mat.base, mat.light, 0.35));
  hg.addColorStop(1, mixHex(mat.base, mat.dark, 0.25));
  g.fillStyle = hg;
  g.beginPath();
  g.arc(0, 0, hub * 1.5, 0, TAU);
  g.fill();
  g.strokeStyle = rgba(mat.dark, 0.55);
  g.lineWidth = Math.max(0.6, m * 0.2);
  g.stroke();
  g.fillStyle = mixHex(STEEL.base, STEEL.dark, 0.2);
  g.beginPath();
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * TAU;
    const x = Math.cos(a) * hub * 0.75;
    const y = Math.sin(a) * hub * 0.75;
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = rgba(STEEL.light, 0.5);
  g.lineWidth = Math.max(0.5, m * 0.1);
  g.stroke();
  g.fillStyle = '#1a1c20';
  g.beginPath();
  g.arc(0, 0, hub * 0.32, 0, TAU);
  g.fill();
  outline(g, z, m);
  g.strokeStyle = rgba(mat.dark, 0.5);
  g.lineWidth = Math.max(0.5, m * 0.12);
  g.stroke();

  // The shadow: the silhouette, blurred, painted beside the canvas so only its shadow lands on it.
  const sh = make();
  sh.g.shadowColor = 'rgba(0,0,0,0.75)';
  sh.g.shadowBlur = m * 2.2 * S;
  sh.g.shadowOffsetX = 4000 * S;
  sh.g.translate(-4000, 0);
  outline(sh.g, z, m);
  sh.g.fillStyle = '#000';
  sh.g.fill();
  return { cv, shadow: sh.cv, half, ra, rp, rf, S };
}

/**
 * Draws gears lit from a fixed direction. Keeps one scratch canvas per sprite.
 * `light` is the screen angle the light comes from (e.g. −2.3 for the upper left).
 */
export function createGearPainter(light: number) {
  const scratch = new Map<GearSprite, { cv: HTMLCanvasElement; g: CanvasRenderingContext2D }>();
  const lx = Math.cos(light);
  const ly = Math.sin(light);
  return {
    shadow(g: CanvasRenderingContext2D, sp: GearSprite, x: number, y: number, angle: number, lift: number, alpha = 0.55) {
      g.save();
      g.globalAlpha = alpha;
      g.translate(x - lx * lift, y - ly * lift);
      g.rotate(angle);
      g.drawImage(sp.shadow, -sp.half, -sp.half, sp.half * 2, sp.half * 2);
      g.restore();
    },
    gear(g: CanvasRenderingContext2D, sp: GearSprite, x: number, y: number, angle: number, mat: GearMaterial, sheen = 1) {
      let sc = scratch.get(sp);
      if (!sc) {
        const cv = document.createElement('canvas');
        cv.width = sp.cv.width;
        cv.height = sp.cv.height;
        sc = { cv, g: cv.getContext('2d')! };
        scratch.set(sp, sc);
      }
      const o = sc.g;
      const n = sp.cv.width;
      const c = n / 2;
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.globalCompositeOperation = 'source-over';
      o.clearRect(0, 0, n, n);
      o.translate(c, c);
      o.rotate(angle);
      o.drawImage(sp.cv, -c, -c);
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.globalCompositeOperation = 'source-atop';
      const R = sp.ra * sp.S;
      // Light to shade across the whole gear.
      const lin = o.createLinearGradient(c + lx * R, c + ly * R, c - lx * R, c - ly * R);
      lin.addColorStop(0, rgba(mat.light, 0.28));
      lin.addColorStop(0.5, 'rgba(0,0,0,0)');
      lin.addColorStop(1, rgba(mat.dark, 0.45));
      o.fillStyle = lin;
      o.fillRect(0, 0, n, n);
      // The bow-tie sheen of turned metal, along the line to the light.
      if (sheen > 0 && typeof o.createConicGradient === 'function') {
        const cg = o.createConicGradient(light, c, c);
        const a = 0.34 * sheen;
        cg.addColorStop(0, rgba(mat.light, a));
        cg.addColorStop(0.06, rgba(mat.light, a * 0.25));
        cg.addColorStop(0.14, 'rgba(255,255,255,0)');
        cg.addColorStop(0.36, 'rgba(255,255,255,0)');
        cg.addColorStop(0.44, rgba(mat.light, a * 0.15));
        cg.addColorStop(0.5, rgba(mat.light, a * 0.55));
        cg.addColorStop(0.56, rgba(mat.light, a * 0.15));
        cg.addColorStop(0.64, 'rgba(255,255,255,0)');
        cg.addColorStop(0.86, 'rgba(255,255,255,0)');
        cg.addColorStop(0.94, rgba(mat.light, a * 0.25));
        cg.addColorStop(1, rgba(mat.light, a));
        o.fillStyle = cg;
        o.fillRect(0, 0, n, n);
      }
      o.globalCompositeOperation = 'source-over';
      g.drawImage(sc.cv, x - sp.half, y - sp.half, sp.half * 2, sp.half * 2);
    },
  };
}

export type TrainGear = { z: number; parent: number; /** Angle from the parent's centre, or −1 for the same shaft. */ contact: number };

/** Phases of a gear train as φ_i = c_i + k_i·φ₀ (gear 0 drives). */
export function solveTrain(gears: TrainGear[]) {
  const k: number[] = [];
  const c: number[] = [];
  gears.forEach((gr, i) => {
    if (i === 0 || gr.parent < 0) {
      k.push(1);
      c.push(0);
      return;
    }
    const p = gr.parent;
    if (gr.contact === -1) {
      k.push(k[p]);
      c.push(c[p]);
      return;
    }
    const ratio = gears[p].z / gr.z;
    const th = gr.contact;
    k.push(-ratio * k[p]);
    c.push(th * (1 + ratio) + Math.PI + Math.PI / gr.z - ratio * c[p]);
  });
  return { k, c };
}
