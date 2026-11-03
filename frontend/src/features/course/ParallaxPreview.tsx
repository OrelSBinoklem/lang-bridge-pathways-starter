'use client';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import * as THREE from 'three';
import styles from './parallax-preview.module.css';

type Souvenir = {
  id: 'cat' | 'sprats' | 'amber' | 'monument';
  title: string;
  image: string;
};

type DepthMode = 'detailed' | 'volume' | 'soft';

const DEPTH_MODES: Record<DepthMode, { label: string; suffix: string }> = {
  detailed: { label: 'Детализированная', suffix: 'depth-v2.webp' },
  volume: { label: 'Объёмная', suffix: 'depth-v4-volume.webp' },
  soft: { label: 'Мягкая', suffix: 'depth-v3-smooth.webp' },
};

const SOUVENIRS: Souvenir[] = [
  { id: 'cat', title: 'Кошка на шпиле', image: '/course/effects/latvia-cat-v1.webp' },
  { id: 'sprats', title: 'Шпроты', image: '/course/effects/latvia-sprats-v1.webp' },
  { id: 'amber', title: 'Янтарь', image: '/course/effects/latvia-amber-v1.webp' },
  { id: 'monument', title: 'Памятник Свободы', image: '/course/effects/latvia-monument-v1.webp' },
];

const SOUVENIR_DEFAULTS: Record<Souvenir['id'], { strength: number; opacity: number; brightness: number }> = {
  cat: { strength: 0.07, opacity: 0.85, brightness: 2 },
  sprats: { strength: 0.5, opacity: 0.85, brightness: 2 },
  amber: { strength: 0.2, opacity: 0.85, brightness: 2 },
  monument: { strength: 0.07, opacity: 1, brightness: 2 },
};

function depthPath(souvenir: Souvenir, mode: DepthMode) {
  return `/course/effects/latvia-${souvenir.id}-${DEPTH_MODES[mode].suffix}`;
}

const VERTEX_SHADER = `
  uniform sampler2D uDepth;
  uniform float uStrength;
  uniform float uDepthBlend;
  varying vec2 vUv;

  float smoothDepth(vec2 uv) {
    const float radius = 0.005;
    float total = texture2D(uDepth, uv).r * 4.0;
    total += texture2D(uDepth, uv + vec2(radius, 0.0)).r;
    total += texture2D(uDepth, uv - vec2(radius, 0.0)).r;
    total += texture2D(uDepth, uv + vec2(0.0, radius)).r;
    total += texture2D(uDepth, uv - vec2(0.0, radius)).r;
    return total / 8.0;
  }

  void main() {
    vUv = uv;
    float depth = mix(0.5, smoothstep(0.1, 0.9, smoothDepth(uv)), uDepthBlend);
    float edgeDistance = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float edgeFade = smoothstep(0.0, 0.1, edgeDistance);
    vec3 displaced = position;
    displaced.z = (depth - 0.5) * uStrength * 3.4 * edgeFade;
    vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const FRAGMENT_SHADER = `
  uniform sampler2D uImage;
  uniform float uBrightness;
  varying vec2 vUv;
  void main() {
    vec4 color = texture2D(uImage, vUv);
    color.rgb *= uBrightness;
    gl_FragColor = color;
  }
