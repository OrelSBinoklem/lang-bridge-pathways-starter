import type { CanvasSceneDef, SceneCtx } from './types';
import { World, T, TAU, v } from './cinematic/world';
import { backdrop, bake, group } from './cinematic/storyKit';

/**
 * «Место жительства» — a snow globe with our little town (owner, 2026-10-30: «придумай парочку крутых эффектов для
 * карточек»; then «детализацию и размер больше, и пусть физически достоверно плавают частицы»).
 *
 * On a turned wooden base (brass bands, little brass feet, the music box's winding key behind, a plaque MĀJAS) a glass
 * sphere — physical transmission, it refracts the room and the town — holds a snowy Latvian town at dusk: coloured
 * houses with red roofs under snow, framed windows with shutters and snowy sills (two half-timbered), chimneys; a
 * church with a copper spire; a cobbled square with a Christmas tree in lights; a frozen pond with a skater; people in
 * hats walking round; a little fence; firs; lamp posts; a warm light inside.
 *
 * The snow floats in liquid. The liquid has its own motion: a swirl about the vertical (solid-body rotation), a
 * secondary circulation that a spin drives (up in the middle, down by the glass), a slosh and some turbulence — all
 * decaying viscously over a few seconds. Each flake has its own size, so its own settling speed (Stokes: slow) and its
 * own response time: it lags the flow, tumbles faster in faster flow and flutters as it sinks; it comes to rest lying
 * flat on the ground or a roof, and is lifted again only when the flow there is strong. Two kinds: snow (white star
 * flakes, matte) and glitter (metal hexagons that flash when they turn to the light). Dragging with the button held
 * (or a quick move) shakes the globe: it rocks on a spring and the liquid lags the glass; a click is a big shake.
 */

const R = 2.6;
const SCALE = 1.22;

