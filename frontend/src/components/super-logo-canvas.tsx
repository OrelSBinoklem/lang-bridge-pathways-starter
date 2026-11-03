'use client';

import { useEffect, useRef } from 'react';
import styles from '@/components/super-logo.module.css';

type SkyPayload = {
  rgb: string;
  arr: string;
  bright: boolean;
  rgba0: string;
  rgba1: string;
};

function getSkyColor(angle: number): SkyPayload {
  const night = { r: 29, g: 34, b: 53 };
  const day = { r: 208, g: 224, b: 240 };
  const evening = { r: 139, g: 69, b: 19 };

  const lerp = (a: typeof night, b: typeof night, t: number) => ({
    r: Math.round(a.r + t * (b.r - a.r)),
    g: Math.round(a.g + t * (b.g - a.g)),
    b: Math.round(a.b + t * (b.b - a.b)),
  });

  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  let c = night;
  if (a < Math.PI / 2) c = lerp(night, day, a / (Math.PI / 2));
  else if (a < Math.PI) c = lerp(day, evening, (a - Math.PI / 2) / (Math.PI / 2));
  else if (a < (3 * Math.PI) / 2) c = lerp(evening, night, (a - Math.PI) / (Math.PI / 2));

  return {
    rgb: `rgb(${c.r}, ${c.g}, ${c.b})`,
    arr: `${c.r},${c.g},${c.b}`,
    rgba0: `rgba(${c.r}, ${c.g}, ${c.b}, 0)`,
    rgba1: `rgba(${c.r}, ${c.g}, ${c.b}, 1)`,
    bright: a >= Math.PI / 4 && a < (Math.PI * 3) / 4,
  };
}

/** Один источник цвета для хедера и боковых градиентов лого */
function applySkyVars(sky: Pick<SkyPayload, 'rgb' | 'rgba0' | 'rgba1'>) {
  const root = document.documentElement;
  root.style.setProperty('--lbp-sky', sky.rgb);
  root.style.setProperty('--lbp-sky-a0', sky.rgba0);
  root.style.setProperty('--lbp-sky-a1', sky.rgba1);
}

function makeFallbackNormals(THREE: typeof import('three')) {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    data[o] = 128;
    data[o + 1] = 128;
    data[o + 2] = 255;
    data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function addSunGlow(THREE: typeof import('three'), sun: import('three').Mesh) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,0,0.55)');
  g.addColorStop(0.45, 'rgba(255,220,80,0.25)');
  g.addColorStop(1, 'rgba(255,255,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(30, 30, 1);
  sun.add(sprite);
}

let mountSeq = 0;