`;

function ParallaxScene(props: { souvenir: Souvenir; depthMode: DepthMode; strength: number; opacity: number; brightness: number }) {
  const host = useRef<HTMLDivElement>(null);
  const update = useRef<((strength: number, opacity: number, brightness: number) => void) | null>(null);
  const [error, setError] = useState('');
  const imagePath = props.souvenir.image, depthUrl = depthPath(props.souvenir, props.depthMode);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    // A fresh canvas per mount: delayed disposal of an earlier React render must
    // never lose the context used by the next mount (including StrictMode).
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#101015');
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 30); camera.position.set(1.35, .28, 7.1);
    const controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { enablePan: false, minDistance: 5.5, maxDistance: 9, minPolarAngle: .72, maxPolarAngle: 2.42, rotateSpeed: .75 });
    controls.update();
    scene.add(new THREE.AmbientLight('#ffffff', .9));
    for (const [color, intensity, position] of [['#ffd59a', 18, [3, 4, 4]], ['#bc5d7d', 6, [-3, -2, 3]]] as const) {
      const light = new THREE.PointLight(color, intensity); light.position.set(position[0], position[1], position[2]); scene.add(light);
    }
    const uniforms = { uImage: { value: null as THREE.Texture | null }, uDepth: { value: null as THREE.Texture | null }, uStrength: { value: .07 }, uDepthBlend: { value: .85 }, uBrightness: { value: 2 } };
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER, side: THREE.DoubleSide, toneMapped: false });
    const geometry = new THREE.PlaneGeometry(4.8, 4.8, 192, 192);
    const artwork = new THREE.Mesh(geometry, material); artwork.visible = false; scene.add(artwork);
    const frameMaterial = new THREE.MeshPhysicalMaterial({ color: '#b98735', metalness: .88, roughness: .22, clearcoat: .7 });
    const frameGeometry = new THREE.BoxGeometry(5.02, .1, .1);
    for (let i = 0; i < 4; i++) {
      const frame = new THREE.Mesh(frameGeometry, frameMaterial);
      if (i < 2) frame.position.set(0, i ? -2.46 : 2.46, .82);
      else { frame.position.set(i === 2 ? 2.46 : -2.46, 0, .82); frame.rotation.z = Math.PI / 2; }
      scene.add(frame);
    }
    let disposed = false, raf = 0;
    const render = () => { raf = 0; if (!disposed && !renderer.getContext().isContextLost()) renderer.render(scene, camera); };
    const invalidate = () => { if (!disposed && !raf) raf = requestAnimationFrame(render); };
    update.current = (strength, opacity, brightness) => {
      uniforms.uStrength.value = strength; uniforms.uDepthBlend.value = opacity; uniforms.uBrightness.value = brightness; invalidate();
    };
    const resize = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      renderer.setSize(Math.max(1, width), Math.max(1, height)); camera.aspect = width / Math.max(1, height);
      const fit = 2.65 / Math.tan(17 * Math.PI / 180) / Math.min(1, camera.aspect) + 1;
      camera.position.normalize().multiplyScalar(fit); controls.minDistance = fit * .65; controls.maxDistance = fit * 1.8;
      camera.updateProjectionMatrix(); controls.update(); invalidate();
    });
    resize.observe(element); controls.addEventListener('change', invalidate);
    const loader = new THREE.TextureLoader(), textures: THREE.Texture[] = [];
    const load = (url: string, depth: boolean) => loader.load(url, texture => {
      if (disposed) { texture.dispose(); return; }
      texture.colorSpace = depth ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (depth) { texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false; }
      texture.needsUpdate = true;
      (depth ? uniforms.uDepth : uniforms.uImage).value = texture;
      artwork.visible = !!uniforms.uDepth.value && !!uniforms.uImage.value;
      if (artwork.visible) setError('');
      invalidate();
    }, undefined, cause => {
      if (!disposed) { console.error('[parallax-preview] Texture failed', url, cause); setError('Не удалось загрузить изображение или карту глубины.'); }
    });
    textures.push(load(imagePath, false), load(depthUrl, true));
    const lost = (event: Event) => { event.preventDefault(); if (!disposed) { console.error('[parallax-preview] WebGL context lost'); setError('Графический контекст потерян. Закройте и снова откройте эффект.'); } };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      disposed = true; update.current = null; cancelAnimationFrame(raf); resize.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      geometry.dispose(); material.dispose(); frameGeometry.dispose(); frameMaterial.dispose(); textures.forEach(t => t.dispose());
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [imagePath, depthUrl]);
  useEffect(() => { update.current?.(props.strength, props.opacity, props.brightness); }, [props.strength, props.opacity, props.brightness, imagePath, depthUrl]);
  return <div ref={host} className={styles.canvas}>{error && <p role="alert" className={styles.renderError}>{error}</p>}</div>;
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles.slider}>
      <span>{label}<output>{value.toFixed(2)}</output></span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onInput={(event) => onChange(Number(event.currentTarget.value))}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
      />
    </label>
  );
}

export function ParallaxPreview({ onExit }: { onExit?: () => void } = {}) {
  const [selected, setSelected] = useState<Souvenir>(SOUVENIRS[0]);
  const [depthMode, setDepthMode] = useState<DepthMode>('detailed');
  const [strength, setStrength] = useState(SOUVENIR_DEFAULTS.cat.strength);
  const [opacity, setOpacity] = useState(SOUVENIR_DEFAULTS.cat.opacity);
  const [brightness, setBrightness] = useState(SOUVENIR_DEFAULTS.cat.brightness);

  useEffect(() => {
    const previousTitle = document.title;
    return () => { document.title = previousTitle; };
  }, []);
  useEffect(() => {
    document.title = `Parallax: ${selected.title}`;
  }, [selected.title]);

  const selectSouvenir = (souvenir: Souvenir) => {
    const defaults = SOUVENIR_DEFAULTS[souvenir.id];
    setSelected(souvenir);
    setDepthMode('detailed');
    setStrength(defaults.strength);
    setOpacity(defaults.opacity);
    setBrightness(defaults.brightness);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>LAB / DEPTH MAP</p>
          <h1>Параллакс сувениров</h1>
        </div>
        {onExit ? <button type="button" className={styles.backButton} onClick={onExit} aria-label="К эффектам"><i className="pi pi-arrow-left" /> К эффектам</button> : <a href="/course">Вернуться к пути</a>}
      </header>

      <section className={styles.workspace} aria-label="Предпросмотр параллакса">
        <div className={styles.stage}>
          <ParallaxScene souvenir={selected} depthMode={depthMode} strength={strength} opacity={opacity} brightness={brightness} />
          <div className={styles.hint}>Тяни изображение, чтобы менять угол обзора</div>
        </div>

        <aside className={styles.controls}>
          <h2>{selected.title}</h2>
          <div className={styles.choices}>
            {SOUVENIRS.map((souvenir) => (
              <button
                key={souvenir.id}
                type="button"
                className={souvenir.id === selected.id ? styles.selected : ''}
                onClick={() => selectSouvenir(souvenir)}
              >
                <Image src={souvenir.image} alt="" width={58} height={58} unoptimized />
                <span>{souvenir.title}</span>
              </button>
            ))}
          </div>
          <div className={styles.tuners}>
            <label className={styles.depthSelect}>
              <span>Карта глубины</span>
              <select value={depthMode} onChange={(event) => setDepthMode(event.target.value as DepthMode)}>
                {Object.entries(DEPTH_MODES).map(([value, mode]) => <option key={value} value={value}>{mode.label}</option>)}
              </select>
            </label>
            <Slider label="Сила объёма" value={strength} min={0} max={0.5} step={0.005} onChange={setStrength} />
            <Slider label="Глубина сцены" value={opacity} min={0} max={1} step={0.02} onChange={setOpacity} />
            <Slider label="Яркость" value={brightness} min={0.6} max={2} step={0.02} onChange={setBrightness} />
          </div>
        </aside>
      </section>
    </main>
  );
}
