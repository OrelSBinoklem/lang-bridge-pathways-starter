import { T, TAU, v, type World } from './world';
import { building, cloud, gear, orbit, plinth } from './props';

export function memoryMobile(w: World) {
  const gold = w.metal('#c99559'); const ivory = w.metal('#ead9ba', 0.2, 0.45);
  for (let side = 0; side < 2; side++) {
    const mobile = w.side(side, 0.4);
    const canopy = w.ring(mobile, 3.2, 0.08, gold, v(0, 3.7, 0)); canopy.rotation.x = Math.PI / 2;
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU + side; const length = 1.2 + (i % 3) * 1.05;
      const pendant = new T.Group(); mobile.add(pendant); pendant.position.set(Math.cos(a) * 2.8, 3.7, Math.sin(a) * 1.4);
      w.beam(pendant, v(), v(0, -length, 0), 0.014, gold);
      const frame = new T.Group(); frame.position.y = -length - 0.9; pendant.add(frame);
      w.box(frame, [1.62, 1.96, 0.13], [0, 0, -0.09], ivory);
      w.box(frame, [1.42, 1.48, 0.045], [0, 0.14, 0], w.metal(['#244c61', '#514166', '#386a58'][i % 3], 0.15, 0.55));
      for (const x of [-0.82, 0.82]) w.box(frame, [0.055, 2, 0.2], [x, 0, 0], gold);
      for (const y of [-1, 1]) w.box(frame, [1.7, 0.055, 0.2], [0, y, 0], gold);
      // Little relief portraits, not placeholder images: each pendant contains a different family scene.
      const members = 1 + i % 3;
      for (let n = 0; n < members; n++) {
        const x = (n - (members - 1) / 2) * 0.42; const small = n === 2;
        w.sphere(frame, small ? 0.14 : 0.18, [x, small ? 0.14 : 0.33, 0.13], w.metal('#edbc8c', 0.12, 0.55));
        const body = w.mesh(new T.CapsuleGeometry(small ? 0.13 : 0.18, small ? 0.2 : 0.32, 4, 12), w.metal(['#ea986d', '#83bbce', '#deb775'][(n + i) % 3], 0.1, 0.6), frame, v(x, small ? -0.12 : -0.1, 0.11));
        body.scale.z = 0.5;
      }
      w.sphere(frame, 0.1, [0.46, 0.65, 0.09], w.glow('#ffe4aa', 1.7));
      w.text(frame, ['MĀJAS', 'DRAUGI', 'KOPĀ'][i % 3], '#755231', 1.1, 0.21).position.set(0, -0.77, 0.09);
      w.ticks.push(time => { pendant.rotation.z = Math.sin(time * 0.5 + a) * 0.1; frame.rotation.y = Math.sin(time * 0.26 + i) * 0.25; });
    }
    w.ticks.push(time => { mobile.rotation.y = Math.sin(time * 0.12 + side) * 0.28; });
    plinth(w, mobile, 3.2, '#ffd09a');
  }
  w.dust(180, '#ffce94', 14, 0.05);
}