export const SNOW_GLOBE: CanvasSceneDef = {
  kind: 'canvas',
  id: 'snow-globe-town',
  label: 'Снежный шар с городком · встряхнуть мышью',
  palettes: [['#0b0d16', '#ffd38a', '#9fc4e8', '#e9eef7']],
  defaultParams: { cinemaBloom: 0.5, cinemaCamera: 0.08 },
  create(c: SceneCtx) {
    const w = new World(c, '#9fc4e8', '#0a0b12');
    backdrop(w, '#141a2c', '#07080d');
    w.cameraMotion = 0.08;
    w.exposure = 1.05;
    w.scene.environmentIntensity = 0.7;
    // The room environment turned so its ceiling light does not sit on the glass right over the spire.
    w.scene.environmentRotation.set(0.55, 0.9, 0);
    const wide = c.width / c.height;
    w.eye.set(0, 4.6, 10.2);
    w.target.set(0, 3.25, 0);
    if (w.mobile) w.eye.set(0, 5, 15);
    if (!c.body && wide > 2.2) {
      w.eye.set(0, 4.0, 11.0);
      w.target.set(0, 3.0, 0);
      w.camera.setViewOffset(c.width, c.height, -c.width * 0.24, 0, c.width, c.height);
    }
    w.scene.traverse((o) => {
      if (o instanceof T.HemisphereLight) { o.intensity = 0.45; o.color.set('#8aa0d0'); }
      else if (o instanceof T.DirectionalLight) {
        if (o.castShadow) { o.intensity = 1.1; o.color.set('#b8c8f0'); o.position.set(-6, 10, 6); }
        else { o.intensity = 1.2; o.color.set('#ffb070'); o.position.set(7, 3, -4); }
      }
    });

    // ---- the room behind: a table, and the bokeh of a window's string lights (none right behind the globe).
    const table = w.mesh(new T.BoxGeometry(34, 0.4, 16), new T.MeshStandardMaterial({ color: '#3a2618', roughness: 0.45, metalness: 0.05 }), w.root);
    table.position.set(0, -0.2, -2);
    const bokehCanvas = document.createElement('canvas');
    bokehCanvas.width = bokehCanvas.height = 64;
    {
      const g = bokehCanvas.getContext('2d')!;
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)');
      gr.addColorStop(0.75, 'rgba(255,255,255,0.55)');
      gr.addColorStop(0.92, 'rgba(255,255,255,0.75)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    }
    const bokehTex = w.ownTexture(new T.CanvasTexture(bokehCanvas));
    const bokehCols = ['#ffcf7a', '#ffb070', '#ff8a6a', '#ffe2a8', '#9fc4e8'];
    for (let k = 0; k < 70; k += 1) {
      const x = (c.rand() - 0.5) * 34, y = 3.5 + Math.sin(x * 0.35) * 1.2 + c.rand() * 3.5;
      if (Math.abs(x) < 8.5) continue;
      // Drawn with the opaque things (additive, no depth), so the glass sees them behind it and refracts them.
      const s = new T.Sprite(new T.SpriteMaterial({ map: bokehTex, color: new T.Color(bokehCols[k % bokehCols.length]).multiplyScalar(0.18 + c.rand() * 0.25), transparent: false, depthWrite: false, fog: false, blending: T.AdditiveBlending }));
      s.position.set(x, y, -15 - c.rand() * 4);
      s.scale.setScalar(0.8 + c.rand() * 1.6);
      w.scene.add(s);
    }

    // ---- the base.
    const globe = group(w.root);
    globe.scale.setScalar(SCALE);
    const baseProfile = [v(0.001, 0), v(2.15, 0), v(2.2, 0.08), v(2.12, 0.22), v(1.98, 0.32), v(2.02, 0.7), v(2.1, 0.86), v(2.0, 0.98), v(1.9, 1.05), v(1.7, 1.12), v(0.001, 1.12)].map((p) => new T.Vector2(p.x, p.y));
    const wood = new T.MeshStandardMaterial({ color: '#5a2e18', roughness: 0.35, metalness: 0.05 });
    const brass = new T.MeshStandardMaterial({ color: '#d4a85a', roughness: 0.25, metalness: 0.92 });
    w.mesh(new T.LatheGeometry(baseProfile, 96), wood, globe);
    for (const [r, y, t] of [[2.01, 0.5, 0.05], [1.92, 1.03, 0.035], [2.16, 0.2, 0.03]] as const) {
      const band = w.ring(globe, r, t, brass);
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
    }
    // Carved flutes round the base, brass feet, the winding key behind.
    const groove = new T.MeshStandardMaterial({ color: '#3a1c0e', roughness: 0.5 });
    for (let k = 0; k < 36; k += 1) {
      const a = (k / 36) * TAU;
      const f = w.box(globe, [0.05, 0.22, 0.03], [Math.sin(a) * 2.0, 0.66, Math.cos(a) * 2.0], groove);
      f.rotation.y = a;
    }
    for (let k = 0; k < 4; k += 1) {
      const a = (k / 4) * TAU + Math.PI / 4;
      w.sphere(globe, 0.16, [Math.sin(a) * 1.9, 0.05, Math.cos(a) * 1.9], brass);
    }
    const key = group(globe, 0, 0.62, -2.1);
    w.beam(key, v(0, 0, 0), v(0, 0, -0.35), 0.04, brass);
    const bow = w.ring(key, 0.16, 0.04, brass);
    bow.position.set(0, 0, -0.5);
    w.ring(key, 0.16, 0.04, brass).position.set(0, 0, -0.5);
    (key.children[key.children.length - 1] as T.Mesh).rotation.y = Math.PI / 2;
    const plaque = group(globe, 0, 0.74, 2.04);
    w.box(plaque, [1.1, 0.3, 0.04], [0, 0, 0], new T.MeshStandardMaterial({ color: '#e6bd70', emissive: '#a8782e', emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.3 }));
    const name = w.text(plaque, 'MĀJAS', '#2e1a08', 1.0, 0.26);
    name.position.z = 0.03;
    name.castShadow = false;

    // ---- the town inside.
    const cy = 1.12 + R * 0.62;
    const ground = 1.12 + 0.12;
    const town = group(globe);
    const snow = new T.MeshStandardMaterial({ color: '#eef2fa', roughness: 0.75, metalness: 0 });
    const groundR = Math.sqrt(R * R - (cy - ground) ** 2) - 0.02;
    const cap = w.mesh(new T.CylinderGeometry(groundR, 1.75, 0.16, 64), snow, town);
    cap.position.y = ground;
    const drifts = group(town);
    for (let k = 0; k < 26; k += 1) {
      const a = c.rand() * TAU, r = c.rand() * 1.95;
      const d = w.sphere(drifts, 0.25 + c.rand() * 0.3, [Math.sin(a) * r, ground + 0.02, Math.cos(a) * r], snow);
      d.scale.y = 0.25;
    }
    // The cobbled square (a canvas texture of setts) and the frozen pond.
    const cobbles = document.createElement('canvas');
    cobbles.width = cobbles.height = 256;
    {
      const g = cobbles.getContext('2d')!;
      g.fillStyle = '#5c5a58';
      g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 14) for (let x = (y / 14) % 2 ? -7 : 0; x < 256; x += 14) {
        const l = 95 + Math.floor(c.rand() * 40);
        g.fillStyle = `rgb(${l},${l - 4},${l - 8})`;
        g.beginPath(); g.roundRect(x + 1, y + 1, 12, 12, 3); g.fill();
      }
      const fade = g.createRadialGradient(128, 128, 60, 128, 128, 128);
      fade.addColorStop(0, 'rgba(238,242,250,0)');
      fade.addColorStop(1, 'rgba(238,242,250,1)');
      g.fillStyle = fade;
      g.fillRect(0, 0, 256, 256);
    }
    const cobTex = w.ownTexture(new T.CanvasTexture(cobbles));
    cobTex.colorSpace = T.SRGBColorSpace;
    const square = w.mesh(new T.CircleGeometry(0.62, 48), new T.MeshStandardMaterial({ map: cobTex, roughness: 0.8 }), town);
    square.rotation.x = -Math.PI / 2;
    square.position.set(0.05, ground + 0.085, 0.45);
    const pond = w.mesh(new T.CircleGeometry(0.42, 40), new T.MeshPhysicalMaterial({ color: '#a8c8e0', roughness: 0.05, metalness: 0.1, clearcoat: 1 }), town);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(1.2, ground + 0.086, 0.95);
    pond.scale.set(1.25, 0.8, 1);
    const facades = ['#d8a24a', '#b84a3a', '#e6d4b0', '#6a8ab0', '#8ab08a', '#d27a5a', '#e8c070', '#a07ac0'];
    const roofMat = new T.MeshStandardMaterial({ color: '#9a3222', roughness: 0.6 });
    const windowMat = w.glow('#ffcf7a', 2.2);
    const frameMat = new T.MeshStandardMaterial({ color: '#f2ece0', roughness: 0.6 });
    const beamMat = new T.MeshStandardMaterial({ color: '#3a2214', roughness: 0.7 });
    const shutterCols = ['#2f5a3a', '#3a4a6a', '#6a2a2a', '#2e4e5a'];
    /** Roofs, for the flakes: each house's footprint (centre, half sizes, turn) and the height of its ridge. */
    const roofs: { x: number; z: number; hw: number; hd: number; rot: number; top: number }[] = [];
    const chimneys: { g: T.Group; at: T.Vector3 }[] = [];
    const house = (x: number, z: number, wdt: number, h: number, d: number, rot: number, col: string, timber = false) => {
      const g = group(town, x, ground + 0.06, z);
      g.rotation.y = rot;
      w.box(g, [wdt, h, d], [0, h / 2, 0], new T.MeshStandardMaterial({ color: col, roughness: 0.7 }));
      if (timber) {
        for (const s of [-0.5, 0, 0.5]) w.box(g, [0.025, h, 0.012], [s * wdt * 0.9, h / 2, d / 2 + 0.006], beamMat);
        w.box(g, [wdt, 0.025, 0.012], [0, h * 0.5, d / 2 + 0.006], beamMat);
        const diag = w.box(g, [0.022, h * 0.62, 0.012], [-wdt * 0.22, h * 0.25, d / 2 + 0.007], beamMat);
        diag.rotation.z = 0.6;
      }
      // A pitched roof: a triangular prism, snow on both slopes and the ridge.
      const roof = w.mesh(new T.CylinderGeometry(wdt * 0.62, wdt * 0.62, d * 1.08, 3, 1), roofMat, g);
      roof.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      roof.position.y = h + wdt * 0.28;
      roof.scale.set(1, 1, 0.75);
      for (const s of [-1, 1]) {
        const slab = w.box(g, [wdt * 0.62, 0.05, d * 1.1], [s * wdt * 0.26, h + wdt * 0.33, 0], snow);
        slab.rotation.z = -s * 0.68;
      }
      w.box(g, [0.06, 0.06, d * 1.12], [0, h + wdt * 0.55, 0], snow);
      // Windows: lit panes in white frames, shutters both sides, snow on the sills; a door with a step.
      const floors = Math.max(1, Math.round(h / 0.32));
      for (let i = 0; i < 2; i += 1) for (let j = 0; j < floors; j += 1) {
        const wx = (i - 0.5) * wdt * 0.45, wy = 0.24 + j * 0.3;
        if (j === 0 && Math.abs(wx) < wdt * 0.15) continue;
        w.box(g, [wdt * 0.2, 0.15, 0.012], [wx, wy, d / 2 + 0.003], frameMat);
        const pane = w.box(g, [wdt * 0.15, 0.11, 0.02], [wx, wy, d / 2 + 0.006], windowMat);
        pane.castShadow = false;
        w.box(g, [0.01, 0.11, 0.022], [wx, wy, d / 2 + 0.008], frameMat);
        const sh = new T.MeshStandardMaterial({ color: shutterCols[(((i + j + Math.round(x * 10)) % shutterCols.length) + shutterCols.length) % shutterCols.length], roughness: 0.7 });
        for (const s of [-1, 1]) w.box(g, [wdt * 0.07, 0.13, 0.012], [wx + s * wdt * 0.14, wy, d / 2 + 0.005], sh);
        w.box(g, [wdt * 0.22, 0.025, 0.05], [wx, wy - 0.075, d / 2 + 0.02], snow);
      }
      w.box(g, [wdt * 0.2, 0.22, 0.02], [0, 0.11, d / 2 + 0.006], beamMat);
      w.box(g, [wdt * 0.28, 0.035, 0.08], [0, 0.02, d / 2 + 0.04], snow);
      // A chimney, snow-capped (smoke rises from it, see below).
      w.box(g, [0.08, 0.2, 0.08], [wdt * 0.2, h + wdt * 0.42, -d * 0.2], new T.MeshStandardMaterial({ color: '#6a3a2a' }));
      chimneys.push({ g, at: v(wdt * 0.2, h + wdt * 0.56, -d * 0.2) });
      w.box(g, [0.1, 0.03, 0.1], [wdt * 0.2, h + wdt * 0.53, -d * 0.2], snow);
      roofs.push({ x, z, hw: wdt * 0.62, hd: d * 0.55, rot, top: h + wdt * 0.5 + 0.06 });
      return g;
    };
    house(-1.15, 0.45, 0.62, 0.62, 0.5, 0.35, facades[0], true);
    house(-0.55, 1.05, 0.5, 0.48, 0.44, 0.1, facades[1]);
    house(0.55, 1.15, 0.56, 0.7, 0.46, -0.15, facades[2]);
    house(1.25, 0.25, 0.6, 0.55, 0.5, -0.5, facades[3]);
    house(-1.5, -0.45, 0.5, 0.52, 0.46, 0.9, facades[4], true);
    house(1.45, -0.5, 0.52, 0.6, 0.44, -0.9, facades[5]);
    house(-0.8, -1.05, 0.46, 0.44, 0.4, 0.5, facades[6]);
    house(0.85, -1.1, 0.48, 0.5, 0.42, -0.5, facades[7]);
    // The church: a white nave, a tall tower with a green copper spire and a golden ball, lit windows.
    const church = group(town, 0, ground + 0.06, -0.45);
    w.box(church, [0.7, 0.7, 0.9], [0, 0.35, 0.25], new T.MeshStandardMaterial({ color: '#efe6d6', roughness: 0.7 }));
    const nave = w.mesh(new T.CylinderGeometry(0.47, 0.47, 0.95, 3, 1), roofMat, church);
    nave.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    nave.position.set(0, 0.85, 0.25);
    nave.scale.set(1, 1, 0.75);
    w.box(church, [0.34, 1.35, 0.34], [0, 0.68, -0.35], new T.MeshStandardMaterial({ color: '#f3ecdf', roughness: 0.7 }));
    const copper = new T.MeshStandardMaterial({ color: '#4f8f7a', roughness: 0.45, metalness: 0.35 });
    w.mesh(new T.CylinderGeometry(0.12, 0.24, 0.2, 8), copper, church).position.set(0, 1.45, -0.35);
    w.mesh(new T.SphereGeometry(0.14, 16, 12), copper, church).position.set(0, 1.62, -0.35);
    w.mesh(new T.ConeGeometry(0.12, 0.85, 8), copper, church).position.set(0, 2.1, -0.35);
    w.sphere(church, 0.04, [0, 2.56, -0.35], brass);
    for (const y of [1.05, 0.7]) w.box(church, [0.1, 0.16, 0.02], [0, y, -0.17], windowMat).castShadow = false;
    for (const x of [-0.36, 0.36]) for (const z of [0.05, 0.45]) w.box(church, [0.02, 0.22, 0.1], [x, 0.38, z], windowMat).castShadow = false;
    // The clock face on the tower.
    w.mesh(new T.CircleGeometry(0.08, 24), frameMat, church).position.set(0, 1.22, -0.17);
    roofs.push({ x: 0, z: -0.2, hw: 0.38, hd: 0.5, rot: 0, top: 1.18 });
    // The square's Christmas tree, in lights, a star on top.
    const xmas = group(town, 0.05, ground + 0.09, 0.45);
    const fir = new T.MeshStandardMaterial({ color: '#1f4a34', roughness: 0.8 });
    for (let i = 0; i < 4; i += 1) w.mesh(new T.ConeGeometry(0.26 - i * 0.05, 0.3, 10), fir, xmas).position.y = 0.18 + i * 0.16;
    const bulbCols = ['#ff5a5a', '#ffd24a', '#5ab8ff', '#7aff9a', '#ff9ad4'];
    const bulbs: T.Mesh[] = [];
    for (let k = 0; k < 26; k += 1) {
      const t = k / 26, a = t * TAU * 3.2, r = 0.24 * (1 - t * 0.8);
      const b = w.sphere(xmas, 0.018, [Math.sin(a) * r, 0.12 + t * 0.6, Math.cos(a) * r], w.glow(bulbCols[k % bulbCols.length], 2.5));
      b.castShadow = false;
      bulbs.push(b);
    }
    w.mesh(new T.OctahedronGeometry(0.05, 0), w.glow('#ffe27a', 3), xmas).position.y = 0.83;
    // Firs with snow round the edge, lamp posts, a little fence.
    for (let k = 0; k < 16; k += 1) {
      const a = (k / 16) * TAU + c.rand() * 0.25, r = 1.72 + c.rand() * 0.32;
      const t = group(town, Math.sin(a) * r, ground + 0.06, Math.cos(a) * r);
      const h = 0.45 + c.rand() * 0.5;
      for (let i = 0; i < 3; i += 1) {
        w.mesh(new T.ConeGeometry(h * (0.32 - i * 0.07), h * 0.45, 8), fir, t).position.y = h * (0.25 + i * 0.22);
        w.mesh(new T.ConeGeometry(h * (0.2 - i * 0.04), h * 0.16, 8), snow, t).position.y = h * (0.42 + i * 0.22);
      }
    }
    const lampHead = w.glow('#ffd38a', 3);
    const post = new T.MeshStandardMaterial({ color: '#22262c', metalness: 0.6, roughness: 0.4 });
    for (const [x, z] of [[-0.45, 0.55], [0.6, 0.6], [-0.95, -0.1], [0.75, -0.2]]) {
      w.beam(town, v(x, ground + 0.06, z), v(x, ground + 0.62, z), 0.015, post);
      w.sphere(town, 0.05, [x, ground + 0.66, z], lampHead).castShadow = false;
      w.box(town, [0.08, 0.02, 0.08], [x, ground + 0.715, z], snow);
    }
    const fence = new T.MeshStandardMaterial({ color: '#6a4a2a', roughness: 0.8 });
    for (let k = 0; k < 9; k += 1) {
      const a = 2.0 + k * 0.09;
      w.box(town, [0.02, 0.12, 0.02], [Math.sin(a) * 1.55, ground + 0.12, Math.cos(a) * 1.55], fence);
    }
    w.tube(town, Array.from({ length: 9 }, (_, k) => v(Math.sin(2.0 + k * 0.09) * 1.55, ground + 0.15, Math.cos(2.0 + k * 0.09) * 1.55)), fence, 0.01);
    bake(drifts);
    // People in hats walking round the square, and a skater on the pond.
    const person = (coat: string, hat: string) => {
      const p = group(town);
      w.mesh(new T.CapsuleGeometry(0.035, 0.07, 4, 8), new T.MeshStandardMaterial({ color: coat, roughness: 0.8 }), p).position.y = 0.075;
      w.sphere(p, 0.028, [0, 0.16, 0], new T.MeshStandardMaterial({ color: '#e8c0a0', roughness: 0.6 }));
      w.mesh(new T.ConeGeometry(0.03, 0.05, 10), new T.MeshStandardMaterial({ color: hat, roughness: 0.8 }), p).position.y = 0.2;
      return p;
    };
    const walkers = [person('#8a2a2a', '#e8e0d0'), person('#2a4a7a', '#c83a3a'), person('#3a5a3a', '#e8c040')];
    const skater = person('#c84a6a', '#ffffff');
    // A warm light inside the town (windows and lamps).
    const inner = new T.PointLight('#ffb870', 6, 5, 1.5);
    inner.position.set(0, ground + 0.9, 0.4);
    globe.add(inner);

    // ---- the glass: thin (little distortion), writes no depth; it refracts the town and the flakes behind its front.
    const glass = new T.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0, transmission: 1, thickness: 0.06, ior: 1.3, clearcoat: 0.6, clearcoatRoughness: 0.04, specularIntensity: 0.5, envMapIntensity: 0.22, depthWrite: false });
    const sphere = w.mesh(new T.SphereGeometry(R, 96, 64), glass, globe);
    sphere.position.y = cy;
    sphere.castShadow = false;
    sphere.receiveShadow = false;
    // The liquid inside: a faint blue body just within the glass (back faces only, so it tints what is behind the town
    // without veiling the front), and a small air bubble caught at the top.
    const liquid = w.mesh(new T.SphereGeometry(R * 0.985, 64, 40), new T.MeshStandardMaterial({ color: '#a9d4ec', transparent: true, opacity: 0.1, side: T.BackSide, depthWrite: false, roughness: 0.2 }), globe);
    liquid.position.y = cy; liquid.castShadow = false;
    const bubble = w.mesh(new T.SphereGeometry(0.16, 24, 16), new T.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, roughness: 0, thickness: 0.05, ior: 1.0, transparent: true, opacity: 0.6, depthWrite: false }), globe);
    bubble.scale.set(1.4, 0.55, 1.4); bubble.castShadow = false;
    // Reflections of a window on the glass: two soft curved panes, high left and a thin one on the right.
    const reflCanvas = document.createElement('canvas'); reflCanvas.width = 128; reflCanvas.height = 256;
    {
      const g = reflCanvas.getContext('2d')!;
      for (const [x, y, ww, hh] of [[8, 10, 52, 110], [68, 10, 52, 110], [8, 130, 52, 110], [68, 130, 52, 110]]) {
        const gr = g.createLinearGradient(x, y, x + ww, y + hh); gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,.12)');
        g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, ww, hh, 10); g.fill();
      }
    }
    const reflTex = w.ownTexture(new T.CanvasTexture(reflCanvas));
    const reflMat = new T.MeshBasicMaterial({ map: reflTex, transparent: true, opacity: 0.32, depthWrite: false, blending: T.AdditiveBlending, fog: false });
    for (const [phi0, phiLen, th0, thLen, op] of [[Math.PI * 0.62, 0.42, 0.34, 0.5, 0.32], [Math.PI * 1.32, 0.16, 0.5, 0.55, 0.18]] as const) {
      const m = reflMat.clone(); m.opacity = op;
      const pane = w.mesh(new T.SphereGeometry(R * 1.004, 24, 24, phi0, phiLen, th0, thLen), m, globe);
      pane.position.y = cy; pane.castShadow = false; pane.renderOrder = 3;
    }
    // A warm pool of light on the table from inside the globe.
    const poolCanvas = document.createElement('canvas'); poolCanvas.width = poolCanvas.height = 128;
    {
      const g = poolCanvas.getContext('2d')!, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,190,120,.55)'); gr.addColorStop(.5, 'rgba(255,170,100,.18)'); gr.addColorStop(1, 'rgba(255,170,100,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    const pool = w.mesh(new T.PlaneGeometry(9, 9), new T.MeshBasicMaterial({ map: w.ownTexture(new T.CanvasTexture(poolCanvas)), transparent: true, depthWrite: false, blending: T.AdditiveBlending }), w.root);
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.005; pool.castShadow = false;
    // Smoke from the chimneys: soft puffs rising and fading (in the town's frame, so they turn with it).
    const smokeCanvas = document.createElement('canvas'); smokeCanvas.width = smokeCanvas.height = 64;
    {
      const g = smokeCanvas.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(235,238,245,.8)'); gr.addColorStop(1, 'rgba(235,238,245,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
    const smokeTex = w.ownTexture(new T.CanvasTexture(smokeCanvas));
    const puffs = chimneys.flatMap(({ g, at }, ci) => Array.from({ length: 4 }, (_, k) => {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
      g.add(sp); return { sp, at, phase: k / 4 + ci * 0.13 };
    }));

    // ---- the particles: snow (star flakes, matte) and glitter (metal hexagons), both flat and tumbling.
    const flakeCanvas = document.createElement('canvas');
    flakeCanvas.width = flakeCanvas.height = 64;
    {
      const g = flakeCanvas.getContext('2d')!;
      g.translate(32, 32);
      g.strokeStyle = '#fff';
      g.lineCap = 'round';
      for (let k = 0; k < 6; k += 1) {
        g.save();
        g.rotate((k / 6) * TAU);
        g.lineWidth = 5;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -28); g.stroke();
        g.lineWidth = 3.5;
        for (const y of [-12, -20]) { g.beginPath(); g.moveTo(0, y); g.lineTo(-7, y - 7); g.moveTo(0, y); g.lineTo(7, y - 7); g.stroke(); }
        g.restore();
      }
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill();
    }
    const flakeTex = w.ownTexture(new T.CanvasTexture(flakeCanvas));
    const NS = w.mobile ? 320 : 720, NG = w.mobile ? 80 : 180, N = NS + NG;
    const snowMesh = new T.InstancedMesh(new T.PlaneGeometry(1, 1), new T.MeshStandardMaterial({ map: flakeTex, alphaTest: 0.4, side: T.DoubleSide, roughness: 0.7, emissive: '#2a3448', emissiveIntensity: 0.6 }), NS);
    const glitterMesh = new T.InstancedMesh(new T.CircleGeometry(0.5, 6), new T.MeshStandardMaterial({ side: T.DoubleSide, metalness: 1, roughness: 0.12, envMapIntensity: 2.2 }), NG);
    const glitterCols = ['#ffd27a', '#f0f4ff', '#b8e0ff', '#ffb8e0', '#c8ffd8'];
    for (let i = 0; i < NG; i += 1) glitterMesh.setColorAt(i, new T.Color(glitterCols[i % glitterCols.length]));
    for (const m of [snowMesh, glitterMesh]) {
      m.position.y = cy;
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false;
      globe.add(m);
    }
    // State per particle (in the sphere's frame, relative to its centre).
    const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), size = new Float32Array(N);
    const settle = new Float32Array(N), tau = new Float32Array(N), rest = new Uint8Array(N);
    const quats = Array.from({ length: N }, () => new T.Quaternion());
    const spinAxis = Array.from({ length: N }, () => new T.Vector3(c.rand() - 0.5, c.rand() - 0.5, c.rand() - 0.5).normalize());
    const flutter = new Float32Array(N);
    const groundY = ground + 0.1 - cy;
    for (let i = 0; i < N; i += 1) {
      const glitter = i >= NS;
      size[i] = glitter ? 0.035 + c.rand() * 0.025 : 0.05 + c.rand() * 0.06;
      // Stokes settling grows with size; glitter is denser (metal foil) and sinks a little faster.
      settle[i] = ((glitter ? 0.16 : 0.07) + size[i] * (glitter ? 1.2 : 0.9) + c.rand() * 0.03) * 0.55;
      tau[i] = (glitter ? 0.35 : 0.22) + size[i] * 3;
      flutter[i] = c.rand() * TAU;
      const a = c.rand() * TAU, r = Math.sqrt(c.rand()) * (R - 0.3);
      pos[i * 3] = Math.sin(a) * r;
      pos[i * 3 + 1] = groundY;
      pos[i * 3 + 2] = Math.cos(a) * r;
      rest[i] = 1;
      quats[i].setFromAxisAngle(v(1, 0, 0), -Math.PI / 2);
    }

    // ---- the liquid: a decaying swirl (ω about y), the secondary circulation, a slosh and turbulence.
    const fluid = { omega: 0, slosh: new T.Vector3(), turb: 0 };
    const u = new T.Vector3();
    const flowAt = (x: number, y: number, z: number, t: number, out: T.Vector3) => {
      const rr = (x * x + z * z) / (R * R);
      out.set(-fluid.omega * z, 0, fluid.omega * x);
      // Spin drives a meridional circulation: up the middle, out at the top, down along the glass.
      const sec = Math.abs(fluid.omega) * 0.35;
      out.y += sec * (1 - 2.2 * rr);
      const rad = Math.sqrt(x * x + z * z) || 1;
      out.x += (x / rad) * sec * 0.5 * (y / R);
      out.z += (z / rad) * sec * 0.5 * (y / R);
      out.add(fluid.slosh);
      // Turbulence: a few rotating cells (curl of a smooth field), fading with the rest.
      const A = fluid.turb;
      if (A > 1e-3) {
        out.x += A * (Math.sin(y * 2.3 + t * 1.7) * Math.cos(z * 1.9 - t));
        out.y += A * (Math.sin(z * 1.6 + t * 1.3) * Math.cos(x * 1.8 + t * 0.7) + 0.35 * Math.sin(y * 1.2 - t * 0.8)) * 1.1;
        out.z += A * (Math.sin(x * 2.2 - t * 1.1) * Math.cos(y * 2.0 + t * 0.9));
      }
      return out;
    };
    /** Height a resting flake lies at, at (x, z): a roof under it, else the ground. */
    const restHeight = (x: number, z: number) => {
      let top = groundY;
      for (const f of roofs) {
        const dx = x - f.x, dz = z - f.z;
        const lx = dx * Math.cos(f.rot) - dz * Math.sin(f.rot), lz = dx * Math.sin(f.rot) + dz * Math.cos(f.rot);
        if (Math.abs(lx) < f.hw && Math.abs(lz) < f.hd) {
          // A pitched roof: highest along the ridge.
          const h = ground + 0.06 + f.top * (1 - 0.55 * Math.abs(lx) / f.hw) - cy;
          top = Math.max(top, h);
        }
      }
      return top;
    };
    const shake = (power: number, dirX: number) => {
      // The glass moves; the liquid lags it: in the glass's frame it sloshes the other way and spins up.
      tilt.vz += -dirX * power * 2.2;
      tilt.vx += (c.rand() - 0.5) * power * 1.5;
      fluid.slosh.x += -dirX * power * 1.1;
      fluid.slosh.y += power * 0.6;
      fluid.omega += (dirX >= 0 ? 1 : -1) * power * (0.9 + c.rand() * 0.5);
      fluid.turb += power * 2.2;
      // The shake tears the snow off the ground: every flake is thrown into the mixing liquid.
      for (let i = 0; i < N; i += 1) {
        const k = i * 3;
        if (rest[i] && c.rand() > 0.35 + power * 0.5) continue;
        rest[i] = 0;
        vel[k] += (c.rand() - 0.5) * 2.2 * power - dirX * power * 0.6;
        vel[k + 1] += (0.8 + c.rand() * 2.6) * power;
        vel[k + 2] += (c.rand() - 0.5) * 2.2 * power;
      }
    };
    const tilt = { x: 0, z: 0, vx: 0, vz: 0 };
    // The music box: a click winds it (the key turns), the town turns slowly and runs down over half a minute.
    let wound = 0.4;
    let lastX = 0, lastY = 0, had = false;
    // The town wakes up with a shake, so the first look has snow in the water.
    shake(1.1, 0.4);

    const m4 = new T.Matrix4(), q = new T.Quaternion(), p3 = new T.Vector3(), s3 = new T.Vector3();
    const flat = new T.Quaternion().setFromAxisAngle(v(1, 0, 0), -Math.PI / 2);
    w.ticks.push((time, dt, p) => {
      const react = c.params.react;
      if (p.clicked && react > 0) { shake(1.5 * react, c.rand() - 0.5); wound = 1; }
      if (p.pressed && had && react > 0) {
        const dx = (p.rawX - lastX) / Math.max(1, c.width), dy = (p.rawY - lastY) / Math.max(1, c.height);
        const speed = Math.hypot(dx, dy) / Math.max(dt, 1e-3);
        if (speed > 0.4) shake(Math.min(1.2, speed * 0.12) * react, Math.sign(dx));
      }
      lastX = p.rawX; lastY = p.rawY; had = p.active;
      // The globe's rocking spring.
      tilt.vx += (-tilt.x * 26 - tilt.vx * 4.5) * dt;
      tilt.vz += (-tilt.z * 26 - tilt.vz * 4.5) * dt;
      tilt.x += tilt.vx * dt;
      tilt.z += tilt.vz * dt;
      globe.rotation.set(tilt.x * 0.12, Math.sin(time * 0.1) * 0.08 + w.pointer.x * 0.25 * react, tilt.z * 0.12);
      // Viscous decay: the swirl spins down over a few seconds, the slosh and the turbulence faster.
      fluid.omega *= Math.exp(-dt / 3.2);
      fluid.slosh.multiplyScalar(Math.exp(-dt / 0.9));
      fluid.turb *= Math.exp(-dt / 2.6);
      const lim = R - 0.14;
      for (let i = 0; i < N; i += 1) {
        const k = i * 3;
        const x = pos[k], y = pos[k + 1], z = pos[k + 2];
        flowAt(x, y, z, time, u);
        const flow = u.length();
        if (rest[i]) {
          // Lifted again only by a strong flow over it.
          if (flow > 0.55 + settle[i]) { rest[i] = 0; vel[k] = u.x; vel[k + 1] = u.y + 0.2; vel[k + 2] = u.z; }
          else continue;
        }
        // The flake relaxes to the flow plus its own settling (it lags the liquid by its response time).
        const a = Math.min(1, dt / (tau[i] * (fluid.turb > 0.6 ? 1.6 : 1)));
        const sway = Math.sin(time * 2.2 + flutter[i]) * settle[i] * 0.35;
        vel[k] += (u.x + sway - vel[k]) * a;
        vel[k + 1] += (u.y - settle[i] - vel[k + 1]) * a;
        vel[k + 2] += (u.z + Math.cos(time * 1.9 + flutter[i]) * settle[i] * 0.35 - vel[k + 2]) * a;
        pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
        // The glass: kept inside, sliding along it.
        const d = Math.hypot(pos[k], pos[k + 1], pos[k + 2]);
        if (d > lim) {
          const s = lim / d;
          pos[k] *= s; pos[k + 1] *= s; pos[k + 2] *= s;
          const nx = pos[k] / lim, ny = pos[k + 1] / lim, nz = pos[k + 2] / lim;
          const vn = vel[k] * nx + vel[k + 1] * ny + vel[k + 2] * nz;
          if (vn > 0) { vel[k] -= vn * nx; vel[k + 1] -= vn * ny; vel[k + 2] -= vn * nz; }
        }
        // Tumbling: faster in faster flow; fluttering as it sinks.
        const spin = (0.6 + flow * 5 + settle[i] * 3) * dt;
        q.setFromAxisAngle(spinAxis[i], spin);
        quats[i].multiply(q);
        // Landing: on a roof or the ground, lying flat (the flow there too weak to carry it).
        const floor = restHeight(pos[k], pos[k + 2]);
        if (pos[k + 1] < floor) {
          pos[k + 1] = floor + 0.004;
          if (flow < 0.35 + settle[i]) {
            rest[i] = 1;
            vel[k] = vel[k + 1] = vel[k + 2] = 0;
            quats[i].copy(flat).multiply(q.setFromAxisAngle(v(0, 0, 1), flutter[i]));
          } else vel[k + 1] = Math.abs(vel[k + 1]) * 0.15;
        }
      }
      // The instance matrices.
      for (let i = 0; i < N; i += 1) {
        const k = i * 3;
        p3.set(pos[k], pos[k + 1], pos[k + 2]);
        s3.setScalar(size[i]);
        m4.compose(p3, quats[i], s3);
        if (i < NS) snowMesh.setMatrixAt(i, m4);
        else glitterMesh.setMatrixAt(i - NS, m4);
      }
      snowMesh.instanceMatrix.needsUpdate = true;
      glitterMesh.instanceMatrix.needsUpdate = true;
      // People stroll round the square; the skater glides round the pond.
      walkers.forEach((wk, k) => {
        const a = time * 0.12 + (k / walkers.length) * TAU;
        wk.position.set(0.05 + Math.sin(a) * 0.82, ground + 0.08, 0.45 + Math.cos(a) * 0.55);
        wk.rotation.y = a + Math.PI / 2;
        wk.position.y += Math.abs(Math.sin(time * 6 + k)) * 0.008;
      });
      const sa = time * 0.6;
      skater.position.set(1.2 + Math.sin(sa) * 0.3, ground + 0.09, 0.95 + Math.cos(sa) * 0.18);
      skater.rotation.set(0, sa + Math.PI / 2, Math.sin(sa * 2) * 0.15);
      bulbs.forEach((b, k) => { b.visible = Math.sin(time * 2 + k * 1.7) > -0.6; });
      wound = Math.max(0, wound - dt / 30);
      town.rotation.y += dt * 0.35 * wound;
      key.rotation.z += dt * 2.5 * wound;
      for (const pf of puffs) {
        const u = (time * 0.18 + pf.phase) % 1;
        pf.sp.position.set(pf.at.x + Math.sin(time + pf.phase * 9) * 0.04 * u, pf.at.y + u * 0.55, pf.at.z);
        pf.sp.scale.setScalar(0.06 + u * 0.14);
        pf.sp.material.opacity = 0.28 * Math.sin(u * Math.PI);
      }
      bubble.position.set(Math.sin(tilt.z * 4) * 0.4, cy + R * 0.86, Math.sin(tilt.x * 4) * 0.4);
      windowMat.emissiveIntensity = 2 + 0.2 * Math.sin(time * 2.3);
      inner.intensity = 6 * (0.9 + 0.1 * Math.sin(time * 3.7));
    });
    return w;
  },
};
