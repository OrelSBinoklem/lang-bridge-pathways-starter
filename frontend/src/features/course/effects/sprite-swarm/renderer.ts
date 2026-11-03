import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createVisibleAnimationLoop } from '../scenes/visibleAnimationLoop';
import type { SwarmSettings } from './presets';

const MAX_PARTICLES = 5000;

/** Port of the archive's sinusoidal point cloud; wave evaluation stays on the GPU. */
export function createSpriteSwarm(host: HTMLElement, settings: SwarmSettings) {
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setClearColor('#020207'); renderer.outputColorSpace = T.SRGBColorSpace;
  const canvas = renderer.domElement; canvas.setAttribute('aria-label', 'Объёмный рой частиц'); host.appendChild(canvas);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(75, 1, .1, 100);
  camera.position.set(0, 1.3, 5.5);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, -.15, 0);
  Object.assign(controls, { enableDamping: true, enablePan: true, minDistance: .6, maxDistance: 25, dampingFactor: .07 });
  controls.update(); controls.saveState();
  const geometry = new T.BufferGeometry(), positions = new Float32Array(MAX_PARTICLES * 3), colors = new Float32Array(MAX_PARTICLES * 3);
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3)); geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  const scramble = () => {
    for (let i = 0; i < MAX_PARTICLES * 3; i++) { positions[i] = (Math.random() - .5) * 10; colors[i] = .25 + Math.random() * .75; }
    geometry.attributes.position.needsUpdate = true; geometry.attributes.color.needsUpdate = true;
  };
  scramble();
  let texture: T.Texture = new T.DataTexture(new Uint8Array([255, 255, 255, 0]), 1, 1); texture.needsUpdate = true;
  const material = new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending,
    uniforms: { image: { value: texture }, time: { value: 0 }, amplitude: { value: 1 }, size: { value: .5 }, scale: { value: 1 }, colored: { value: 0 }, maxSize: { value: renderer.getContext().getParameter(renderer.getContext().ALIASED_POINT_SIZE_RANGE)[1] } },
    vertexShader: `attribute vec3 color; varying vec3 tint; uniform float time; uniform float amplitude; uniform float size; uniform float scale; uniform float maxSize;
      void main(){tint=color;vec3 p=position;p.y=sin(time+p.x)*amplitude;
      vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;
      gl_PointSize=clamp(size*scale/max(.1,-view.z),1.,maxSize);}`,
    fragmentShader: `uniform sampler2D image; uniform float colored; varying vec3 tint;
      void main(){vec4 pixel=texture2D(image,vec2(gl_PointCoord.x,1.-gl_PointCoord.y));
      float alpha=mix(pixel.g*pixel.a,pixel.a,colored);if(alpha<.006)discard;
      vec3 rgb=mix(tint*vec3(1.,.4,.75),pixel.rgb,colored);
      gl_FragColor=vec4(rgb,alpha);
      #include <colorspace_fragment>
      }`,
  });
  const points = new T.Points(geometry, material); points.frustumCulled = false; scene.add(points);
  let disposed = false, revision = 0, dirty = true, elapsed = 0;
  const loads = new AbortController();
  const changed = () => { dirty = true; }; controls.addEventListener('change', changed);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    const density = Math.min(2, window.devicePixelRatio || 1, Math.sqrt(2800000 / Math.max(1, width * height)));
    const w = Math.max(1, Math.round(width * density)), h = Math.max(1, Math.round(height * density));
    renderer.setSize(w, h, false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix();
    material.uniforms.scale.value = h * .5; dirty = true;
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const stop = createVisibleAnimationLoop(host, dt => {
    const moving = !settings.paused && !reduced.matches;
    if (moving) elapsed += dt * settings.speed;
    controls.update();
    const count = Math.max(100, Math.min(MAX_PARTICLES, Math.round(settings.count)));
    const changedSettings = geometry.drawRange.count !== count || material.uniforms.size.value !== settings.size || material.uniforms.amplitude.value !== settings.amplitude || material.uniforms.colored.value !== Number(settings.coloredImage);
    if (!moving && !dirty && !changedSettings) return;
    geometry.setDrawRange(0, count); material.uniforms.time.value = elapsed;
    material.uniforms.size.value = settings.size; material.uniforms.amplitude.value = settings.amplitude; material.uniforms.colored.value = Number(settings.coloredImage);
    renderer.render(scene, camera); dirty = false;
  });
  return {
    async setImage(source: Blob | string) {
      const request = ++revision;
      const blob = typeof source === 'string' ? await fetch(source, { signal: loads.signal }).then(response => {
        if (!response.ok) throw new Error(`Sprite asset unavailable (${response.status})`); return response.blob();
      }) : source;
      const bitmap = await createImageBitmap(blob);
      try {
        if (disposed || request !== revision) return false;
        // A square padded texture retains aspect ratio; no portrait stretching or per-frame image work.
        const edge = Math.max(32, Math.min(2048, Math.max(bitmap.width, bitmap.height)));
        const picture = document.createElement('canvas'); picture.width = picture.height = edge;
        const context = picture.getContext('2d'); if (!context) throw new Error('Image canvas unavailable');
        const fit = edge / Math.max(bitmap.width, bitmap.height), width = bitmap.width * fit, height = bitmap.height * fit;
        context.drawImage(bitmap, (edge - width) / 2, (edge - height) / 2, width, height);
        const next = new T.CanvasTexture(picture); next.colorSpace = T.SRGBColorSpace;
        next.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        texture.dispose(); texture = next; material.uniforms.image.value = texture; dirty = true;
        return true;
      } finally { bitmap.close(); }
    },
    resetCamera() { controls.reset(); dirty = true; },
    randomize() { scramble(); dirty = true; },
    dispose() {
      disposed = true; revision++; loads.abort(); stop(); observer.disconnect(); controls.removeEventListener('change', changed); controls.dispose();
      texture.dispose(); geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
export type SpriteSwarmController = ReturnType<typeof createSpriteSwarm>;