export function prismPersonas(w: World) {
  const colors = ['#bc83fa', '#54d5ce', '#f693ad', '#8faefa'];
  for (let side = 0; side < 2; side++) {
    const gallery = w.side(side); plinth(w, gallery, 2.9, colors[side]);
    const bust = new T.Group(); gallery.add(bust);
    const skin = new T.MeshPhysicalMaterial({ color: colors[side], metalness: 0.65, roughness: 0.19, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.5, iridescenceThicknessRange: [100, 450], flatShading: true });
    const face = w.mesh(new T.IcosahedronGeometry(1.75, 2), skin, bust, v(0, 0.5, 0)); face.scale.set(0.82, 1.25, 0.69);
    w.mesh(new T.CylinderGeometry(0.6, 0.95, 1.35, 7), skin, bust, v(0, -1.85, 0));
    const shoulders = w.mesh(new T.IcosahedronGeometry(1.75, 1), skin, bust, v(0, -2.85, -0.15)); shoulders.scale.set(1.3, 0.45, 0.65);
    const dark = w.metal('#17253d', 0.4, 0.23);
    for (const x of [-0.57, 0.57]) {
      const eye = w.sphere(bust, 0.24, [x, 0.75, 1.05], dark); eye.scale.set(1.4, 0.3, 0.35);
      w.box(bust, [0.58, 0.055, 0.055], [x, 1.08, 1.08], w.glow('#d8c5ff', 1.5)).rotation.z = x < 0 ? -0.08 : 0.08;
    }
    const nose = w.mesh(new T.ConeGeometry(0.22, 0.7, 4), skin, bust, v(0, 0.22, 1.25)); nose.rotation.x = -0.4;
    w.tube(bust, [v(-0.48, -0.4, 1.02), v(0, -0.5, 1.2), v(0.48, -0.4, 1.02)], w.glow('#f5b0cd', 1.3), 0.027);
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU;
      const shard = w.mesh(new T.OctahedronGeometry(0.22 + (i % 3) * 0.08), w.metal(colors[i % 4], 0.65, 0.18), gallery);
      shard.scale.y = 2.4;
      w.ticks.push(time => { const angle = a + time * 0.09; shard.position.set(Math.cos(angle) * 3.2, Math.sin(angle) * 3.7, Math.sin(a + time * 0.18) * 0.8); shard.rotation.set(time * 0.3, a, angle); });
    }
    orbit(w, gallery, 3.45, '#b4acff', 0.7);
    w.ticks.push(time => { bust.rotation.y = Math.sin(time * 0.2 + side) * 0.4; bust.position.y = Math.sin(time * 0.5) * 0.12; });
  }
}

export function skyIslands(w: World) {
  const stone = w.metal('#455068', 0.1, 0.9); const grass = w.metal('#349c79', 0.1, 0.75);
  for (let side = 0; side < 2; side++) {
    const city = w.side(side, -0.5);
    for (let island = 0; island < 3; island++) {
      const land = new T.Group(); city.add(land);
      const r = island === 0 ? 2.65 : 1.2;
      land.position.set(island === 0 ? 0 : island === 1 ? -2.9 : 2.8, island === 0 ? 0 : island === 1 ? 2.7 : -2.2, -island);
      const rock = w.mesh(new T.ConeGeometry(r, r * 1.45, 7, 2), stone, land, v(0, -r * 0.72, 0)); rock.rotation.z = Math.PI;
      w.mesh(new T.CylinderGeometry(r, r * 0.95, 0.18, 32), grass, land);
      const count = island === 0 ? 5 : 2;
      for (let n = 0; n < count; n++) {
        const a = n / count * TAU;
        const house = building(w, land, island ? 0.5 : 0.85, 0.85 + w.c.rand() * 1.5, 0.7, ['#eddcc0', '#81b8ac', '#bca6cb'][n % 3], '#ffe0a5', n);
        house.position.set(Math.cos(a) * r * 0.55, 0.1, Math.sin(a) * r * 0.55); house.rotation.y = a + Math.PI / 2;
        const tree = new T.Group(); land.add(tree); tree.position.set(Math.cos(a + 0.6) * r * 0.76, 0.1, Math.sin(a + 0.6) * r * 0.76);
        w.beam(tree, v(), v(0, 0.7, 0), 0.055, w.metal('#735846', 0, 0.9));
        w.mesh(new T.IcosahedronGeometry(0.36, 1), w.metal(n % 2 ? '#ffb596' : '#63cda1', 0.1, 0.65), tree, v(0, 0.8, 0));
      }
      // Continuous luminous waterfall ribbons with moving beads, not disconnected static dots.
      for (let stream = 0; stream < (island ? 2 : 5); stream++) {
        const x = (stream - 2) * 0.1;
        const path = w.tube(land, [v(x, 0.1, r), v(x, -0.5, r + 0.14), v(x + 0.1, -2.1, r + 0.2), v(x + 0.2, -3.6, r + 0.4)], w.glow('#63e7e8', 1.6), 0.025);
        const bead = w.sphere(land, 0.045, [0, 0, 0], w.glow('#d5fffd', 3));
        w.ticks.push(time => { bead.position.copy(path.getPointAt((time * 0.4 + stream * 0.18) % 1)); });
      }
      const baseY = land.position.y;
      w.ticks.push(time => { land.position.y = baseY + Math.sin(time * 0.35 + island * 2 + side) * 0.22; land.rotation.y = Math.sin(time * 0.1 + island) * 0.12; });
    }
    for (let i = 0; i < 3; i++) { const mist = cloud(w, city, 1.1); mist.position.set((i - 1) * 3, -3.4 - i * 0.4, -2); }
  }
}

