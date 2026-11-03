import { T, TAU, v, type World } from './world';
import { building, gear, plinth } from './props';

export function knowledgeLaunch(w: World) {
  const white = w.metal('#d5e5ef', 0.55, 0.28); const steel = w.metal('#455973');
  for (let side = 0; side < 2; side++) {
    const pad = w.side(side); plinth(w, pad, 3.5, '#79cbff');
    if (side === 1) {
      const station = new T.Group(); pad.add(station);
      w.sphere(station, 1.15, [0, 0, 0], w.metal('#b4cad9', 0.85, 0.22));
      for (let ring = 0; ring < 3; ring++) { const band = w.ring(station, 1.5 + ring * 0.35, 0.04, w.glow('#7bc9ff', 1.8)); band.rotation.set(ring * 0.75, 0.4, ring * 0.65); }
      for (const sign of [-1, 1]) {
        w.beam(station, v(sign, 0, 0), v(sign * 3.4, 0, 0), 0.055, steel);
        const panel = w.box(station, [1.35, 3.3, 0.08], [sign * 2.65, 0, 0], w.metal('#23568b', 0.65, 0.23));
        for (let row = 0; row < 10; row++) w.box(panel, [1.3, 0.018, 0.018], [0, -1.5 + row * 0.33, 0.055], w.glow('#67b4e3', 1));
        w.box(panel, [0.018, 3.2, 0.02], [0, 0, 0.05], white);
      }
      // A graduation cap crowns the orbital academy; the six levels form its orbital beacons.
      w.mesh(new T.CylinderGeometry(0.55, 0.65, 0.45, 32), steel, station, v(0, 1.7, 0));
      w.box(station, [2, 0.13, 2], [0, 2, 0], steel).rotation.y = Math.PI / 4;
      w.tube(station, [v(0, 2.1, 0), v(1.2, 2.03, 0), v(1.35, 1.1, 0)], w.glow('#ffd18c', 1.6), 0.025);
      for (let level = 0; level < 6; level++) { const a = level / 6 * TAU; const label = w.text(pad, ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'][level], '#baddff', 0.7, 0.45); label.position.set(Math.cos(a) * 3.7, Math.sin(a) * 3.7, 0); }
      w.ticks.push(time => { station.rotation.set(Math.sin(time * 0.13) * 0.18, Math.sin(time * 0.17) * 0.35, Math.sin(time * 0.12) * 0.08); station.position.y = Math.sin(time * 0.4) * 0.25; });
      continue;
    }
    const tower = new T.Group(); pad.add(tower); tower.position.set(side ? 2.1 : -2.1, -4.3, -1);
    for (const x of [-0.45, 0.45]) for (const z of [-0.45, 0.45]) w.beam(tower, v(x, 0, z), v(x, 8, z), 0.055, steel);
    for (let n = 0; n < 8; n++) {
      w.box(tower, [1.1, 0.09, 1.1], [0, n, 0], steel);
      w.beam(tower, v(-0.45, n, 0.45), v(0.45, n + 1, 0.45), 0.03, steel);
    }
    const rocket = new T.Group(); pad.add(rocket);
    w.mesh(new T.CylinderGeometry(0.63, 0.63, 3.8, 32), white, rocket);
    w.mesh(new T.ConeGeometry(0.63, 1.55, 32), white, rocket, v(0, 2.66, 0));
    w.mesh(new T.CylinderGeometry(0.5, 0.72, 0.6, 20), steel, rocket, v(0, -2.18, 0));
    for (const y of [-1.35, 1.35]) { const band = w.ring(rocket, 0.637, 0.045, w.glow('#70befe', 1.5), v(0, y, 0)); band.rotation.x = Math.PI / 2; }
    const window = w.sphere(rocket, 0.24, [0, 0.7, 0.61], w.metal('#266488', 0.8, 0.12)); window.scale.z = 0.3;
    w.ring(rocket, 0.26, 0.035, steel, v(0, 0.7, 0.64));
    for (let fin = 0; fin < 4; fin++) {
      const wing = new T.Group(); wing.rotation.y = fin / 4 * TAU; rocket.add(wing);
      const shape = new T.Shape(); shape.moveTo(0.45, -0.8); shape.lineTo(1.25, -2.25); shape.lineTo(0.48, -2); shape.closePath();
      w.mesh(new T.ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: false }), steel, wing);
    }
    const exhaust = new T.Group(); rocket.add(exhaust); exhaust.position.y = -2.5;
    const flame = w.mesh(new T.ConeGeometry(0.49, 2.7, 24), w.glow('#ff9940', 4), exhaust, v(0, -1.3, 0)); flame.rotation.z = Math.PI;
    const core = w.mesh(new T.ConeGeometry(0.25, 1.8, 24), w.glow('#b1e8ff', 5), exhaust, v(0, -0.8, 0.25)); core.rotation.z = Math.PI;
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    levels.forEach((level, i) => {
      const text = w.text(pad, level, '#a3d9ff', 0.75, 0.45); text.position.set(side ? -2.25 : 2.25, -3 + i * 1.3, -1);
      w.box(pad, [0.28, 0.025, 0.05], [side ? -1.65 : 1.65, -3 + i * 1.3, -1], w.glow('#5cafff', 2));
    });
    w.ticks.push(time => {
      const phase = (time + side * 7) % 26; const flight = Math.max(0, phase - 6);
      rocket.position.y = -0.5 + flight * flight * 0.028;
      rocket.rotation.z = Math.sin(time * 3) * (phase < 6 ? 0.002 : 0.005);
      rocket.scale.setScalar(phase > 24 ? Math.max(0.001, (26 - phase) / 2) : Math.min(1, 0.35 + phase));
      exhaust.scale.set(1, (phase < 6 ? 0.2 : 0.75) + Math.sin(time * 30) * 0.09, 1);
    });
  }
  w.dust(200, '#9fcaff', 16, 0.045);
}

