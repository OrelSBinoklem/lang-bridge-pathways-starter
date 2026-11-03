import { T, TAU, v, type World } from './world';
import { aircraft, building, cloud, orbit, plinth } from './props';

export function helloOrbit(w: World) {
  const brass = w.metal('#cd9563');
  const words = ['Sveiki!', 'Привет!', 'Hello!', 'Ciao!', 'Bonjour!', '¡Hola!'];
  for (let side = 0; side < 2; side++) {
    const installation = w.side(side); plinth(w, installation, 2.8, '#ffc27e');
    const heart = w.mesh(new T.IcosahedronGeometry(1.25, 2), w.glass(side ? '#fdc2fa' : '#66e7f0', 0.48), installation);
    w.sphere(installation, 0.55, [0, 0, 0], w.glow('#ffd89d', 4));
    for (let band = 0; band < 3; band++) {
      const ring = w.ring(installation, 2.1 + band * 0.3, 0.045, brass);
      ring.rotation.set(band * 0.8, band * 0.7, 0);
      w.ticks.push(time => { ring.rotation.z = time * (0.1 + band * 0.035) * (side ? -1 : 1); });
    }
    const satellites = new T.Group(); installation.add(satellites);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU; const card = new T.Group(); satellites.add(card);
      card.position.set(Math.cos(a) * 3.35, Math.sin(a) * 3.35, 0.3);
      w.box(card, [1.95, 0.58, 0.07], [0, 0, 0], w.metal('#203346', 0.55, 0.22));
      w.text(card, words[(i + side * 2) % words.length], i % 2 ? '#ffc987' : '#aaf5ff', 1.8, 0.38).position.z = 0.055;
      w.ticks.push(time => { card.rotation.z = -time * 0.06; });
    }
    w.ticks.push(time => {
      satellites.rotation.z = time * 0.06;
      heart.rotation.set(time * 0.13, time * 0.22, 0.1);
      heart.scale.setScalar(1 + w.pulse * 0.14 + Math.sin(time * 1.4) * 0.04);
    });
    orbit(w, installation, 3.6, side ? '#ff80bd' : '#74e6ff', 0.7);
  }
  w.dust(180, '#ffbc69', 13, 0.045);
}

export function transitGlobe(w: World) {
  const blue = w.glass('#287b96', 0.55); const mint = w.glow('#64ddd9', 1.6);
  for (let side = 0; side < 2; side++) {
    const stand = w.side(side); plinth(w, stand, 3, '#59dfe8');
    const planet = new T.Group(); stand.add(planet);
    w.sphere(planet, 2.55, [0, 0, 0], blue);
    for (let latitude = -2; latitude <= 2; latitude++) {
      const y = latitude * 0.78; const r = Math.sqrt(2.57 ** 2 - y * y);
      const ring = w.ring(planet, r, 0.012, mint, v(0, y, 0)); ring.rotation.x = Math.PI / 2;
    }
    for (let meridian = 0; meridian < 8; meridian++) w.ring(planet, 2.57, 0.012, mint).rotation.y = meridian / 8 * Math.PI;
    for (let route = 0; route < 4; route++) {
      const track = new T.Group(); track.rotation.set(0.4 + route * 0.65, route * 1.2, side * 0.5); stand.add(track);
      const radius = 2.9 + route * 0.23;
      w.ring(track, radius, 0.025, w.glow(route % 2 ? '#ffa761' : '#6df4ff', 2));
      const plane = aircraft(w, track, route % 2 ? '#ffd8a0' : '#d6faff'); plane.scale.setScalar(0.58);
      w.ticks.push(time => {
        const a = time * (0.14 + route * 0.055) + route * 2;
        plane.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
        plane.rotation.z = a + Math.PI / 2;
      });
    }
    const rail = w.ring(stand, 3.65, 0.07, w.metal('#92c0d3'), v(0, -3.15, 0)); rail.rotation.x = Math.PI / 2;
    const trolley = new T.Group(); stand.add(trolley);
    w.box(trolley, [1.45, 0.55, 0.55], [0, 0, 0], w.metal(side ? '#ffc766' : '#65d6cd'));
    w.box(trolley, [1.18, 0.22, 0.57], [0, 0.12, 0], w.metal('#0c2639'));
    for (const x of [-0.45, 0.45]) for (const z of [-0.29, 0.29]) {
      const wheel = w.mesh(new T.CylinderGeometry(0.13, 0.13, 0.06, 12), w.metal('#111822'), trolley, v(x, -0.28, z)); wheel.rotation.x = Math.PI / 2;
    }
    w.ticks.push(time => { planet.rotation.y = time * 0.075; const a = time * 0.25; trolley.position.set(Math.cos(a) * 3.65, -2.82, Math.sin(a) * 3.65); trolley.rotation.y = -a - Math.PI / 2; });
  }
}