export function SuperLogoCanvas({
  onSkyChange,
}: {
  onSkyChange?: (sky: SkyPayload) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSkyChangeRef = useRef(onSkyChange);
  onSkyChangeRef.current = onSkyChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const myMount = ++mountSeq;
    let cancelled = false;
    let raf = 0;
    let renderer: import('three').WebGLRenderer | null = null;
    let waterNormals: import('three').Texture | null = null;
    let removeVisibility: (() => void) | null = null;
    let destroyGui: (() => void) | null = null;

    const alive = () => !cancelled && myMount === mountSeq && hostRef.current === host;

    const cookie = document.cookie.match(/(?:^|; )skyColor=([^;]+)/);
    const initialArr = cookie?.[1] ? decodeURIComponent(cookie[1]) : '29,34,53';
    const [ir, ig, ib] = initialArr.split(',').map((n) => Number(n) || 0);
    applySkyVars({
      rgb: `rgb(${ir}, ${ig}, ${ib})`,
      rgba0: `rgba(${ir}, ${ig}, ${ib}, 0)`,
      rgba1: `rgba(${ir}, ${ig}, ${ib}, 1)`,
    });

    const boot = async () => {
      try {
        const THREE = await import('three');
        const { Water } = await import('three/examples/jsm/objects/Water.js');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        const { GUI } = await import('dat.gui');
        if (!alive()) return;

        const width = 300;
        const height = 100;

        const params = {
          speed: 1,
          developerMode: false,
          waveHeight: 1,
          waveSpeed: 0.5,
          dayWaterColor: 0xd3fbfb,
          nightWaterColor: 0x446688,
          sunIntensity: 1,
          moonIntensity: 0.5,
        };
        let startTime = Date.now();

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 1, 2000);
        camera.position.set(0, 5, 60);

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0);

        if (!alive()) {
          renderer.dispose();
          renderer = null;
          return;
        }

        host.replaceChildren(renderer.domElement);
        const canvas = renderer.domElement;
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.opacity = '0';

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 0, 0);
        controls.enablePan = false;
        controls.enableZoom = false;
        controls.update();

        waterNormals = makeFallbackNormals(THREE);
        const water = new Water(new THREE.PlaneGeometry(800, 200), {
          textureWidth: 512,
          textureHeight: 512,
          waterNormals: waterNormals as import('three').DataTexture,
          alpha: 1.0,
          sunDirection: new THREE.Vector3(0.707, 0.707, 0),
          sunColor: 0xffffff,
          waterColor: new THREE.Color(params.dayWaterColor),
          distortionScale: params.waveHeight,
          fog: false,
        });
        water.rotation.x = -Math.PI / 2;
        scene.add(water);
        const material = water.material as import('three').ShaderMaterial;

        new THREE.TextureLoader().load(
          '/textures/waternormals.jpg',
          (texture) => {
            if (!alive()) {
              texture.dispose();
              return;
            }
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            material.uniforms.normalSampler.value = texture;
            waterNormals?.dispose();
            waterNormals = texture;
          },
          undefined,
          () => undefined,
        );

        const sun = new THREE.Mesh(
          new THREE.SphereGeometry(5, 32, 32),
          new THREE.MeshBasicMaterial({ color: 0xffff00 }),
        );
        addSunGlow(THREE, sun);
        scene.add(sun);

        const moon = new THREE.Mesh(
          new THREE.SphereGeometry(5, 32, 32),
          new THREE.MeshBasicMaterial({ color: 0xdddddd }),
        );
        scene.add(moon);

        const sunLight = new THREE.DirectionalLight(0xffffff, params.sunIntensity);
        const moonLight = new THREE.DirectionalLight(0xaaaaaa, params.moonIntensity);
        scene.add(sunLight, moonLight, new THREE.AmbientLight(0x404040));

        const dayColor = new THREE.Color(params.dayWaterColor);
        const nightColor = new THREE.Color(params.nightWaterColor);
        let lastSky = '';
        let lastFrame = 0;
        let active = !document.hidden;

        const gui = new GUI({ closed: false });
        const controlsFolder = gui.addFolder('Controls');
        controlsFolder
          .add(params, 'developerMode')
          .name('Developer Mode')
          .onChange(() => {
            startTime = Date.now();
          });
        controlsFolder.add(params, 'speed', 0.1, 10, 0.1).name('Speed');
        controlsFolder
          .add(params, 'waveHeight', 1, 500, 1)
          .name('Wave Height')
          .onChange((value: number) => {
            material.uniforms.distortionScale.value = value;
          });
        controlsFolder.add(params, 'waveSpeed', 0.1, 5, 0.1).name('Wave Speed');
        controlsFolder.open();
        destroyGui = () => {
          gui.destroy();
        };

        canvas.style.opacity = '1';

        const tickScene = () => {
          const elapsed = (Date.now() - startTime) / 1000;
          const now = new Date();
          const hours = now.getHours() + now.getMinutes() / 60;
          const angle = params.developerMode
            ? elapsed * params.speed
            : (hours / 24) * 2 * Math.PI - Math.PI / 2;
          const sunX = 75 * Math.cos(angle);
          const sunY = 28 * Math.sin(angle);
          sun.position.set(sunX, sunY, 0);
          moon.position.set(-sunX, -sunY, 0);
          sunLight.position.copy(sun.position);
          moonLight.position.copy(moon.position);

          const blend = (Math.sin(angle) + 1) / 2;
          material.uniforms.waterColor.value.lerpColors(dayColor, nightColor, 1 - blend);
          material.uniforms.sunColor.value.setScalar(blend);
          material.uniforms.sunDirection.value.copy(sunLight.position).normalize();
          material.uniforms.distortionScale.value = params.waveHeight;
          material.uniforms.time.value += params.waveSpeed / 60;
          sunLight.intensity = blend * params.sunIntensity;
          moonLight.intensity = (1 - blend) * params.moonIntensity;

          controls.update();
          renderer?.render(scene, camera);

          const sky = getSkyColor(angle);
          applySkyVars(sky);

          if (lastSky !== sky.rgb) {
            lastSky = sky.rgb;
            onSkyChangeRef.current?.(sky);
            document.cookie = `skyColor=${sky.arr}; path=/; max-age=3600; SameSite=Lax`;
            document.cookie = `isBright=${sky.bright}; path=/; max-age=3600; SameSite=Lax`;
          }
        };

        const animate = (timestamp: number) => {
          if (!alive()) return;
          raf = requestAnimationFrame(animate);
          if (!active) return;
          if (timestamp - lastFrame < 1000 / 60) return;
          lastFrame = timestamp;
          try {
            tickScene();
          } catch (error) {
            console.error('[SuperLogo] frame error:', error);
            cancelled = true;
          }
        };

        const onVisibility = () => {
          active = !document.hidden;
          if (active) lastFrame = 0;
        };
        document.addEventListener('visibilitychange', onVisibility);
        removeVisibility = () => document.removeEventListener('visibilitychange', onVisibility);

        tickScene();
        raf = requestAnimationFrame(animate);
      } catch (error) {
        console.error('[SuperLogo] WebGL init failed:', error);
      }
    };

    void boot();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      removeVisibility?.();
      destroyGui?.();
      destroyGui = null;
      waterNormals?.dispose();
      waterNormals = null;
      renderer?.dispose();
      renderer = null;
      if (hostRef.current === host) host.replaceChildren();
    };
  }, []);

  return (
    <div id="super-logo-bg" className={styles.bg}>
      <div ref={hostRef} className={styles.canvasHost} />
      <div className={`${styles.gradient} ${styles.gradientTop}`} />
      <div className={`${styles.gradient} ${styles.gradientBottom}`} />
      <div className={`${styles.gradient} ${styles.gradientLeft}`} />
      <div className={`${styles.gradient} ${styles.gradientRight}`} />
    </div>
  );
}