export function timeReborn(w: World) {
  const brass = w.metal('#ba8846'); const glow = w.glow('#ffbd69', 2.5);
  for (let side = 0; side < 2; side++) {
    const pedestal = w.side(side); plinth(w, pedestal, 3, '#ffc170');
    if (side === 1) {
      const spiral = new T.Group(); pedestal.add(spiral);
      for (let i = 0; i < 15; i++) {
        const a = i * 0.58; const r = 0.65 + i * 0.2;
        const piece = gear(w, spiral, 0.3 + i * 0.033, 12 + i, i % 3 === 0 ? '#bbc8d5' : '#b58647'); piece.position.set(Math.cos(a) * r, Math.sin(a) * r, -i * 0.04);
        w.ticks.push(time => { piece.rotation.z = -time * 0.18 * (i % 2 ? -1 : 1); });
      }
      const ribbon = Array.from({ length: 90 }, (_, i) => { const a = i / 89 * TAU * 2.4; const r = 0.2 + i / 89 * 3.7; return v(Math.cos(a) * r, Math.sin(a) * r, -0.75); });
      w.tube(spiral, ribbon, w.glow('#ffce82', 1.6), 0.025);
      w.ticks.push(time => { spiral.rotation.z = -time * 0.025; spiral.rotation.y = Math.sin(time * 0.11) * 0.15; });
      continue;
    }
    const hourglass = new T.Group(); pedestal.add(hourglass);
    const surface = w.glass('#93c3d8', 0.2);
    for (const sign of [-1, 1]) {
      w.mesh(new T.CylinderGeometry(2.15, 2.15, 0.22, 64), brass, hourglass, v(0, sign * 3.1, 0));
      const points = [new T.Vector2(0.13, 0), new T.Vector2(0.23, 0.6), new T.Vector2(0.8, 1.2), new T.Vector2(1.62, 2), new T.Vector2(1.8, 2.65), new T.Vector2(1.72, 3)];
      const bulb = w.mesh(new T.LatheGeometry(points, 48), surface, hourglass); if (sign < 0) bulb.rotation.z = Math.PI;
      const pile = w.mesh(new T.ConeGeometry(1.55, 1.5, 48), glow, hourglass, v(0, sign * 2.5, 0)); if (sign > 0) pile.rotation.z = Math.PI;
      w.ticks.push(time => { const amount = ((time * 0.035 + side * 0.4) % 1); const fill = sign > 0 ? 1 - amount : amount; pile.scale.setScalar(0.35 + fill * 0.6); });
    }
    for (let p = 0; p < 4; p++) {
      const a = p / 4 * TAU + Math.PI / 4;
      w.beam(hourglass, v(Math.cos(a) * 2, -3.1, Math.sin(a) * 2), v(Math.cos(a) * 2, 3.1, Math.sin(a) * 2), 0.065, brass);
    }
    const particles = new Float32Array(180 * 3);
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(particles, 3));
    const sand = new T.Points(geometry, new T.PointsMaterial({ color: '#ffe3a4', size: 0.045, blending: T.AdditiveBlending, transparent: true, depthWrite: false })); hourglass.add(sand);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU;
      const shard = gear(w, pedestal, 0.24 + (i % 3) * 0.13, 10, i % 2 ? '#b2874c' : '#b9cad6');
      w.ticks.push(time => { const angle = a + time * 0.12; shard.position.set(Math.cos(angle) * 3.65, Math.sin(angle) * 3.8, Math.sin(angle * 2) * 0.4); shard.rotation.z = -time * 0.3; });
    }
    w.ticks.push(time => {
      const cycle = (time * 0.035 + side * 0.4) % 1;
      const turn = T.MathUtils.smoothstep(cycle, 0.88, 0.99);
      hourglass.rotation.z = turn * Math.PI; hourglass.rotation.y = Math.sin(time * 0.1) * 0.2;
      for (let i = 0; i < 180; i++) { const u = (time * 0.65 + i / 180) % 1; const spread = 0.04 + u * u * 0.6; particles[i * 3] = Math.sin(i * 71) * spread; particles[i * 3 + 1] = -u * 2.7; particles[i * 3 + 2] = Math.cos(i * 53) * spread; }
      geometry.attributes.position.needsUpdate = true;
    });
  }
}

