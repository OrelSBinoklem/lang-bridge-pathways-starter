import type { CanvasSceneDef, SceneCtx } from './types';
import { World, T, TAU, v } from './cinematic/world';
import { backdrop, group } from './cinematic/storyKit';

/**
 * «Образование и карьера» — the endless library (owner, 2026-10-30: «придумай парочку крутых эффектов для карточек»).
 * A round well of a tower library: gallery above gallery of curved bookcases round the walls, a balustrade with warm
 * lamps on every level, the light of a skylight from far above, the depth lost in haze below. The view rises slowly
 * through the levels — labelled A1, A2, B1, B2, C1, C2 on gold plaques, round and round (the climb has no end: after
 * six levels the view is where it began, a level-for-level copy, so the loop is seamless).
 *
 * A click calls a book: it slides out of a shelf across the well, flies up to the view, opens, riffles its pages with
 * a glow of letters, then closes and flies home. The books are one instanced mesh (thousands, one draw call); the
 * frames, floors and rails of every level are merged per material.
 */

const LEVEL = 3.4;
const LEVELS = 12;
const R_WELL = 4.6;
const R_WALL = 8.2;
const BAYS = 22;
const SHELVES = 5;
const LABELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const SPIRAL_LIBRARY: CanvasSceneDef = {
  kind: 'canvas',
  id: 'spiral-library',
  label: 'Бесконечная библиотека · уровни A1–C2, книга по клику',
  palettes: [['#120d0a', '#e8b46a', '#8a5a34', '#f3dfb2']],
  defaultParams: { cinemaBloom: 0.5, cinemaCamera: 0.05 },
  create(c: SceneCtx) {
    const w = new World(c, '#e8b46a', '#0c0907');
    backdrop(w, '#3a2a1c', '#0b0806');
    w.scene.fog = new T.FogExp2('#120d09', 0.045);
    w.scene.environmentIntensity = 0.35;
    w.cameraMotion = 0.05;
    w.exposure = 1.15;
    w.scene.traverse((o) => {
      if (o instanceof T.HemisphereLight) { o.intensity = 0.9; o.color.set('#ffe2b5'); o.groundColor.set('#2a1a10'); }
      else if (o instanceof T.DirectionalLight) {
        if (o.castShadow) { o.castShadow = false; o.position.set(0, 30, 0); o.intensity = 1.6; o.color.set('#fff1d6'); }
        else o.intensity = 0.4;
      }
    });
    const wide = c.width / c.height;
    // The view: at the well's edge, looking across and a little down at the far wall.
    const eyeR = R_WELL * 0.55;
    const look = (y: number) => {
      w.eye.set(0, y, eyeR);
      w.target.set(0, y - 2.2, -R_WALL);
    };
    let climb = LEVEL * 3 + 1.6;
    look(climb);
    if (!c.body && wide > 2.2) w.camera.setViewOffset(c.width, c.height, -c.width * 0.2, 0, c.width, c.height);
    w.camera.fov = w.mobile ? 70 : 58;
    w.camera.updateProjectionMatrix();

    const wood = new T.MeshStandardMaterial({ color: '#5a3820', roughness: 0.6, metalness: 0.05 });
    const darkWood = new T.MeshStandardMaterial({ color: '#2e1c10', roughness: 0.7, metalness: 0.02 });
    const floorMat = new T.MeshStandardMaterial({ color: '#4a3020', roughness: 0.55, metalness: 0.05 });
    const brass = new T.MeshStandardMaterial({ color: '#d8a85a', roughness: 0.3, metalness: 0.9 });
    const lampMat = w.glow('#ffc073', 2.4);
    // The plaques: polished gold, a touch of their own light so the level reads from across the well.
    const plaqueMat = new T.MeshStandardMaterial({ color: '#e2b768', emissive: '#a07028', emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.3 });
    const tower = group(w.root);

    // ---- one level's static parts (floor ring, its edge, rails, balusters, bookcase frames), then copied.
    const levelParts = (lv: number) => {
      const y0 = lv * LEVEL;
      const lvg = group(tower, 0, y0, 0);
      const floor = w.mesh(new T.RingGeometry(R_WELL, R_WALL + 0.2, 96, 1), floorMat, lvg);
      floor.rotation.x = -Math.PI / 2;
      const under = w.mesh(new T.RingGeometry(R_WELL, R_WALL + 0.2, 96, 1), darkWood, lvg);
      under.rotation.x = Math.PI / 2;
      under.position.y = -0.3;
      w.mesh(new T.CylinderGeometry(R_WELL, R_WELL, 0.3, 96, 1, true), darkWood, lvg).position.y = -0.15;
      // The balustrade: a top rail, a bottom rail, turned balusters.
      const rail = w.ring(lvg, R_WELL + 0.12, 0.06, wood);
      rail.rotation.x = Math.PI / 2;
      rail.position.y = 1.0;
      const rail2 = w.ring(lvg, R_WELL + 0.12, 0.04, darkWood);
      rail2.rotation.x = Math.PI / 2;
      rail2.position.y = 0.12;
      for (let k = 0; k < 64; k += 1) {
        const a = (k / 64) * TAU;
        const b = w.mesh(new T.CylinderGeometry(0.035, 0.05, 0.86, 8), darkWood, lvg);
        b.position.set(Math.sin(a) * (R_WELL + 0.12), 0.56, Math.cos(a) * (R_WELL + 0.12));
      }
      // The outer wall behind the cases, and the cases' frames: uprights and shelf boards round the wall.
      w.mesh(new T.CylinderGeometry(R_WALL + 0.35, R_WALL + 0.35, LEVEL, 96, 1, true), darkWood, lvg).position.y = LEVEL / 2 - 0.3;
      (lvg.children[lvg.children.length - 1] as T.Mesh).material = new T.MeshStandardMaterial({ color: '#1e130b', roughness: 0.9, side: T.BackSide });
      for (let k = 0; k < BAYS; k += 1) {
        const a = (k / BAYS) * TAU;
        const up = w.box(lvg, [0.16, LEVEL - 0.3, 0.5], [Math.sin(a) * R_WALL, (LEVEL - 0.3) / 2, Math.cos(a) * R_WALL], wood);
        up.rotation.y = a;
      }
      for (let s = 0; s <= SHELVES; s += 1) {
        const shelf = w.mesh(new T.CylinderGeometry(R_WALL + 0.25, R_WALL + 0.25, 0.06, 96, 1, true), wood, lvg);
        shelf.position.y = 0.12 + s * ((LEVEL - 0.5) / SHELVES);
        const top = w.mesh(new T.RingGeometry(R_WALL - 0.25, R_WALL + 0.25, 96, 1), wood, lvg);
        top.rotation.x = -Math.PI / 2;
        top.position.y = 0.15 + s * ((LEVEL - 0.5) / SHELVES);
      }
      // Lamps on the rail every few bays, and the level's gold plaque facing the well.
      for (let k = 0; k < 8; k += 1) {
        const a = (k / 8) * TAU + 0.2;
        const post = w.beam(lvg, v(Math.sin(a) * (R_WELL + 0.12), 1.0, Math.cos(a) * (R_WELL + 0.12)), v(Math.sin(a) * (R_WELL + 0.12), 1.55, Math.cos(a) * (R_WELL + 0.12)), 0.025, brass);
        void post;
        const lamp = w.sphere(lvg, 0.11, [Math.sin(a) * (R_WELL + 0.12), 1.62, Math.cos(a) * (R_WELL + 0.12)], lampMat);
        lamp.castShadow = false;
      }
      for (const a of [Math.PI, 0.7, -0.7, Math.PI - 1.2, Math.PI + 1.2]) {
        const plaque = group(lvg, Math.sin(a) * (R_WELL - 0.02), 0.62, Math.cos(a) * (R_WELL - 0.02));
        plaque.rotation.y = a + Math.PI;
        w.box(plaque, [0.7, 0.4, 0.04], [0, 0, 0], plaqueMat);
        const label = w.text(plaque, LABELS[lv % LABELS.length], '#2a1404', 0.62, 0.32);
        label.position.z = 0.03;
        label.castShadow = false;
      }
    };
    for (let lv = 0; lv < LEVELS; lv += 1) levelParts(lv);

    // ---- the books: one instanced mesh, every shelf of every level filled, leaning a little, gaps here and there.
    const palette = ['#7a2a24', '#2a4a6a', '#3a5a34', '#8a6a2a', '#5a2a4a', '#2a2a2e', '#a0502a', '#3a6a6a', '#6a1a1a', '#c9a26a', '#1e3a2a', '#4a3a6a'];
    const placements: { y: number; a: number; h: number; t: number; d: number; tilt: number; col: number }[] = [];
    for (let lv = 0; lv < LEVELS; lv += 1) {
      for (let s = 0; s < SHELVES; s += 1) {
        const y = lv * LEVEL + 0.15 + s * ((LEVEL - 0.5) / SHELVES);
        const room = (LEVEL - 0.5) / SHELVES - 0.08;
        for (let k = 0; k < BAYS; k += 1) {
          const a0 = (k / BAYS) * TAU + 0.025, a1 = ((k + 1) / BAYS) * TAU - 0.025;
          let a = a0;
          while (a < a1) {
            const t = 0.05 + c.rand() * 0.07;
            const da = t / R_WALL;
            if (a + da > a1) break;
            if (c.rand() < 0.06) { a += da * 2; continue; }
            placements.push({ y, a: a + da / 2, h: room * (0.62 + c.rand() * 0.36), t, d: 0.32 + c.rand() * 0.12, tilt: c.rand() < 0.08 ? (c.rand() - 0.5) * 0.5 : 0, col: Math.floor(c.rand() * palette.length) });
            a += da;
          }
        }
      }
    }
    const bookGeo = new T.BoxGeometry(1, 1, 1);
    bookGeo.translate(0, 0.5, 0);
    const bookMat = new T.MeshStandardMaterial({ roughness: 0.65, metalness: 0.05 });
    const books = new T.InstancedMesh(bookGeo, bookMat, placements.length);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), pos = new T.Vector3(), scl = new T.Vector3();
    const col = new T.Color();
    placements.forEach((b, i) => {
      const r = R_WALL - 0.04 - b.d / 2;
      pos.set(Math.sin(b.a) * r, b.y, Math.cos(b.a) * r);
      e.set(0, b.a, b.tilt);
      q.setFromEuler(e);
      scl.set(b.t, b.h, b.d);
      books.setMatrixAt(i, m4.compose(pos, q, scl));
      col.set(palette[b.col]).offsetHSL(0, 0, (c.rand() - 0.5) * 0.08);
      books.setColorAt(i, col);
    });
    books.castShadow = false;
    books.receiveShadow = false;
    tower.add(books);
    // Gold bands on the spines: a thin second instanced mesh, every other book.
    const bandGeo = new T.BoxGeometry(1, 1, 1);
    const bands = new T.InstancedMesh(bandGeo, brass, Math.ceil(placements.length / 2));
    let nb = 0;
    placements.forEach((b, i) => {
      if (i % 2) return;
      const r = R_WALL - 0.04 - b.d + 0.005;
      for (const f of [0.18]) {
        pos.set(Math.sin(b.a) * r, b.y + b.h * f, Math.cos(b.a) * r);
        e.set(0, b.a, b.tilt);
        q.setFromEuler(e);
        scl.set(b.t * 1.02, 0.025, 0.01);
        bands.setMatrixAt(nb++, m4.compose(pos, q, scl));
      }
    });
    bands.count = nb;
    tower.add(bands);

    // ---- the skylight far above (a glowing disc), and dust in the light.
    const sky = w.mesh(new T.CircleGeometry(R_WELL, 64), new T.MeshBasicMaterial({ color: '#fff0cc', fog: false }), w.root);
    sky.rotation.x = Math.PI / 2;
    sky.position.y = LEVELS * LEVEL + 4;
    w.dust(240, '#ffd9a0', 4, 0.05);

    // ---- the flying book: covers on hinges, a block of pages, a few loose pages that flip, a glow of letters.
    const fly = group(w.root);
    fly.visible = false;
    const coverMat = new T.MeshStandardMaterial({ color: '#6a1a1a', roughness: 0.5 });
    // The pages: lines of text (grey strokes of uneven length), a drop cap and a small engraving.
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = 512;
    pageCanvas.height = 720;
    {
      const g = pageCanvas.getContext('2d')!;
      g.fillStyle = '#f1e6cc';
      g.fillRect(0, 0, 512, 720);
      const edge = g.createRadialGradient(256, 360, 200, 256, 360, 470);
      edge.addColorStop(0, 'rgba(160,120,60,0)');
      edge.addColorStop(1, 'rgba(160,120,60,0.25)');
      g.fillStyle = edge;
      g.fillRect(0, 0, 512, 720);
      g.fillStyle = '#7a2a1a';
      g.font = '700 86px Georgia, serif';
      g.fillText('L', 52, 140);
      g.strokeStyle = '#6a5a48';
      g.lineWidth = 2;
      g.strokeRect(150, 300, 212, 150);
      for (let k = 0; k < 18; k += 1) { g.beginPath(); g.moveTo(160, 440 - k * 6); g.quadraticCurveTo(256, 380 - k * 3 - (k % 3) * 8, 352, 430 - k * 7); g.stroke(); }
      g.fillStyle = 'rgba(60,50,40,0.75)';
      for (let y = 70; y < 680; y += 22) {
        if (y > 285 && y < 465) continue;
        const x0 = y < 160 ? 120 : 48;
        const len = 380 - (x0 - 48) - (y % 7 === 0 ? 90 : Math.floor(Math.abs(Math.sin(y)) * 30));
        g.fillRect(x0, y, len, 4);
      }
    }
    const pageTex = w.ownTexture(new T.CanvasTexture(pageCanvas));
    pageTex.colorSpace = T.SRGBColorSpace;
    const pageMat = new T.MeshStandardMaterial({ map: pageTex, roughness: 0.85, side: T.DoubleSide });
    const left = group(fly), right = group(fly);
    w.box(left, [0.5, 0.7, 0.03], [-0.25, 0, 0], coverMat);
    w.box(left, [0.47, 0.66, 0.05], [-0.25, 0, 0.04], pageMat);
    w.box(right, [0.5, 0.7, 0.03], [0.25, 0, 0], coverMat);
    w.box(right, [0.47, 0.66, 0.05], [0.25, 0, 0.04], pageMat);
    const goldTitle = w.text(right, 'LATVIEŠU', '#e8c27a', 0.42, 0.1);
    goldTitle.position.set(0.25, 0.12, -0.02);
    goldTitle.rotation.y = Math.PI;
    const flips = Array.from({ length: 4 }, () => {
      const hinge = group(fly, 0, 0, 0.07);
      const page = w.mesh(new T.PlaneGeometry(0.46, 0.64, 6, 1), pageMat, hinge);
      page.position.x = 0.24;
      return hinge;
    });
    const letters = (() => {
      const n = 60;
      const p = new Float32Array(n * 3);
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(p, 3));
      const dot = document.createElement('canvas');
      dot.width = dot.height = 32;
      const dg = dot.getContext('2d')!;
      const grad = dg.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      dg.fillStyle = grad;
      dg.fillRect(0, 0, 32, 32);
      const pts = new T.Points(geo, new T.PointsMaterial({ color: '#ffd27a', size: 0.05, map: w.ownTexture(new T.CanvasTexture(dot)), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
      fly.add(pts);
      return { p, geo, pts, seed: Array.from({ length: n }, () => [c.rand(), c.rand(), c.rand()]) };
    })();
    let flight = -1;
    const from = new T.Vector3(), home = new T.Vector3();

    w.ticks.push((time, dt, p) => {
      // The climb, seamless every six levels.
      climb += dt * 0.32;
      if (climb > LEVEL * 9 + 1.6) climb -= LEVEL * 6;
      look(climb);
      w.target.x = w.pointer.x * 2.2 * c.params.react;
      w.target.y += w.pointer.y * 1.6 * c.params.react;
      lampMat.emissiveIntensity = 2.2 + 0.25 * Math.sin(time * 3.1);
      if (p.clicked && c.params.react > 0 && flight < 0) {
        // A book from the far wall at about eye height.
        const a = Math.PI + (c.rand() - 0.5) * 1.2;
        home.set(Math.sin(a) * (R_WALL - 0.3), climb - 1.6 + (c.rand() - 0.5) * 1.2, Math.cos(a) * (R_WALL - 0.3));
        from.copy(home);
        coverMat.color.set(palette[Math.floor(c.rand() * palette.length)]);
        flight = 0;
        fly.visible = true;
      }
      if (flight >= 0) {
        flight += dt;
        const T1 = 1.6, T2 = 4.6, T3 = 6.2;
        // Where it hangs: in front of the view, a little below the middle.
        const view = v(0, climb - 0.55, eyeR - 2.2);
        if (flight < T1) {
          const u = flight / T1, s = u * u * (3 - 2 * u);
          fly.position.lerpVectors(from, view, s);
          fly.position.y += Math.sin(u * Math.PI) * 1.2;
          fly.rotation.set(0, (1 - s) * Math.PI * 1.5, (1 - s) * 0.6);
        } else if (flight < T3) {
          fly.position.copy(view);
          fly.position.y += Math.sin(time * 1.5) * 0.04;
          fly.rotation.set(-0.25, 0, 0);
        }
        // Open, riffle, close.
        const open = flight < T1 ? 0 : flight < T1 + 0.6 ? (flight - T1) / 0.6 : flight < T2 ? 1 : flight < T2 + 0.6 ? 1 - (flight - T2) / 0.6 : 0;
        left.rotation.y = -open * 1.45;
        right.rotation.y = open * 1.45;
        flips.forEach((h, k) => {
          const ph = Math.max(0, Math.min(1, (flight - T1 - 0.7 - k * 0.45) / 0.55));
          h.rotation.y = open > 0.99 ? -ph * Math.PI * 0.92 + 0.0 : -open * 0.05;
          h.visible = open > 0.3;
        });
        const glowing = open > 0.9 ? 1 : 0;
        (letters.pts.material as T.PointsMaterial).opacity += (glowing * 0.9 - (letters.pts.material as T.PointsMaterial).opacity) * Math.min(1, dt * 4);
        letters.seed.forEach(([a, b, s], k) => {
          const t = (time * 0.4 + s) % 1;
          letters.p.set([(a - 0.5) * 0.8, (b - 0.5) * 0.5 + t * 0.6, 0.1 + t * 0.4], k * 3);
        });
        letters.geo.attributes.position.needsUpdate = true;
        if (flight >= T3) {
          const u = Math.min(1, (flight - T3) / 1.4), s = u * u * (3 - 2 * u);
          fly.position.lerpVectors(view, home, s);
          fly.rotation.set(0, s * Math.PI, 0);
          if (u >= 1) { flight = -1; fly.visible = false; }
        }
      }
    });
    return w;
  },
};
