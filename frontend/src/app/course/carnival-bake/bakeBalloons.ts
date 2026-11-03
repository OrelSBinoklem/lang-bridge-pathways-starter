import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PARK_COLORS } from '@/features/course/effects/scenes/carnivalVideo';

/** Seven original physical-latex materials rendered once; runtime needs no 3D renderer. */
export async function bakeBalloonAtlas() {
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(256, 384); renderer.setClearColor(0, 0); renderer.toneMapping = T.ACESFilmicToneMapping;
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 768;
  const g = canvas.getContext('2d')!;
  const scene = new T.Scene(), camera = new T.OrthographicCamera(-1.2, 1.2, 1.8, -1.8, .1, 10); camera.position.z = 6;
  const room = new RoomEnvironment(), pmrem = new T.PMREMGenerator(renderer), environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  scene.add(new T.HemisphereLight('#cbe4ff', '#453042', 2));
  const key = new T.DirectionalLight('#fff1db', 3.2); key.position.set(-3, 5, 4); scene.add(key);
  const rim = new T.DirectionalLight('#99c5ff', 2); rim.position.set(4, 1, -2); scene.add(rim);
  const points = Array.from({ length: 49 }, (_, i) => { const a = i / 48 * Math.PI; return new T.Vector2(Math.sin(a) * (.82 + .2 * Math.sin(a / 2)), -Math.cos(a) * 1.25); });
  const geometry = new T.LatheGeometry(points, 64), knotGeometry = new T.ConeGeometry(.055, .11, 20);
  const material = new T.MeshPhysicalMaterial({ metalness: .02, roughness: .26, clearcoat: 1, clearcoatRoughness: .12, sheen: .35, sheenRoughness: .4 });
  scene.add(new T.Mesh(geometry, material));
  const knot = new T.Mesh(knotGeometry, material); knot.position.y = -1.31; knot.rotation.z = Math.PI; scene.add(knot);
  try {
    for (let i = 0; i < PARK_COLORS.length; i++) { material.color.set(PARK_COLORS[i]); renderer.render(scene, camera); g.drawImage(renderer.domElement, i % 4 * 256, Math.floor(i / 4) * 384); }
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png'));
    const result = await fetch('/api/dev/carnival-bake?side=balloons', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: blob });
    if (!result.ok) throw new Error(`Atlas save: ${result.status}`);
    return await result.text();
  } finally { geometry.dispose(); knotGeometry.dispose(); material.dispose(); environment.dispose(); room.dispose(); pmrem.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
}