export function lightCircle(w: World) {
  const brass = w.metal('#926037'); const colors = ['#ffab58', '#ff819d', '#67dad0', '#f9ce75'];
  for (let side = 0; side < 2; side++) {
    const canopy = w.side(side, 0.1); canopy.rotation.x = 0.18;
    const upper = w.ring(canopy, 3.15, 0.07, brass, v(0, 3.1, 0)); upper.rotation.x = Math.PI / 2;
    const lower = w.ring(canopy, 3.4, 0.025, w.glow('#ee975a', 1.4), v(0, -3.2, 0)); lower.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU; const lantern = new T.Group(); canopy.add(lantern);
      const y = Math.sin(a * 3) * 1.3;
      lantern.position.set(Math.cos(a) * 3, y, Math.sin(a) * 2.4);
      w.beam(canopy, v(lantern.position.x, 3.1, lantern.position.z), lantern.position.clone().add(v(0, 0.8, 0)), 0.009, brass);
      const shell = w.sphere(lantern, 0.62, [0, 0, 0], w.glass(colors[i % 4], 0.65)); shell.scale.y = 1.3;
      w.sphere(lantern, 0.22, [0, 0, 0], w.glow(colors[i % 4], 3.5));
      for (const y of [-0.72, 0.72]) w.mesh(new T.CylinderGeometry(0.22, 0.25, 0.12, 16), brass, lantern, v(0, y, 0));
      for (let rib = 0; rib < 6; rib++) {
        const angle = rib / 6 * TAU;
        w.tube(lantern, [v(Math.cos(angle) * 0.18, -0.72, Math.sin(angle) * 0.18), v(Math.cos(angle) * 0.62, 0, Math.sin(angle) * 0.62), v(Math.cos(angle) * 0.18, 0.72, Math.sin(angle) * 0.18)], brass, 0.012);
      }
      const tassel = w.beam(lantern, v(0, -0.78, 0), v(0, -1.28, 0), 0.025, w.metal(colors[i % 4], 0, 0.8));
      w.ticks.push(time => { lantern.rotation.z = Math.sin(time * 0.7 + a) * 0.1; shell.scale.set(1 + Math.sin(time * 1.1 - a) * 0.035, 1.3, 1); tassel.rotation.z = Math.sin(time + a) * 0.05; });
    }
    for (let band = 0; band < 3; band++) {
      const points = Array.from({ length: 65 }, (_, n) => { const a = n / 64 * TAU; return v(Math.cos(a) * 3.25, Math.sin(a * 3 + band * 2) * 1.2, Math.sin(a) * 2.55); });
      w.tube(canopy, points, w.glow(colors[band], 1.4), 0.015, true);
    }
    w.ticks.push(time => { canopy.rotation.y = time * 0.045 * (side ? -1 : 1); });
  }
  w.dust(230, '#ffd494', 15, 0.045);
}