export function midnightArcade(w: World) {
  const neon = ['#ff66b7', '#54e9e5', '#ffb861'];
  for (let side = 0; side < 2; side++) {
    const street = w.side(side, -2.4); street.rotation.y = side ? -0.25 : 0.25;
    for (let i = 0; i < 3; i++) {
      const shop = building(w, street, 2.5, 3 + i * 0.75, 1.7, '#26314a', neon[i], i + side);
      shop.position.set((i - 1) * 2.65, 0, -i * 0.65);
      w.box(shop, [2.3, 0.72, 0.1], [0, 1.4, 0.92], w.metal('#142034'));
      w.text(shop, ['VEIKALS', 'ATELIER', 'MARKET'][i], neon[i], 2.1, 0.4).position.set(0, 1.45, 1.01);
      w.box(shop, [2.45, 0.15, 0.65], [0, 1.02, 1.05], w.metal(neon[i], 0.2));
      const rim = w.ring(shop, 0.52, 0.025, w.glow(neon[i]), v(0, 2.5 + i * 0.75, 0.88));
      w.ticks.push(time => { rim.rotation.z = time * 0.2; });
    }
    const conveyor = new T.Group(); street.add(conveyor); conveyor.position.y = -0.6;
    w.box(conveyor, [8.4, 0.17, 2], [0, 0, 1.4], w.metal('#0e1428'));
    for (let n = 0; n < 6; n++) {
      const bag = new T.Group(); conveyor.add(bag);
      w.box(bag, [0.62, 0.72, 0.38], [0, 0.46, 0], w.metal(neon[n % 3], 0.25, 0.25));
      const handle = w.ring(bag, 0.18, 0.025, w.metal('#f7e6bd'), v(0, 0.87, 0)); handle.scale.y = 1.25;
      w.ticks.push(time => { bag.position.set(((time * 0.55 + n * 1.5) % 8.7) - 4.3, Math.sin(time * 2 + n) * 0.025, 1.5); bag.rotation.y = Math.sin(time + n) * 0.2; });
    }
    w.tube(street, [v(-4.3, 5.1, 0), v(0, 6.3, -1), v(4.3, 5.1, -1.8)], w.glow('#ab91ff', 2), 0.06);
  }
}

export function cloudCarnival(w: World) {
  const gold = w.metal('#d4b485'); const neon = w.glow('#ff91b3', 2.5);
  for (let side = 0; side < 2; side++) {
    const park = w.side(side, -0.2);
    if (side === 1) {
      // The other side is a suspended carousel, not a mirrored copy of the wheel.
      const carousel = new T.Group(); park.add(carousel);
      w.mesh(new T.CylinderGeometry(3, 3.15, 0.24, 64), gold, carousel, v(0, -3.3, 0));
      w.mesh(new T.ConeGeometry(3.3, 1.7, 24), w.metal('#bf6687', 0.35, 0.25), carousel, v(0, 2.6, 0));
      w.beam(carousel, v(0, -3.2, 0), v(0, 3.6, 0), 0.18, gold);
      for (const y of [-3.1, 1.75]) { const rim = w.ring(carousel, 3, 0.04, neon, v(0, y, 0)); rim.rotation.x = Math.PI / 2; }
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * TAU; const mount = new T.Group(); carousel.add(mount); mount.position.set(Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4); mount.rotation.y = -a;
        w.beam(mount, v(0, -3.1, 0), v(0, 1.8, 0), 0.025, gold);
        const plane = aircraft(w, mount, i % 2 ? '#ffbd76' : '#8bddf1'); plane.scale.setScalar(0.9);
        w.ticks.push(time => { plane.position.y = -0.8 + Math.sin(time * 0.7 + a) * 0.8; });
        w.sphere(carousel, 0.065, [Math.cos(a) * 3.1, 1.77, Math.sin(a) * 3.1], w.glow('#ffe6a6', 2.5));
      }
      w.sphere(carousel, 0.18, [0, 3.6, 0], w.glow('#ffcf7d', 2.5));
      const mist = cloud(w, park, 1.55); mist.position.y = -3.8;
      w.ticks.push(time => { carousel.rotation.y = time * 0.13; });
      continue;
    }
    const wheel = new T.Group(); park.add(wheel);
    wheel.position.y = 0.5; wheel.rotation.y = side ? -0.2 : 0.2;
    for (const z of [-0.3, 0.3]) w.ring(wheel, 3, 0.08, gold, v(0, 0, z));
    w.ring(wheel, 2.75, 0.03, neon, v(0, 0, 0.38));
    const cars: T.Group[] = [];
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      w.beam(wheel, v(), v(Math.cos(a) * 3, Math.sin(a) * 3, 0), 0.035, gold);
      const car = new T.Group(); wheel.add(car); cars.push(car);
      car.position.set(Math.cos(a) * 3, Math.sin(a) * 3, 0);
      w.box(car, [0.5, 0.5, 0.5], [0, -0.35, 0], w.glass(i % 2 ? '#ffb666' : '#7bdfff', 0.7));
      w.mesh(new T.ConeGeometry(0.44, 0.25, 4), w.metal('#dbb776'), car, v(0, 0.02, 0)).rotation.y = Math.PI / 4;
      w.sphere(car, 0.065, [0, 0.19, 0], w.glow('#fff1b8', 3));
    }
    w.beam(park, v(-1.8, -4.5, 0.2), v(0, 0.5, 0), 0.13, gold);
    w.beam(park, v(1.8, -4.5, 0.2), v(0, 0.5, 0), 0.13, gold);
    const cloudBed = cloud(w, park, 1.45); cloudBed.position.y = -4.2;
    const track = w.tube(park, [v(-4, -2, -1), v(-3, 2, -3), v(0, 4.7, -3), v(4, 1, -2), v(3, -3, -1), v(-4, -2, -1)], w.glow('#64d3ff', 2), 0.04, true);
    const cart = w.box(park, [0.45, 0.25, 0.35], [0, 0, 0], w.glow('#ffca7a', 2));
    w.ticks.push(time => { wheel.rotation.z = time * 0.09; cars.forEach(car => { car.rotation.z = -wheel.rotation.z; }); const u = time * 0.05 % 1; cart.position.copy(track.getPointAt(u)); cart.quaternion.setFromUnitVectors(v(1, 0, 0), track.getTangentAt(u)); cloudBed.position.x = Math.sin(time * 0.12 + side) * 0.2; });
  }
}
