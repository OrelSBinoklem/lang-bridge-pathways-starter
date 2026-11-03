import type { CanvasSceneDef } from './types';
import { createLiquidTimer, TIMER_RAMPS, TIMER_VOLUME, TIMER_POOL_SCALE, timerRadius } from './liquidTimerPhysics';

const TAU = Math.PI * 2;
const MW = 400, MH = 640;
const silhouette = () => new Path2D('M98 36 Q200 27 302 36 C322 58 337 97 330 130 C303 242 302 383 327 507 Q344 562 313 585 Q200 601 87 585 Q56 562 73 507 C98 383 97 242 70 130 C63 97 78 58 98 36 Z');
function canvas(w: number, h: number) {
  const image = document.createElement('canvas'); image.width = Math.ceil(w); image.height = Math.ceil(h);
  return image;
}
function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
}
function linear(g: CanvasRenderingContext2D, x: number, y: number, ex: number, ey: number, stops: [number, string][]) {
  const gradient = g.createLinearGradient(x, y, ex, ey);
  for (const [at, color] of stops) gradient.addColorStop(at, color);
  return gradient;
}

/** Analytic sphere-normal / Fresnel material baked into two tiny textures, not evaluated per pixel per frame. */
function dropMaterial(hex: string) {
  const texture = canvas(96, 96), g = texture.getContext('2d')!;
  const pixels = g.createImageData(96, 96);
  const color = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255);
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const nx = (x + 0.5 - 48) / 44, ny = (y + 0.5 - 48) / 44;
    const r2 = nx * nx + ny * ny;
    if (r2 >= 1) continue;
    const nz = Math.sqrt(1 - r2), fresnel = 0.025 + 0.975 * (1 - nz) ** 5;
    const softbox = Math.exp(-((nx + 0.32) ** 2 / 0.024 + (ny + 0.48) ** 2 / 0.009));
    const strip = Math.exp(-((nx - 0.68) ** 2 / 0.003 + (ny + 0.1) ** 2 / 0.14));
    const caustic = Math.exp(-((ny - 0.65) ** 2 / 0.018 + nx ** 2 / 0.34));
    const offset = (y * 96 + x) * 4;
    for (let ch = 0; ch < 3; ch++) {
      const absorption = color[ch] * (.65 + .23 * nz) * (1 - fresnel * .3);
      pixels.data[offset + ch] = Math.min(255, 255 * (absorption + softbox * .8 + strip * .45 + caustic * .24));
    }
    pixels.data[offset + 3] = Math.min(1, (1 - Math.sqrt(r2)) * 44) * (.27 + nz * .18 + fresnel * .27 + softbox * .35) * 255;
  }
  g.putImageData(pixels, 0, 0);
  return texture;
}