export function rainMetropolis(w: World) {
  for (let side = 0; side < 2; side++) {
    const district = w.side(side, -4.5); district.rotation.y = side ? -0.18 : 0.18;
    w.box(district, [8.5, 0.3, 7], [0, -0.1, -1], w.metal('#111d30', 0.7, 0.12));
    for (let n = 0; n < 12; n++) {
      const height = 1.7 + w.c.rand() * 5.7;
      const block = building(w, district, 0.8 + w.c.rand() * 0.6, height, 0.9, ['#1e3651', '#363955', '#204250'][n % 3], ['#63cce9', '#ffa7ce', '#ffd295'][n % 3], n + side * 13);
      block.position.set((n % 4 - 1.5) * 1.85, 0, -Math.floor(n / 4) * 1.7);
      if (n % 3 === 0) { w.beam(block, v(0, height, 0), v(0, height + 0.8, 0), 0.018, w.metal('#879db3')); w.sphere(block, 0.05, [0, height + 0.82, 0], w.glow('#ff779d', 4)); }
      if (n % 2) w.box(block, [0.025, height * 0.8, 0.03], [-0.43, height * 0.5, 0.49], w.glow('#52bded', 2));
    }
    const road = w.tube(district, [v(-4, 1.6, 1.2), v(-2, 1.8, 2.6), v(2, 1.8, 2.6), v(4, 1.6, 1.2), v(2, 1.3, -0.1), v(-2, 1.3, -0.1)], w.metal('#617387'), 0.12, true);
    for (let i = 0; i < 9; i++) {
      const car = new T.Group(); district.add(car);
      w.box(car, [0.4, 0.17, 0.22], [0, 0.13, 0], w.metal(i % 2 ? '#ecba8d' : '#4f92b2'));
      for (const z of [-0.07, 0.07]) w.sphere(car, 0.035, [0.2, 0.12, z], w.glow('#d9f7ff', 3));
      w.ticks.push(time => { const u = (time * 0.035 + i / 9) % 1; car.position.copy(road.getPointAt(u)); car.quaternion.setFromUnitVectors(v(1, 0, 0), road.getTangentAt(u)); });
    }
  }
  const count = w.mobile ? 250 : 650; const positions = new Float32Array(count * 6); const origins: number[] = [];
  for (let i = 0; i < count; i++) origins.push((w.c.rand() - 0.5) * 32, w.c.rand() * 18, (w.c.rand() - 0.5) * 14);
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(positions, 3));
  w.root.add(new T.LineSegments(geo, new T.LineBasicMaterial({ color: '#94c9e0', transparent: true, opacity: 0.28, depthWrite: false })));
  w.ticks.push(time => { for (let i = 0; i < count; i++) { const y = 11 - (origins[i * 3 + 1] + time * 8) % 18; positions.set([origins[i * 3], y, origins[i * 3 + 2], origins[i * 3] - 0.08, y - 0.4, origins[i * 3 + 2]], i * 6); } geo.attributes.position.needsUpdate = true; });
}

