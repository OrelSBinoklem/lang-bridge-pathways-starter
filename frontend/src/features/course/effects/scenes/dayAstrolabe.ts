import type { CanvasSceneDef, SceneCtx } from './types';
import { World, T, TAU, v } from './cinematic/world';
import { backdrop, group } from './cinematic/storyKit';

/**
 * «Мой планировщик» — the astrolabe of the day (owner, 2026-10-30: «придумай парочку крутых эффектов для карточек»).
 * A brass astrolabe in front of a star chart, set to the real clock: the 24-hour limb, a ring of the days of the week
 * and a ring of the months (in Latvian), turned so that today and this month are at the top; the rule (alidade) points
 * at the hour now, carrying the sun (and the moon opposite); the openwork rete with its star pointers turns slowly like
 * the sky, gears turn behind the plate.
 *
 * The planner: a click on the dial puts a glowing gem — a task — at that hour on the limb; a click on a gem takes it
 * off again (at most twelve). Engravings are canvas textures drawn once (a flat ring's UVs are planar, so text drawn
 * round a circle on a square canvas lands on the ring). Brass is physical metal lit by the room environment.
 */

const DAYS_LV = ['PIRMDIENA', 'OTRDIENA', 'TREŠDIENA', 'CETURTDIENA', 'PIEKTDIENA', 'SESTDIENA', 'SVĒTDIENA'];
const MONTHS_LV = ['JANVĀRIS', 'FEBRUĀRIS', 'MARTS', 'APRĪLIS', 'MAIJS', 'JŪNIJS', 'JŪLIJS', 'AUGUSTS', 'SEPTEMBRIS', 'OKTOBRIS', 'NOVEMBRIS', 'DECEMBRIS'];
const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

/** A square canvas for a flat ring's face: (0,0) at its middle, px per unit, text bent round circles. */
function face(size: number, extent: number, paint: (g: CanvasRenderingContext2D, k: number) => void) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  g.translate(size / 2, size / 2);
  paint(g, size / 2 / extent);
  return cv;
}
/** Text along a circle, centred on an angle (0 = top, clockwise), upright when read from outside. */
function arcText(g: CanvasRenderingContext2D, text: string, radius: number, centre: number, font: string, color: string, spacing = 1.08) {
  g.save();
  g.font = font;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const widths = [...text].map((ch) => g.measureText(ch).width * spacing);
  const total = widths.reduce((a, b) => a + b, 0);
  // In the lower half the letters run the other way round and are turned over, so they read left to right.
  const bottom = Math.cos(centre) < 0;
  let a = bottom ? centre + total / radius / 2 : centre - total / radius / 2;
  for (let i = 0; i < text.length; i += 1) {
    const step = widths[i] / radius;
    a += bottom ? -step / 2 : step / 2;
    g.save();
    g.rotate(a);
    g.translate(0, -radius);
    if (bottom) g.rotate(Math.PI);
    g.fillText(text[i], 0, 0);
    g.restore();
    a += bottom ? -step / 2 : step / 2;
  }
  g.restore();
}

function gearShape(teeth: number, r: number, depth: number) {
  const s = new T.Shape();
  for (let i = 0; i <= teeth * 4; i += 1) {
    const a = (i / (teeth * 4)) * TAU;
    const rr = i % 4 === 1 || i % 4 === 2 ? r + depth : r;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const hole = new T.Path();
  hole.absarc(0, 0, r * 0.25, 0, TAU, true);
  s.holes.push(hole);
  for (let k = 0; k < 5; k += 1) {
    const w = new T.Path();
    const a = (k / 5) * TAU;
    w.absarc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * 0.18, 0, TAU, true);
    s.holes.push(w);
  }
  return s;
}