export const LIQUID_TIMER: CanvasSceneDef = {
  kind: 'canvas', id: 'liquid-cascade-timer', label: 'Жидкостный таймер · стекло и капли',
  palettes: [['#131c24', '#ec397d', '#08a9cc', '#fff0d9'], ['#101a20', '#ff9d22', '#1cbca5', '#e8f8ff'], ['#171525', '#9e5bed', '#e9ba36', '#fff1e2']],
  pixelRatioCap: 2,
  warmupFrames: 1,
  defaultParams: { speed: 1, intensity: 1, react: 1 },
  create(c) {
    const sim = createLiquidTimer(c.rand);
    // A populated, conserved initial state also gives lazy gallery posters a representative frame.
    for (let i = 0; i < 3000; i++) sim.update(1 / 120);
    const scale = Math.min(c.width / 500, c.height / 690);
    const originX = (c.width - MW * scale) / 2;
    const originY = (c.height - MH * scale) / 2;
    // Cap the large baked background separately; the glass/droplets retain up to 2x display density.
    const bgRatio = Math.min(c.dpr, 1.5, Math.sqrt(3_000_000 / (c.width * c.height)));
    const backdrop = canvas(c.width * bgRatio, c.height * bgRatio);
    const bg = backdrop.getContext('2d')!;
    bg.scale(bgRatio, bgRatio);
    bg.fillStyle = linear(bg, 0, 0, c.width, c.height, [[0, '#3b4145'], [0.44, '#6e6c65'], [0.69, '#b3afa4'], [1, '#ded6c9']]);
    bg.fillRect(0, 0, c.width, c.height);
    // Broad blurred studio reflections; no image downloads or full-frame blur in the animation loop.
    for (const [x, y, r, color] of [[0.16, 0.18, 0.65, '#ffe7be'], [0.9, 0.25, 0.45, '#d4f3ff']] as const) {
      const radius = Math.max(c.width, c.height) * r;
      const halo = bg.createRadialGradient(c.width * x, c.height * y, 0, c.width * x, c.height * y, radius);
      halo.addColorStop(0, `${color}55`); halo.addColorStop(1, `${color}00`);
      bg.fillStyle = halo; bg.fillRect(0, 0, c.width, c.height);
    }
    bg.fillStyle = 'rgba(238,243,239,.09)'; bg.fillRect(c.width * 0.12, 0, c.width * 0.035, c.height * 0.65);
    // Contact shadow is static too. Elliptical gradient, not an expensive live shadowBlur.
    bg.save(); bg.translate(c.width / 2, originY + 598 * scale); bg.scale(1, 0.18);
    const shadow = bg.createRadialGradient(0, 0, 12 * scale, 0, 0, 175 * scale);
    shadow.addColorStop(0, '#171c25b0'); shadow.addColorStop(0.5, '#25293045'); shadow.addColorStop(1, '#25293000');
    bg.fillStyle = shadow; ellipse(bg, 0, 0, 175 * scale, 175 * scale); bg.restore();

    const density = Math.min(2.5, Math.max(1, scale * c.dpr));
    const rear = canvas(MW * density, MH * density), front = canvas(MW * density, MH * density);
    const r = rear.getContext('2d')!, f = front.getContext('2d')!;
    r.scale(density, density); f.scale(density, density);
    const body = silhouette();
    r.save(); r.clip(body);
    r.fillStyle = linear(r, 55, 0, 345, 0, [[0, '#c8edf544'], [0.12, '#ffffff09'], [0.49, '#6b7f7e10'], [0.88, '#d3f2fa18'], [1, '#effaff65']]);
    r.fillRect(50, 25, 300, 580);
    // Refracted vertical studio bands inside the vessel.
    r.fillStyle = linear(r, 80, 0, 125, 0, [[0, '#ffffff00'], [0.25, '#e1f7ff50'], [0.4, '#ffffff04'], [1, '#d6f8ff00']]);
    r.fillRect(68, 40, 60, 550);
    r.fillStyle = linear(r, 284, 0, 327, 0, [[0, '#ffffff00'], [0.4, '#ffffff22'], [0.65, '#e0f4ff55'], [1, '#ffffff00']]);
    r.fillRect(284, 40, 43, 550);
    for (const ramp of [...TIMER_RAMPS].sort((a, b) => b.lane - a.lane)) {
      r.save();
      const angle = Math.atan2(ramp.endY - ramp.y, ramp.endX - ramp.x);
      r.translate(ramp.x, ramp.y); r.rotate(angle);
      const len = Math.hypot(ramp.endX - ramp.x, ramp.endY - ramp.y);
      r.fillStyle = '#25343d44'; r.fillRect(-1, 3, len + 2, 4);
      r.fillStyle = linear(r, 0, -2, 0, 5, [[0, '#fbffffc0'], [0.2, '#ffffff35'], [0.6, '#6e949777'], [0.8, '#efffffbb'], [1, '#2b454477']]);
      r.beginPath(); r.roundRect(0, -1, len, 5, 2); r.fill();
      r.strokeStyle = '#f2ffffa0'; r.lineWidth = 0.65;
      r.beginPath(); r.moveTo(0, -0.6); r.lineTo(len, -0.6); r.stroke(); r.restore();
    }
    // Reservoir seams and narrow feed tubes.
    for (const y of [55, 142, 154, 549, 574]) {
      r.strokeStyle = y === 154 ? '#e8fcffb0' : '#f1ffff77'; r.lineWidth = 1.3;
      r.beginPath(); r.moveTo(86, y); r.quadraticCurveTo(200, y + 5, 314, y); r.stroke();
      r.strokeStyle = '#203b4240'; r.beginPath(); r.moveTo(86, y + 3); r.lineTo(314, y + 3); r.stroke();
    }
    for (const x of [100, 300]) {
      r.strokeStyle = '#eaffff88'; r.lineWidth = 1.1;
      r.strokeRect(x - 3.5, 151, 7, 17);
    }
    // Sparse fixed microscopic bubbles, never random each frame.
    for (let i = 0; i < 24; i++) {
      const x = 93 + c.rand() * 215, y = 180 + c.rand() * 345, size = 0.4 + c.rand() * 1.1;
      r.strokeStyle = '#eaffff70'; r.lineWidth = 0.5;
      r.beginPath(); r.arc(x, y, size, 0, TAU); r.stroke();
    }
    r.restore();
    // Front surface is a separate cached layer: edges/reflections occlude the moving liquid.
    f.strokeStyle = '#192d3b70'; f.lineWidth = 8; f.stroke(body);
    f.strokeStyle = linear(f, 65, 50, 331, 585, [[0, '#fafffff0'], [0.2, '#a8e8ff65'], [0.46, '#ffffff99'], [0.68, '#374b4b80'], [0.9, '#ffffffdd'], [1, '#b1e8ffcc']]);
    f.lineWidth = 5; f.stroke(body);
    f.strokeStyle = '#ffffffd0'; f.lineWidth = 0.9; f.stroke(body);
    f.save(); f.translate(200, 315); f.scale(0.947, 0.974); f.translate(-200, -315);
    f.strokeStyle = '#efffff7a'; f.lineWidth = 2; f.stroke(body); f.restore();
    f.strokeStyle = '#ffffffbe'; f.lineWidth = 2.4; f.lineCap = 'round';
    for (const path of ['M82 87 Q70 118 83 166', 'M316 78 Q333 104 321 144', 'M83 516 Q67 553 91 575', 'M104 41 Q199 35 293 42', 'M109 581 Q200 591 297 580']) f.stroke(new Path2D(path));
    f.strokeStyle = '#ffffff60'; f.lineWidth = 7;
    f.stroke(new Path2D('M89 66 Q79 93 82 117')); f.stroke(new Path2D('M314 510 Q329 551 310 566'));

    // Bake the actual scenery behind the drops, including shelves: refraction is local to each moving lens.
    const optical = canvas(MW * density, MH * density);
    const o = optical.getContext('2d')!;
    o.drawImage(backdrop, originX * bgRatio, originY * bgRatio, MW * scale * bgRatio, MH * scale * bgRatio, 0, 0, optical.width, optical.height);
    o.drawImage(rear, 0, 0);
    const materials = [dropMaterial(c.palette[1]), dropMaterial(c.palette[2])];
    const fluidMaterials = [c.palette[1], c.palette[2]].map(color => {
      const image = canvas(384, 96), fluid = image.getContext('2d')!;
      fluid.fillStyle = linear(fluid, 0, 0, 0, 96, [[0, `${color}50`], [0.08, '#efffff90'], [0.15, `${color}a0`], [0.5, `${color}e8`], [0.9, `${color}ff`], [1, '#eaffffbb']]);
      fluid.fillRect(0, 0, 384, 96);
      fluid.fillStyle = linear(fluid, 0, 0, 384, 0, [[0, '#112b4555'], [0.04, '#ffffff50'], [0.09, '#ffffff00'], [0.9, '#ffffff00'], [0.96, '#f0ffff55'], [1, '#17324366']]);
      fluid.fillRect(0, 0, 384, 96);
      return image;
    });
    let visualTime = 0;
    let cursor: { x: number; y: number; pressed: boolean } | null = null;
    function liquid(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lane: number) {
      if (h <= 0.03) return;
      const wave = Math.sin(visualTime * 1.7 + lane) * 0.45;
      g.beginPath(); g.moveTo(x, y + 2);
      g.bezierCurveTo(x + w * 0.25, y - 1 + wave, x + w * 0.7, y + wave, x + w, y + 2);
      g.lineTo(x + w, y + h); g.quadraticCurveTo(x + w / 2, y + h + 2, x, y + h); g.closePath();
      g.save(); g.clip(); g.drawImage(fluidMaterials[lane], x, y - 1, w, h + 3); g.restore();
      g.strokeStyle = '#f0ffff8a'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(x + 2, y + 2); g.quadraticCurveTo(x + w / 2, y - 1 + wave, x + w - 2, y + 2); g.stroke();
      g.strokeStyle = `${c.palette[lane + 1]}99`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + 2, y + h - 1); g.quadraticCurveTo(x + w / 2, y + h + 1, x + w - 2, y + h - 1); g.stroke();
      g.fillStyle = '#ffffff30'; g.fillRect(x + 5, y + 3, 2, Math.max(0, h - 5));
    }
    function droplet(g: CanvasRenderingContext2D, x: number, y: number, radius: number, lane: number, stretch: number, angle: number, contact = false, wobble = 0) {
      const rx = radius / Math.sqrt(stretch), ry = radius * stretch;
      g.save(); g.translate(x, y); g.rotate(angle);
      const shape = new Path2D();
      if (contact) {
        // Sessile cap: a flattened wet foot and a rounded crown, aligned with its shelf.
        shape.moveTo(-rx * 1.08, ry * .86);
        shape.bezierCurveTo(-rx * 1.12, ry * .1, -rx * .7, -ry * 1.22, rx * .08, -ry * 1.08);
        shape.bezierCurveTo(rx * .82, -ry * .94, rx * 1.13, ry * .23, rx * 1.1, ry * .86);
        shape.quadraticCurveTo(0, ry, -rx * 1.08, ry * .86);
      } else {
        const lean = Math.sin(visualTime * 11 + x * .17) * wobble * .12;
        shape.moveTo(0, -ry);
        shape.bezierCurveTo(rx * (.62 + lean), -ry, rx * 1.15, ry * .25, rx * .64, ry * .8);
        shape.bezierCurveTo(rx * .25, ry * 1.08, -rx * .62, ry * 1.04, -rx * .86, ry * .35);
        shape.bezierCurveTo(-rx * 1.08, -ry * .25, -rx * .57, -ry, 0, -ry);
      }
      shape.closePath(); g.save(); g.clip(shape);
      // Curved scanline lens, not one uniformly flipped square. Only the tiny drop area is sampled.
      const ca = Math.cos(angle), sa = Math.sin(angle);
      for (let row = 0; row < 16; row++) {
        const v = (row + .5) / 8 - 1;
        const bend = Math.sqrt(Math.max(0, 1 - v * v));
        const sampleW = rx * (1.2 + bend * 1.1);
        const sampleY = -v * ry * (.8 + bend * .8);
        const sx = Math.max(0, Math.min(optical.width - sampleW * density, (x - sa * sampleY - sampleW / 2) * density));
        const sy = Math.max(0, Math.min(optical.height - 2 * density, (y + ca * sampleY) * density));
        g.drawImage(optical, sx, sy, sampleW * density, 2 * density, -rx * 1.15, -ry * 1.25 + row * ry * 2.5 / 16, rx * 2.3, ry * 2.5 / 16 + .1);
      }
      g.drawImage(materials[lane], -rx * 96 / 88, -ry * 96 / 88, rx * 192 / 88, ry * 192 / 88);
      g.fillStyle = linear(g, 0, -ry, 0, ry, [[0, `${c.palette[lane + 1]}15`], [.6, `${c.palette[lane + 1]}35`], [1, `${c.palette[lane + 1]}a0`]]);
      g.fillRect(-rx * 1.2, -ry * 1.3, rx * 2.4, ry * 2.6);
      g.restore();
      g.strokeStyle = `${c.palette[lane + 1]}8a`; g.lineWidth = .45; g.stroke(shape);
      // A narrow curved highlight belongs to the surface, not a white outline around the whole bead.
      g.strokeStyle = '#ffffffce'; g.lineWidth = .75; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-rx * .63, -ry * .32); g.quadraticCurveTo(-rx * .3, -ry * .88, rx * .26, -ry * .72); g.stroke();
      if (contact) {
        g.strokeStyle = `${c.palette[lane + 1]}a0`; g.lineWidth = .85;
        g.beginPath(); g.moveTo(-rx * 1.09, ry * .9); g.quadraticCurveTo(0, ry, rx * 1.09, ry * .9); g.stroke();
      }
      g.restore();
    }
    return {
      update(dt, _t, pointer) {
        if (pointer.active) {
          const x = (pointer.rawX - originX) / scale, y = (pointer.rawY - originY) / scale;
          // Reset is explicit and separate from manipulating the liquid.
          if (pointer.clicked && y > 621 && y < 640 && x > 70 && x < 330) sim.reset();
          else sim.stir(cursor?.x ?? x, cursor?.y ?? y, x, y, pointer.pressed, dt, c.params.react);
          cursor = { x, y, pressed: pointer.pressed };
        } else cursor = null;
        sim.update(dt); visualTime = sim.time;
      },
      draw(g) {
        g.drawImage(backdrop, 0, 0, c.width, c.height);
        g.save(); g.translate(originX, originY); g.scale(scale, scale);
        g.drawImage(rear, 0, 0, MW, MH);
        g.save(); g.clip(body);
        // Two fluids are optically layered in the upper chamber, independently accounted below.
        for (let lane = 1; lane >= 0; lane--) {
          const h = 28 * sim.remaining[lane] / TIMER_VOLUME;
          const below = lane ? 28 * sim.remaining[0] / TIMER_VOLUME : 0;
          liquid(g, 84, 142 - h - below, 232, h, lane);
          const depth = sim.collected[lane] * TIMER_POOL_SCALE;
          liquid(g, lane ? 200 : 88, 546 - depth, 112, depth + 0.2, lane);
          const forming = sim.nozzle[lane];
          if (forming > 0.015) {
            const radius = timerRadius(forming);
            g.strokeStyle = `${c.palette[lane + 1]}b0`; g.lineWidth = Math.max(0.6, 3 * (1 - forming * 0.65));
            g.beginPath(); g.moveTo(lane ? 300 : 100, 166); g.lineTo(lane ? 300 : 100, 167 + radius); g.stroke();
            droplet(g, lane ? 300 : 100, 166 + radius, radius, lane, 1 + forming * 0.24, 0);
          }
          for (const d of sim.drops) {
            if (d.lane !== lane) continue;
            const radius = timerRadius(d.volume);
            const inFlight = d.contact < 0;
            const stretch = inFlight ? 1 + Math.min(.2, Math.hypot(d.vx, d.vy) * .002) + Math.sin(visualTime * 12 + d.x) * d.wobble * .08 : .72 + Math.sin(visualTime * 14 + d.x) * d.wobble * .09;
            // A little tinted light pooling under the lens; fixed contact shadow drawn without blur.
            g.fillStyle = `${c.palette[lane + 1]}20`; ellipse(g, d.x + 1, d.y + radius * 0.8, radius * 1.15, 1.8);
            const ramp = d.contact >= 0 ? TIMER_RAMPS[d.contact] : null;
            const angle = ramp ? Math.atan((ramp.endY - ramp.y) / (ramp.endX - ramp.x)) : -Math.atan2(d.vx, Math.abs(d.vy) + 30);
            droplet(g, d.x, d.y, radius, lane, stretch, angle, !inFlight, d.wobble);
          }
        }
        g.restore(); g.drawImage(front, 0, 0, MW, MH);
        g.textAlign = 'center'; g.fillStyle = '#28353dbb'; g.font = '10px system-ui';
        g.fillText('ПРОВЕДИТЕ ПО КАПЛЯМ · ЗАЖМИТЕ, ЧТОБЫ ПОТЯНУТЬ', 200, 613);
        g.fillText('↻ НАЧАТЬ ЗАНОВО', 200, 634);
        if (cursor && cursor.x > 75 && cursor.x < 325 && cursor.y > 170 && cursor.y < 545) {
          g.strokeStyle = cursor.pressed ? '#e9ffffaa' : '#e9ffff55'; g.lineWidth = .8;
          g.beginPath(); g.arc(cursor.x, cursor.y, cursor.pressed ? 25 : 18, 0, TAU); g.stroke();
        }
        g.restore();
      },
      dispose() {
        // Release backing stores promptly when a gallery poster replaces the live scene.
        for (const image of [backdrop, rear, front, optical, ...materials, ...fluidMaterials]) { image.width = 1; image.height = 1; }
      },
    };
  },
};