export function stellarFoundry(w: World) {
  const steel = w.metal('#597080', 0.85, 0.3); const brass = w.metal('#af7c40');
  for (let side = 0; side < 2; side++) {
    const forge = w.side(side); plinth(w, forge, 3.5, '#ffad56');
    w.box(forge, [2.6, 0.8, 1.4], [0, -2, 0], steel);
    w.box(forge, [1.1, 1.6, 1.15], [0, -3.1, 0], steel);
    w.box(forge, [2.8, 0.3, 1.7], [0, -4, 0], steel);
    const horn = w.mesh(new T.ConeGeometry(0.55, 1.8, 16), steel, forge, v(2, -2, 0)); horn.rotation.z = -Math.PI / 2;
    const ingot = w.box(forge, [2, 0.15, 0.55], [0, -1.51, 0.1], w.glow('#ff9a42', 3.5));
    const handle = new T.Group(); forge.add(handle); handle.position.set(-2.5, 1.7, 0);
    w.beam(handle, v(), v(3.6, 0, 0), 0.13, brass);
    w.box(handle, [0.9, 0.9, 1.1], [3.6, 0, 0], steel);
    for (const x of [-0.46, 0.46]) w.box(handle, [0.06, 0.95, 1.15], [3.6 + x, 0, 0], brass);
    const furnace = new T.Group(); forge.add(furnace); furnace.position.set(0, 1.4, -2.4);
    for (let n = 0; n < 3; n++) {
      const wheel = gear(w, furnace, 2.9 - n * 0.43, 32 - n * 4, n % 2 ? '#8c6849' : '#506574'); wheel.position.z = -n * 0.3;
      w.ticks.push(time => { wheel.rotation.z = time * (n % 2 ? -0.09 : 0.06); });
    }
    w.ring(furnace, 1.4, 0.12, w.glow('#ff8734', 3));
    const light = new T.PointLight('#ff9a45', 15, 10, 2); light.position.set(0, -0.6, 1); forge.add(light);
    const particles = new Float32Array(120 * 3); const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(particles, 3));
    const sparks = new T.Points(geo, new T.PointsMaterial({ color: '#ffcc74', size: 0.07, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); forge.add(sparks);
    w.ticks.push(time => {
      const cycle = (time + side * 1.3) % 3.6;
      const strike = cycle < 1.5 ? cycle / 1.5 : cycle < 1.8 ? 1 - ((cycle - 1.5) / 0.3) ** 2 : 0;
      handle.rotation.z = -0.84 + strike * 1.65;
      const age = Math.max(0, cycle - 1.8);
      sparks.visible = cycle >= 1.8 && age < 1.4;
      for (let i = 0; i < 120; i++) { const a = i * 2.399; const speed = 1.2 + (i % 13) * 0.3; particles[i * 3] = Math.cos(a) * age * speed; particles[i * 3 + 1] = -1.38 + age * (2 + (i % 9) * 0.25) - age * age * 4; particles[i * 3 + 2] = Math.sin(a) * age * speed * 0.6; }
      geo.attributes.position.needsUpdate = true;
      const hot = Math.exp(-age * 3) * (cycle >= 1.8 ? 1 : 0.12);
      light.intensity = 8 + hot * 22 + w.pulse * 8;
      (ingot.material as T.MeshStandardMaterial).emissiveIntensity = 2 + hot * 3;
    });
  }
  w.dust(180, '#ffa047', 15, 0.04);
}