export const DAY_ASTROLABE: CanvasSceneDef = {
  kind: 'canvas',
  id: 'day-astrolabe',
  label: 'Астролябия дня · часы, дни и месяцы, дела по клику',
  palettes: [['#0b1220', '#d9b36a', '#7fb7d9', '#e8d6a8']],
  defaultParams: { cinemaBloom: 0.35, cinemaCamera: 0.1 },
  create(c: SceneCtx) {
    const w = new World(c, '#7fb7d9', '#070b14');
    backdrop(w, '#0e1a30', '#05070d');
    w.cameraMotion = 0.1;
    w.exposure = 1.1;
    const wide = c.width / c.height;
    w.eye.set(1.6, 0.9, 12.5);
    w.target.set(0, 0, 0);
    if (w.mobile) w.eye.set(0, 0.5, 19);
    if (!c.body && wide > 2.2) {
      w.eye.set(1.4, 0.9, 15.5);
      w.camera.setViewOffset(c.width, c.height, -c.width * 0.24, 0, c.width, c.height);
    }
    const brass = new T.MeshStandardMaterial({ color: '#c9a25a', metalness: 0.92, roughness: 0.3 });
    const darkBrass = new T.MeshStandardMaterial({ color: '#8a6a34', metalness: 0.9, roughness: 0.42 });
    const steel = new T.MeshStandardMaterial({ color: '#9aa4ad', metalness: 0.95, roughness: 0.25 });
    const ink = '#3a2610';
    const tex = (cv: HTMLCanvasElement) => {
      const t = w.ownTexture(new T.CanvasTexture(cv));
      t.colorSpace = T.SRGBColorSpace;
      t.anisotropy = Math.min(8, w.renderer.capabilities.getMaxAnisotropy());
      return t;
    };
    const engraved = (cv: HTMLCanvasElement, roughness = 0.34) => new T.MeshStandardMaterial({ map: tex(cv), metalness: 0.88, roughness });

    // The star chart behind (a wide plane): faint stars, constellation lines, coordinate circles.
    const chart = face(2048, 14, (g, k) => {
      g.fillStyle = '#0a1426';
      g.fillRect(-1024, -1024, 2048, 2048);
      g.strokeStyle = 'rgba(120,160,210,0.16)';
      g.lineWidth = 2;
      for (let r = 2; r < 14; r += 2) { g.beginPath(); g.arc(0, 0, r * k, 0, TAU); g.stroke(); }
      for (let a = 0; a < 24; a += 1) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos((a / 24) * TAU) * 14 * k, Math.sin((a / 24) * TAU) * 14 * k); g.stroke(); }
      const stars: [number, number][] = [];
      for (let i = 0; i < 900; i += 1) {
        const x = (c.rand() - 0.5) * 2048, y = (c.rand() - 0.5) * 2048, b = Math.pow(c.rand(), 3);
        g.fillStyle = `rgba(220,230,255,${(0.2 + b * 0.8).toFixed(2)})`;
        g.beginPath(); g.arc(x, y, 0.8 + b * 3, 0, TAU); g.fill();
        if (b > 0.35) stars.push([x, y]);
      }
      g.strokeStyle = 'rgba(160,190,230,0.28)';
      g.lineWidth = 1.5;
      for (let i = 0; i + 4 < stars.length; i += 5) {
        g.beginPath();
        g.moveTo(stars[i][0], stars[i][1]);
        for (let j = 1; j < 4; j += 1) if (Math.hypot(stars[i + j][0] - stars[i][0], stars[i + j][1] - stars[i][1]) < 380) g.lineTo(stars[i + j][0], stars[i + j][1]);
        g.stroke();
      }
    });
    const chartMesh = w.mesh(new T.PlaneGeometry(40, 40), new T.MeshBasicMaterial({ map: tex(chart), color: '#8a9ab8', fog: false }), w.root);
    chartMesh.position.z = -7;
    chartMesh.castShadow = false;

    const astro = group(w.root);
    astro.rotation.set(-0.06, -0.18, 0);
    // The mater: the plate with the hour limb engraved, its raised rim, the throne and shackle on top.
    const mater = face(2048, 4.3, (g, k) => {
      const plate = g.createRadialGradient(0, 0, 0, 0, 0, 4.3 * k);
      plate.addColorStop(0, '#c9a560');
      plate.addColorStop(1, '#a8823e');
      g.fillStyle = plate;
      g.fillRect(-1024, -1024, 2048, 2048);
      g.strokeStyle = ink;
      for (const r of [3.32, 3.38, 4.12]) { g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r * k, 0, TAU); g.stroke(); }
      for (let i = 0; i < 24 * 4; i += 1) {
        const a = (i / 96) * TAU, major = i % 4 === 0;
        g.lineWidth = major ? 5 : 2;
        g.beginPath();
        g.moveTo(Math.sin(a) * 3.38 * k, -Math.cos(a) * 3.38 * k);
        g.lineTo(Math.sin(a) * (major ? 3.62 : 3.5) * k, -Math.cos(a) * (major ? 3.62 : 3.5) * k);
        g.stroke();
      }
      // Roman numerals twice round (noon at the top, midnight at the bottom).
      for (let i = 0; i < 24; i += 1) arcText(g, ROMAN[(i + 12) % 12], 3.86 * k, (i / 24) * TAU, `600 ${Math.round(0.25 * k)}px Georgia, serif`, ink);
      // Almucantars and azimuth curves (the engraved sky of the plate).
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(58,38,16,0.7)';
      for (let i = 0; i < 9; i += 1) { const r = (0.3 + i * 0.33) * k; g.beginPath(); g.ellipse(0, -i * 0.12 * k, r, r * 0.92, 0, 0, TAU); g.stroke(); }
      for (let i = -6; i <= 6; i += 1) { g.beginPath(); g.ellipse(i * 0.42 * k, 0.6 * k, Math.abs(i) * 0.38 * k + 0.6 * k, 2.6 * k, 0, 0, TAU); g.stroke(); }
    });
    // A plain disc, its engraved face a circle on top (a circle's UVs are planar: the canvas lands upright).
    const plateMesh = w.mesh(new T.CylinderGeometry(4.3, 4.3, 0.22, 128), darkBrass, astro);
    plateMesh.rotation.x = Math.PI / 2;
    w.mesh(new T.CircleGeometry(4.3, 160), engraved(mater), astro).position.z = 0.112;
    w.ring(astro, 4.32, 0.13, brass).position.z = 0.06;
    w.ring(astro, 3.32, 0.05, brass).position.z = 0.1;
    const throne = group(astro, 0, 4.55, 0);
    w.ring(throne, 0.42, 0.08, brass);
    w.sphere(throne, 0.16, [0, -0.36, 0], brass);
    for (const s of [-1, 1]) w.sphere(throne, 0.11, [s * 0.45, -0.25, 0], brass);
    const shackle = w.ring(throne, 0.32, 0.05, steel);
    shackle.position.y = 0.62;
    shackle.rotation.y = Math.PI / 2;

    // The week ring: today at the top. The month ring inside it.
    const today = new Date();
    const dayIndex = (today.getDay() + 6) % 7;
    const weekCanvas = face(2048, 3.28, (g, k) => {
      g.fillStyle = '#b48e48';
      g.fillRect(-1024, -1024, 2048, 2048);
      g.strokeStyle = ink;
      g.lineWidth = 3;
      for (const r of [2.6, 3.28]) { g.beginPath(); g.arc(0, 0, r * k, 0, TAU); g.stroke(); }
      for (let i = 0; i < 7; i += 1) {
        const a0 = ((i - 0.5) / 7) * TAU;
        g.beginPath(); g.moveTo(Math.sin(a0) * 2.6 * k, -Math.cos(a0) * 2.6 * k); g.lineTo(Math.sin(a0) * 3.28 * k, -Math.cos(a0) * 3.28 * k); g.stroke();
        arcText(g, DAYS_LV[i], 2.95 * k, (i / 7) * TAU, `700 ${Math.round(0.2 * k)}px Georgia, serif`, ink, 1.12);
      }
    });
    const weekRing = group(astro, 0, 0, 0.16);
    w.mesh(new T.RingGeometry(2.6, 3.28, 160, 1), engraved(weekCanvas), weekRing);
    w.ring(weekRing, 3.28, 0.035, brass);
    w.ring(weekRing, 2.6, 0.035, brass);
    const monthCanvas = face(2048, 2.55, (g, k) => {
      g.fillStyle = '#a07a38';
      g.fillRect(-1024, -1024, 2048, 2048);
      g.strokeStyle = ink;
      g.lineWidth = 3;
      for (const r of [1.95, 2.55]) { g.beginPath(); g.arc(0, 0, r * k, 0, TAU); g.stroke(); }
      for (let i = 0; i < 12; i += 1) {
        const a0 = ((i - 0.5) / 12) * TAU;
        g.beginPath(); g.moveTo(Math.sin(a0) * 1.95 * k, -Math.cos(a0) * 1.95 * k); g.lineTo(Math.sin(a0) * 2.55 * k, -Math.cos(a0) * 2.55 * k); g.stroke();
        arcText(g, MONTHS_LV[i], 2.25 * k, (i / 12) * TAU, `700 ${Math.round(0.15 * k)}px Georgia, serif`, ink, 1.1);
      }
    });
    const monthRing = group(astro, 0, 0, 0.2);
    w.mesh(new T.RingGeometry(1.95, 2.55, 160, 1), engraved(monthCanvas), monthRing);
    w.ring(monthRing, 1.95, 0.03, brass);
    // The rete: an openwork ring with curved star pointers carrying small gem stars.
    const rete = group(astro, 0, 0, 0.32);
    w.ring(rete, 1.75, 0.045, brass);
    w.ring(rete, 1.05, 0.03, brass).position.y = 0.35;
    const gems = ['#ff6b6b', '#ffd27a', '#7fd6e8', '#b79cff', '#7fe0a0', '#ffffff'];
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * TAU + 0.2;
      const r0 = 1.75, r1 = 2.4 + (i % 3) * 0.45;
      const mid = (r0 + r1) / 2;
      w.tube(rete, [v(Math.sin(a) * r0, Math.cos(a) * r0, 0), v(Math.sin(a + 0.12) * mid, Math.cos(a + 0.12) * mid, 0.03), v(Math.sin(a + 0.05) * r1, Math.cos(a + 0.05) * r1, 0)], brass, 0.03);
      w.sphere(rete, 0.07, [Math.sin(a + 0.05) * r1, Math.cos(a + 0.05) * r1, 0.03], w.glow(gems[i % gems.length], 1.6));
    }
    // The rule: points at the hour now, the sun on it; the moon opposite.
    const rule = group(astro, 0, 0, 0.42);
    const bar = w.box(rule, [0.14, 8.0, 0.05], [0, 0, 0], brass);
    void bar;
    w.mesh(new T.ConeGeometry(0.16, 0.35, 4), brass, rule).position.set(0, 4.1, 0);
    const sun = w.sphere(rule, 0.26, [0, 2.95, 0.05], w.glow('#ffcc66', 2.6));
    for (let i = 0; i < 12; i += 1) {
      const ray = w.mesh(new T.ConeGeometry(0.045, 0.22, 4), w.glow('#ffb84d', 2), sun);
      const a = (i / 12) * TAU;
      ray.position.set(Math.sin(a) * 0.36, Math.cos(a) * 0.36, 0);
      ray.rotation.z = -a;
    }
    const moon = w.sphere(rule, 0.18, [0, -2.95, 0.05], new T.MeshStandardMaterial({ color: '#dfe6f2', emissive: '#9ab0d8', emissiveIntensity: 0.5, roughness: 0.6 }));
    void moon;
    // The pin and the wedge in the middle.
    w.mesh(new T.CylinderGeometry(0.18, 0.18, 0.4, 24), steel, astro).rotation.x = Math.PI / 2;
    astro.children[astro.children.length - 1].position.z = 0.5;
    w.sphere(astro, 0.2, [0, 0, 0.72], brass);
    // Gears behind the plate, a little out past its edge.
    const gearMesh = (teeth: number, r: number, x: number, y: number, z: number) => {
      const geo = new T.ExtrudeGeometry(gearShape(teeth, r, r * 0.12), { depth: 0.12, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
      const m = w.mesh(geo, darkBrass, astro);
      m.position.set(x, y, z);
      return m;
    };
    const gears = [gearMesh(24, 1.5, -3.4, -2.6, -0.35), gearMesh(14, 0.85, -1.4, -3.9, -0.35), gearMesh(30, 1.9, 3.3, 2.4, -0.4), gearMesh(12, 0.7, 4.6, 0.5, -0.3)];
    const gearSpeed = [0.12, -0.12 * 24 / 14, -0.09, 0.09 * 30 / 12];

    // The tasks: gems on the limb at the hours they were set for.
    type Task = { hour: number; mesh: T.Mesh };
    const tasks: Task[] = [];
    const taskColors = ['#ff7a8a', '#ffd27a', '#7fe0c0', '#8fb8ff', '#d79cff', '#ffa86b'];
    // Clockwise from the top, noon at the top.
    const hourAngle = (hour: number) => ((hour - 12) / 24) * TAU;
    const addTask = (hour: number) => {
      const color = taskColors[tasks.length % taskColors.length];
      const m = w.mesh(new T.OctahedronGeometry(0.17, 0), w.glow(color, 2.2), astro);
      const a = hourAngle(hour);
      m.position.set(Math.sin(a) * 3.75, Math.cos(a) * 3.75, 0.25);
      m.userData.born = 0;
      tasks.push({ hour, mesh: m });
    };
    // A couple of tasks to start with: the morning lesson and the evening practice.
    addTask(9);
    addTask(19.5);

    const ray = new T.Raycaster(), mouse = new T.Vector2();
    const hit = new T.Vector3();
    const plane = new T.Plane();
    w.ticks.push((time, dt, p) => {
      const now = new Date();
      const hour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
      // Noon at the top: the rule's angle from the top, clockwise.
      const target = -(hour / 24) * TAU + Math.PI;
      rule.rotation.z += (target - rule.rotation.z) * (1 - Math.exp(-dt * 2));
      weekRing.rotation.z = (dayIndex / 7) * TAU;
      monthRing.rotation.z = (now.getMonth() / 12) * TAU;
      rete.rotation.z = -time * 0.05;
      gears.forEach((g, k) => { g.rotation.z = time * gearSpeed[k]; });
      sun.rotation.z = time * 0.4;
      astro.rotation.y = -0.18 + w.pointer.x * 0.12 * c.params.react;
      astro.rotation.x = -0.06 - w.pointer.y * 0.08 * c.params.react;
      for (const t of tasks) {
        t.mesh.userData.born = Math.min(1, t.mesh.userData.born + dt * 2.5);
        const s = t.mesh.userData.born * (1 + 0.12 * Math.sin(time * 3 + t.hour));
        t.mesh.scale.setScalar(s);
        t.mesh.rotation.y = time * 1.2 + t.hour;
      }
      if (p.clicked && c.params.react > 0) {
        mouse.set((p.rawX / c.width) * 2 - 1, 1 - (p.rawY / c.height) * 2);
        ray.setFromCamera(mouse, w.camera);
        const hits = ray.intersectObjects(tasks.map((t) => t.mesh), false);
        if (hits[0]) {
          const k = tasks.findIndex((t) => t.mesh === hits[0].object);
          tasks[k].mesh.removeFromParent();
          tasks[k].mesh.geometry.dispose();
          tasks.splice(k, 1);
        } else {
          // The click on the dial: the plate's plane in its own frame, then the angle from the top, clockwise.
          astro.updateMatrixWorld(true);
          const normal = v(0, 0, 1).applyQuaternion(astro.getWorldQuaternion(new T.Quaternion()));
          plane.setFromNormalAndCoplanarPoint(normal, astro.getWorldPosition(new T.Vector3()));
          if (ray.ray.intersectPlane(plane, hit)) {
            const local = astro.worldToLocal(hit.clone());
            const r = Math.hypot(local.x, local.y);
            if (r < 4.3 && tasks.length < 12) {
              const fromTop = Math.atan2(local.x, local.y);
              const h = (((fromTop / TAU) * 24 + 12) % 24 + 24) % 24;
              addTask(Math.round(h * 2) / 2);
            }
          }
        }
      }
    });
    return w;
  },
};