export function astralPlanner(w: World) {
  const brass = w.metal('#c59355'); const dark = w.metal('#18283d');
  for (let side = 0; side < 2; side++) {
    const clock = w.side(side, 0.6); clock.rotation.y = side ? -0.18 : 0.18;
    w.ring(clock, 3.05, 0.13, brass); w.ring(clock, 2.85, 0.025, w.glow('#ffdc9e', 1.6));
    for (let n = 0; n < 60; n++) {
      const a = n / 60 * TAU;
      const mark = w.box(clock, [n % 5 ? 0.025 : 0.055, n % 5 ? 0.1 : 0.23, 0.08], [Math.sin(a) * 2.64, Math.cos(a) * 2.64, 0.3], brass); mark.rotation.z = -a;
    }
    const wheels = [{ x: -1, y: 0.7, r: 1.3, teeth: 24 }, { x: 1.05, y: 0.3, r: 0.85, teeth: 16 }, { x: -0.1, y: -1.3, r: 0.9, teeth: 17 }];
    wheels.forEach((spec, i) => {
      const wheel = gear(w, clock, spec.r, spec.teeth, i === 1 ? '#bbc7ca' : '#ab7e44'); wheel.position.set(spec.x, spec.y, -0.25);
      w.ticks.push(time => { wheel.rotation.z = time * (i === 1 ? -0.21 : 0.14); });
    });
    const hands = [new T.Group(), new T.Group(), new T.Group()];
    hands.forEach((hand, i) => { clock.add(hand); hand.position.z = 0.55 + i * 0.08; w.box(hand, [i === 2 ? 0.027 : 0.08, [1.5, 2.15, 2.4][i], 0.06], [0, [0.7, 1, 1.05][i], 0], i === 2 ? w.glow('#ffab71', 2) : brass); });
    w.sphere(clock, 0.15, [0, 0, 0.8], brass);
    const pendulum = new T.Group(); pendulum.position.set(0, -2.2, -0.3); clock.add(pendulum);
    w.beam(pendulum, v(), v(0, -2.35, 0), 0.04, brass);
    w.mesh(new T.CylinderGeometry(0.5, 0.5, 0.18, 32), brass, pendulum, v(0, -2.35, 0)).rotation.x = Math.PI / 2;
    for (let day = 0; day < 7; day++) {
      const a = (day / 7) * TAU; const plate = new T.Group(); clock.add(plate);
      plate.position.set(Math.sin(a) * 3.8, Math.cos(a) * 3.8, -0.25);
      w.box(plate, [0.68, 0.55, 0.15], [0, 0, 0], dark);
      w.text(plate, ['P', 'O', 'T', 'C', 'P', 'S', 'Sv'][day], '#ffdcac', 0.52, 0.35).position.z = 0.09;
    }
    const now = new Date(); const second = now.getSeconds() + now.getMinutes() * 60 + now.getHours() * 3600;
    w.ticks.push(time => { hands[0].rotation.z = -(second + time) / 43200 * TAU; hands[1].rotation.z = -(second + time) / 3600 * TAU; hands[2].rotation.z = -(second + time) / 60 * TAU; pendulum.rotation.z = Math.sin(time * 2) * 0.22; });
  }
}
