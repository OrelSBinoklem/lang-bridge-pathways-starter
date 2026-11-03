'use client';
import { profileEffectFrame } from './effectDiagnostics';


import { useEffect, useMemo, useReducer, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { EffectTuningPanel } from './tuning/EffectTuningPanel';
import type { EffectTuningState } from './tuning/types';
import { useEffectHost, effectBounds, effectPoint, observeEffectSize } from './EffectHost';

export type FluidQuality = 'auto' | 'high' | 'low';
export type FluidColorMode = 'mystic' | 'rainbow';

export type FluidTuningParams = {
  quality: FluidQuality;
  colorMode: FluidColorMode;
  splatRadius: number;
  splatForce: number;
  curl: number;
  velocityDissipation: number;
  densityDissipation: number;
  bloom: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  sunrays: boolean;
  sunraysWeight: number;
  shading: boolean;
};

export function createFluidParams(): FluidTuningParams {
  return {
    quality: 'auto',
    colorMode: 'rainbow',
    splatRadius: 0.25,
    splatForce: 6000,
    curl: 30,
    velocityDissipation: 0.2,
    densityDissipation: 1,
    bloom: true,
    bloomIntensity: 0.8,
    bloomThreshold: 0.6,
    sunrays: true,
    sunraysWeight: 1,
    shading: true,
  };
}

const QUALITY_PRESETS: Record<'low' | 'high', { simResolution: number; dyeResolution: number; pressureIterations: number; bloomResolution: number }> = {
  low: { simResolution: 64, dyeResolution: 256, pressureIterations: 8, bloomResolution: 128 },
  high: { simResolution: 128, dyeResolution: 640, pressureIterations: 20, bloomResolution: 256 },
};

/** Picks the same low/high split the debug panel's manual override offers, based on cheap,
 * synchronous signals (touch input, core count, viewport width) — good enough to keep the sim off
 * phones/weak laptops by default without needing an actual WebGL capability probe. */
function detectQuality(): 'low' | 'high' {
  if (typeof window === 'undefined') return 'low';
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const lowCores = (navigator.hardwareConcurrency ?? 4) <= 4;
  const narrow = window.innerWidth < 900;
  return coarsePointer || narrow || lowCores ? 'low' : 'high';
}

function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h /= 6;
  return h < 0 ? h + 1 : h;
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

function getResolution(resolution: number, w: number, h: number): { width: number; height: number } {
  let aspectRatio = w / h;
  if (aspectRatio < 1) aspectRatio = 1 / aspectRatio;
  const min = Math.round(resolution);
  const max = Math.round(resolution * aspectRatio);
  return w > h ? { width: max, height: min } : { width: min, height: max };
}

const BASE_VERTEX = `
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform vec2 texelSize;
  void main() {
    vUv = uv;
    vL = vUv - vec2(texelSize.x, 0.0);
    vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y);
    vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const CLEAR_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform float value;
  void main () { gl_FragColor = value * texture2D(uTexture, vUv); }
`;

const SPLAT_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;
  void main () {
    vec2 p = vUv - point.xy;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + splat, 1.0);
  }
`;

const ADVECTION_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform vec2 dyeTexelSize;
  uniform float dt;
  uniform float dissipation;
  vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
    vec2 st = uv / tsize - 0.5;
    vec2 iuv = floor(st);
    vec2 fuv = fract(st);
    vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
    vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
    vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
    vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
    return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
  }
  void main () {
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    vec4 result = bilerp(uSource, coord, dyeTexelSize);
    float decay = 1.0 + dissipation * dt;
    gl_FragColor = result / decay;
  }
`;

const DIVERGENCE_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity;
  void main () {
    float L = texture2D(uVelocity, vL).x;
    float R = texture2D(uVelocity, vR).x;
    float T = texture2D(uVelocity, vT).y;
    float B = texture2D(uVelocity, vB).y;
    vec2 C = texture2D(uVelocity, vUv).xy;
    if (vL.x < 0.0) { L = -C.x; }
    if (vR.x > 1.0) { R = -C.x; }
    if (vT.y > 1.0) { T = -C.y; }
    if (vB.y < 0.0) { B = -C.y; }
    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`;

const CURL_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity;
  void main () {
    float L = texture2D(uVelocity, vL).y;
    float R = texture2D(uVelocity, vR).y;
    float T = texture2D(uVelocity, vT).x;
    float B = texture2D(uVelocity, vB).x;
    float vorticity = R - L - T + B;
    gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
  }
`;

const VORTICITY_FRAG = `
  precision highp float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform float curl;
  uniform float dt;
  void main () {
    float L = texture2D(uCurl, vL).x;
    float R = texture2D(uCurl, vR).x;
    float T = texture2D(uCurl, vT).x;
    float B = texture2D(uCurl, vB).x;
    float C = texture2D(uCurl, vUv).x;
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= curl * C;
    force.y *= -1.0;
    vec2 vel = texture2D(uVelocity, vUv).xy;
    gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
  }
`;

const PRESSURE_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = (L + R + B + T - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`;

const GRADIENT_SUBTRACT_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity.xy -= vec2(R - L, T - B);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

const DISPLAY_FRAG = `
  precision highp float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uTexture;
  uniform sampler2D uBloom;
  uniform sampler2D uSunrays;
  uniform float bloomIntensity;
  uniform float sunraysEnabled;
  uniform float shading;
  uniform vec2 texelSize;
  void main () {
    vec3 c = texture2D(uTexture, vUv).rgb;

    // Fakes a glossy, embossed surface on the fluid itself: treats brightness as a height field,
    // derives a normal from its neighbors, and lights that normal from straight above — the same
    // "shading" checkbox trick the reference demo uses, purely a lighting effect on the dye's own
    // color (separate from bloom, which adds a soft halo around bright areas instead).
    if (shading > 0.5) {
      vec3 lc = texture2D(uTexture, vL).rgb;
      vec3 rc = texture2D(uTexture, vR).rgb;
      vec3 tc = texture2D(uTexture, vT).rgb;
      vec3 bc = texture2D(uTexture, vB).rgb;
      float dx = length(rc) - length(lc);
      float dy = length(tc) - length(bc);
      vec3 n = normalize(vec3(dx, dy, length(texelSize)));
      vec3 l = vec3(0.0, 0.0, 1.0);
      float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
      c *= diffuse;
    }

    vec3 bloom = texture2D(uBloom, vUv).rgb * bloomIntensity;
    float rays = texture2D(uSunrays, vUv).r;
    float lightMask = mix(1.0, rays, sunraysEnabled);
    c *= lightMask;
    c += bloom * lightMask;

    // Exactly the reference demo's own compositing: alpha comes from the dye's own brightness,
    // and the canvas is cleared to the page's background color right before this draws (see the
    // render loop) with real GPU alpha blending (ONE, ONE_MINUS_SRC_ALPHA) enabled on this
    // material — so bright dye fully replaces the background pixel and faint dye fades toward it,
    // instead of a hand-rolled mix that behaved differently from the original.
    float a = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c, a);
  }
`;

/** Extracts only the bright parts of the dye texture (a soft knee around `threshold`) into the
 * bloom chain's first, largest mip — everything below threshold is dropped entirely so the glow
 * only ever comes from the parts of the fluid that are already vivid. */
const BLOOM_PREFILTER_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform float threshold;
  void main () {
    vec3 c = texture2D(uTexture, vUv).rgb;
    float br = max(c.r, max(c.g, c.b));
    float rq = clamp(br - threshold, 0.0, 1.0);
    c *= rq / max(br, 0.0001);
    gl_FragColor = vec4(c, 0.0);
  }
`;

/** One step of a dual-filter blur — a cheap 4-tap diamond sample that, reused across a
 * halving/doubling mip chain, approximates a wide gaussian blur far more cheaply than a real one. */
const BLOOM_BLUR_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uTexture;
  void main () {
    vec4 sum = texture2D(uTexture, vL) + texture2D(uTexture, vR) + texture2D(uTexture, vT) + texture2D(uTexture, vB);
    gl_FragColor = 0.25 * sum;
  }
`;

// Same two-pass method as the reference fluid demo: turn bright dye into an occlusion mask,
// then integrate it toward the screen centre to form volumetric-looking light shafts.
const SUNRAYS_MASK_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  void main () {
    vec4 c = texture2D(uTexture, vUv);
    float brightness = max(c.r, max(c.g, c.b));
    c.a = 1.0 - min(clamp(brightness * 20.0, 0.0, 1.0), 0.8);
    gl_FragColor = c;
  }
`;

const SUNRAYS_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform float weight;
  #define ITERATIONS 16
  void main () {
    const float density = 0.3;
    const float decay = 0.95;
    const float exposure = 0.7;
    vec2 coord = vUv;
    vec2 direction = (vUv - 0.5) * (density / float(ITERATIONS));
    float illuminationDecay = 1.0;
    float light = texture2D(uTexture, vUv).a;
    for (int i = 0; i < ITERATIONS; i++) {
      coord -= direction;
      light += texture2D(uTexture, coord).a * illuminationDecay * weight;
      illuminationDecay *= decay;
    }
    gl_FragColor = vec4(light * exposure, 0.0, 0.0, 1.0);
  }
`;

type Fbo = { target: THREE.WebGLRenderTarget; texelSizeX: number; texelSizeY: number };
type DoubleFbo = { read: Fbo; write: Fbo; swap: () => void };

function createFbo(w: number, h: number, type: THREE.TextureDataType): Fbo {
  const target = new THREE.WebGLRenderTarget(w, h, {
    type,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  return { target, texelSizeX: 1 / w, texelSizeY: 1 / h };
}

function createDoubleFbo(w: number, h: number, type: THREE.TextureDataType): DoubleFbo {
  let read = createFbo(w, h, type);
  let write = createFbo(w, h, type);
  return {
    get read() { return read; },
    get write() { return write; },
    swap() { const tmp = read; read = write; write = tmp; },
  } as DoubleFbo;
}

/**
 * A whole-page WebGL fluid simulation (Navier-Stokes on a staggered grid, Jacobi-solved pressure,
 * vorticity confinement — the same algorithm family as paveldogreat's WebGL-Fluid-Simulation demo)
 * portalled into `document.body`, dye colored around this group's accent hue. Unlike that demo's
 * opaque full-screen canvas, the display pass outputs alpha from dye brightness, so empty areas
 * stay fully transparent and the real page shows through — same compositing model as
 * `BodyGridEffect`. Matches the reference demo's actual interaction: color only splats while the
 * pointer is held down and moving (a plain hover does nothing), after five random startup splats.
 */
export function FluidEffect({ accent }: { accent: string }) {
  const host = useEffectHost();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tuning = useMemo<EffectTuningState>(() => ({ kind: 'fluid', params: createFluidParams() }), []);
  const [rev, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const params = tuning.kind === 'fluid' ? tuning.params : createFluidParams();
    const accentHue = hexToHue(accent);
    // The canvas paints this as its own base color every frame (see DISPLAY_FRAG) instead of
    // relying on page transparency to show a background — same fix already used in
    // BodyGridEffect, and for the same reason: painting nothing and hoping ancestors stay
    // transparent is fragile, whereas owning the pixel is not.
    const pageBg = new THREE.Color(getComputedStyle(document.body).getPropertyValue('--background').trim() || '#ffffff');
    // next-themes toggles a class on <html> rather than remounting anything, so nothing else here
    // would ever notice a light/dark switch — without this the fluid keeps clearing to whatever
    // color was current when the effect started, until a full page reload picks up the new one.
    const themeObserver = new MutationObserver(() => {
      pageBg.set(getComputedStyle(document.body).getPropertyValue('--background').trim() || '#ffffff');
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);

    const textureType = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, undefined as unknown as THREE.Material);
    // This camera never gets a real projection matrix (the vertex shader ignores it entirely —
    // see BASE_VERTEX), so the default frustum-culling check three.js runs before every draw call
    // has nothing valid to test against and can drop the quad. Same fix three.js's own internal
    // fullscreen-quad helper (Pass/FullScreenQuad) uses.
    mesh.frustumCulled = false;
    scene.add(mesh);

    function makeMaterial(fragmentShader: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
      return new THREE.ShaderMaterial({ vertexShader: BASE_VERTEX, fragmentShader, uniforms, depthTest: false, depthWrite: false });
    }

    const clearMat = makeMaterial(CLEAR_FRAG, { uTexture: { value: null }, value: { value: 0.8 }, texelSize: { value: new THREE.Vector2() } });
    const splatMat = makeMaterial(SPLAT_FRAG, {
      uTarget: { value: null }, aspectRatio: { value: 1 }, color: { value: new THREE.Vector3() },
      point: { value: new THREE.Vector2() }, radius: { value: 0.005 }, texelSize: { value: new THREE.Vector2() },
    });
    const advectionMat = makeMaterial(ADVECTION_FRAG, {
      uVelocity: { value: null }, uSource: { value: null }, texelSize: { value: new THREE.Vector2() },
      dyeTexelSize: { value: new THREE.Vector2() }, dt: { value: 0.016 }, dissipation: { value: 1 },
    });
    const divergenceMat = makeMaterial(DIVERGENCE_FRAG, { uVelocity: { value: null }, texelSize: { value: new THREE.Vector2() } });
    const curlMat = makeMaterial(CURL_FRAG, { uVelocity: { value: null }, texelSize: { value: new THREE.Vector2() } });
    const vorticityMat = makeMaterial(VORTICITY_FRAG, {
      uVelocity: { value: null }, uCurl: { value: null }, curl: { value: 30 }, dt: { value: 0.016 }, texelSize: { value: new THREE.Vector2() },
    });
    const pressureMat = makeMaterial(PRESSURE_FRAG, { uPressure: { value: null }, uDivergence: { value: null }, texelSize: { value: new THREE.Vector2() } });
    const gradientMat = makeMaterial(GRADIENT_SUBTRACT_FRAG, { uPressure: { value: null }, uVelocity: { value: null }, texelSize: { value: new THREE.Vector2() } });
    const displayMat = makeMaterial(DISPLAY_FRAG, {
      uTexture: { value: null }, uBloom: { value: null }, uSunrays: { value: null },
      bloomIntensity: { value: 0.8 }, sunraysEnabled: { value: 1 }, shading: { value: 1 }, texelSize: { value: new THREE.Vector2() },
    });
    // Matches the reference demo's `gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)` exactly: the
    // display pass's own alpha (dye brightness) controls how much of the background — just
    // cleared behind it, see the render loop — survives underneath.
    displayMat.transparent = true;
    displayMat.blending = THREE.CustomBlending;
    displayMat.blendSrc = THREE.OneFactor;
    displayMat.blendDst = THREE.OneMinusSrcAlphaFactor;
    displayMat.blendEquation = THREE.AddEquation;
    const bloomPrefilterMat = makeMaterial(BLOOM_PREFILTER_FRAG, { uTexture: { value: null }, threshold: { value: 0.6 }, texelSize: { value: new THREE.Vector2() } });
    const bloomBlurMat = makeMaterial(BLOOM_BLUR_FRAG, { uTexture: { value: null }, texelSize: { value: new THREE.Vector2() } });
    const bloomBlurAdditiveMat = makeMaterial(BLOOM_BLUR_FRAG, { uTexture: { value: null }, texelSize: { value: new THREE.Vector2() } });
    const sunraysMaskMat = makeMaterial(SUNRAYS_MASK_FRAG, { uTexture: { value: null }, texelSize: { value: new THREE.Vector2() } });
    const sunraysMat = makeMaterial(SUNRAYS_FRAG, { uTexture: { value: null }, weight: { value: 1 }, texelSize: { value: new THREE.Vector2() } });
    // Must be CustomBlending, not the AdditiveBlending preset: that preset hardcodes
    // (SRC_ALPHA, ONE), and every bloom mip's own alpha channel is always 0 (see
    // BLOOM_PREFILTER_FRAG), so with the preset this "additive" pass was silently contributing
    // nothing at all. CustomBlending is what actually lets blendSrc/blendDst below take effect,
    // matching the reference demo's `gl.blendFunc(gl.ONE, gl.ONE)` for this exact step.
    bloomBlurAdditiveMat.transparent = true;
    bloomBlurAdditiveMat.blending = THREE.CustomBlending;
    bloomBlurAdditiveMat.blendSrc = THREE.OneFactor;
    bloomBlurAdditiveMat.blendDst = THREE.OneFactor;
    bloomBlurAdditiveMat.blendEquation = THREE.AddEquation;
    // Safe sampler2D fallback for optional post-processing passes.
    const blackTexture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    blackTexture.needsUpdate = true;
    const whiteTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    whiteTexture.needsUpdate = true;

    let vw = effectBounds(host).width;
    let vh = effectBounds(host).height;
    let simRes = { width: 128, height: 128 };
    let dyeRes = { width: 512, height: 512 };
    let pressureIterations = 20;
    let bloomChain: Fbo[] = [];
    let sunraysFbo: Fbo;
    let sunraysTempFbo: Fbo;
    let sunraysMaskFbo: Fbo;
    let velocity: DoubleFbo;
    let dye: DoubleFbo;
    let divergenceFbo: Fbo;
    let curlFbo: Fbo;
    let pressure: DoubleFbo;
    let startupSplashPending = false;

    function resolveQuality(): 'low' | 'high' {
      return params.quality === 'auto' ? detectQuality() : params.quality;
    }

    function disposeSim() {
      velocity?.read.target.dispose(); velocity?.write.target.dispose();
      dye?.read.target.dispose(); dye?.write.target.dispose();
      pressure?.read.target.dispose(); pressure?.write.target.dispose();
      divergenceFbo?.target.dispose();
      curlFbo?.target.dispose();
      bloomChain.forEach((fbo) => fbo.target.dispose());
      sunraysFbo?.target.dispose(); sunraysTempFbo?.target.dispose(); sunraysMaskFbo?.target.dispose();
      bloomChain = [];
    }

    function setupSim() {
      disposeSim();
      startupSplashPending = true;
      const preset = QUALITY_PRESETS[resolveQuality()];
      pressureIterations = preset.pressureIterations;
      simRes = getResolution(preset.simResolution, vw, vh);
      dyeRes = getResolution(preset.dyeResolution, vw, vh);
      velocity = createDoubleFbo(simRes.width, simRes.height, textureType);
      dye = createDoubleFbo(dyeRes.width, dyeRes.height, textureType);
      divergenceFbo = createFbo(simRes.width, simRes.height, textureType);
      curlFbo = createFbo(simRes.width, simRes.height, textureType);
      pressure = createDoubleFbo(simRes.width, simRes.height, textureType);

      // A halving mip chain (256 -> 128 -> ... -> a few px) — each level is one dual-filter blur
      // step, together approximating one wide gaussian blur far cheaper than doing it for real.
      const bloomBase = getResolution(preset.bloomResolution, vw, vh);
      let bw = bloomBase.width;
      let bh = bloomBase.height;
      for (let i = 0; i < 8 && bw >= 4 && bh >= 4; i++) {
        bloomChain.push(createFbo(bw, bh, textureType));
        bw >>= 1;
        bh >>= 1;
      }
      const sunrayResolution = resolveQuality() === 'high' ? 196 : 128;
      const sunraySize = getResolution(sunrayResolution, vw, vh);
      sunraysFbo = createFbo(sunraySize.width, sunraySize.height, textureType);
      sunraysTempFbo = createFbo(sunraySize.width, sunraySize.height, textureType);
      sunraysMaskFbo = createFbo(dyeRes.width, dyeRes.height, textureType);
    }

    function resize() {
      const bounds = effectBounds(host);
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      // ResizeObserver also notifies immediately after observe(). That notification must
      // not erase the startup splashes (or a user's drawing) when dimensions are unchanged.
      if (velocity && width === vw && height === vh) return;
      vw = width;
      vh = height;
      renderer.setSize(vw, vh, false);
      setupSim();
    }
    const stopResize = observeEffectSize(host, resize);

    const pointer = { x: 0, y: 0, lastX: 0, lastY: 0, down: false, moved: false, color: [1, 1, 1] as [number, number, number] };
    let lastColorTime = 0;

    function pickColor() {
      const spread = 0.09;
      const hue = params.colorMode === 'mystic'
        ? (accentHue + (Math.random() * 2 - 1) * spread + 1) % 1
        : Math.random();
      const [r, g, b] = hsvToRgb(hue, 1, 1);
      pointer.color = [r * 0.15, g * 0.15, b * 0.15];
    }

    function toUv(event: PointerEvent) {
      const point = effectPoint(host, event);
      return { x: point.x / vw, y: 1 - point.y / vh };
    }

    const onDown = (e: PointerEvent) => {
      if (!effectPoint(host, e).inside) return;
      pointer.down = true;
      const uv = toUv(e);
      pointer.x = pointer.lastX = uv.x;
      pointer.y = pointer.lastY = uv.y;
      pickColor();
      lastColorTime = performance.now();
    };
    const onMove = (e: PointerEvent) => {
      if (!effectPoint(host, e).inside) { pointer.down = false; return; }
      if (!pointer.down) return;
      const uv = toUv(e);
      pointer.x = uv.x;
      pointer.y = uv.y;
      pointer.moved = true;
      if (performance.now() - lastColorTime > 100) { pickColor(); lastColorTime = performance.now(); }
    };
    const onUp = () => { pointer.down = false; };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    function splat(uvx: number, uvy: number, dx: number, dy: number, color: [number, number, number]) {
      const aspect = vw / vh;
      const radius = params.splatRadius / 100 * (aspect > 1 ? aspect : 1);
      mesh.material = splatMat;
      splatMat.uniforms.uTarget.value = velocity.read.target.texture;
      splatMat.uniforms.aspectRatio.value = aspect;
      splatMat.uniforms.point.value.set(uvx, uvy);
      splatMat.uniforms.color.value.set(dx, dy, 0);
      splatMat.uniforms.radius.value = radius;
      renderer.setRenderTarget(velocity.write.target);
      renderer.render(scene, camera);
      velocity.swap();

      splatMat.uniforms.uTarget.value = dye.read.target.texture;
      splatMat.uniforms.color.value.set(color[0], color[1], color[2]);
      renderer.setRenderTarget(dye.write.target);
      renderer.render(scene, camera);
      dye.swap();
    }

    function initialSplash() {
      const bursts = Array.from({ length: 5 }, () => ({
        x: 0.14 + Math.random() * 0.72,
        y: 0.18 + Math.random() * 0.64,
        angle: Math.random() * Math.PI * 2,
        hue: Math.random(),
      }));
      bursts.forEach(({ x, y, angle, hue }) => {
        const [r, g, b] = hsvToRgb(hue, 0.92, 1);
        splat(
          x,
          y,
          Math.cos(angle) * params.splatForce * 0.32,
          Math.sin(angle) * params.splatForce * 0.32,
          [r * 1.25, g * 1.25, b * 1.25],
        );
      });
    }

    /** Threshold the dye texture into `bloomChain[0]`, blur-downsample to the smallest mip, then
     * blur-upsample back up with additive blending — the classic cheap bloom pyramid. Leaves the
     * finished glow in `bloomChain[0]` for the display pass to sample. */
    function applyBloom() {
      if (bloomChain.length < 2) return;
      let last = bloomChain[0];

      mesh.material = bloomPrefilterMat;
      bloomPrefilterMat.uniforms.uTexture.value = dye.read.target.texture;
      bloomPrefilterMat.uniforms.threshold.value = params.bloomThreshold;
      renderer.setRenderTarget(last.target);
      renderer.render(scene, camera);

      mesh.material = bloomBlurMat;
      for (let i = 1; i < bloomChain.length; i++) {
        const dest = bloomChain[i];
        bloomBlurMat.uniforms.uTexture.value = last.target.texture;
        bloomBlurMat.uniforms.texelSize.value.set(last.texelSizeX, last.texelSizeY);
        renderer.setRenderTarget(dest.target);
        renderer.render(scene, camera);
        last = dest;
      }

      mesh.material = bloomBlurAdditiveMat;
      for (let i = bloomChain.length - 2; i >= 0; i--) {
        const dest = bloomChain[i];
        bloomBlurAdditiveMat.uniforms.uTexture.value = last.target.texture;
        bloomBlurAdditiveMat.uniforms.texelSize.value.set(last.texelSizeX, last.texelSizeY);
        renderer.setRenderTarget(dest.target);
        renderer.render(scene, camera);
        last = dest;
      }
    }

    function applySunrays() {
      mesh.material = sunraysMaskMat;
      sunraysMaskMat.uniforms.uTexture.value = dye.read.target.texture;
      renderer.setRenderTarget(sunraysMaskFbo.target);
      renderer.render(scene, camera);

      mesh.material = sunraysMat;
      sunraysMat.uniforms.uTexture.value = sunraysMaskFbo.target.texture;
      sunraysMat.uniforms.weight.value = params.sunraysWeight;
      renderer.setRenderTarget(sunraysFbo.target);
      renderer.render(scene, camera);

      mesh.material = bloomBlurMat;
      bloomBlurMat.uniforms.uTexture.value = sunraysFbo.target.texture;
      bloomBlurMat.uniforms.texelSize.value.set(sunraysFbo.texelSizeX, sunraysFbo.texelSizeY);
      renderer.setRenderTarget(sunraysTempFbo.target);
      renderer.render(scene, camera);
      bloomBlurMat.uniforms.uTexture.value = sunraysTempFbo.target.texture;
      renderer.setRenderTarget(sunraysFbo.target);
      renderer.render(scene, camera);
    }

    function step(dt: number) {
      mesh.material = curlMat;
      curlMat.uniforms.uVelocity.value = velocity.read.target.texture;
      curlMat.uniforms.texelSize.value.set(velocity.read.texelSizeX, velocity.read.texelSizeY);
      renderer.setRenderTarget(curlFbo.target);
      renderer.render(scene, camera);

      mesh.material = vorticityMat;
      vorticityMat.uniforms.uVelocity.value = velocity.read.target.texture;
      vorticityMat.uniforms.uCurl.value = curlFbo.target.texture;
      vorticityMat.uniforms.curl.value = params.curl;
      vorticityMat.uniforms.dt.value = dt;
      vorticityMat.uniforms.texelSize.value.set(velocity.read.texelSizeX, velocity.read.texelSizeY);
      renderer.setRenderTarget(velocity.write.target);
      renderer.render(scene, camera);
      velocity.swap();

      mesh.material = divergenceMat;
      divergenceMat.uniforms.uVelocity.value = velocity.read.target.texture;
      divergenceMat.uniforms.texelSize.value.set(velocity.read.texelSizeX, velocity.read.texelSizeY);
      renderer.setRenderTarget(divergenceFbo.target);
      renderer.render(scene, camera);

      mesh.material = clearMat;
      clearMat.uniforms.uTexture.value = pressure.read.target.texture;
      clearMat.uniforms.value.value = 0.8;
      renderer.setRenderTarget(pressure.write.target);
      renderer.render(scene, camera);
      pressure.swap();

      mesh.material = pressureMat;
      pressureMat.uniforms.uDivergence.value = divergenceFbo.target.texture;
      pressureMat.uniforms.texelSize.value.set(velocity.read.texelSizeX, velocity.read.texelSizeY);
      for (let i = 0; i < pressureIterations; i++) {
        pressureMat.uniforms.uPressure.value = pressure.read.target.texture;
        renderer.setRenderTarget(pressure.write.target);
        renderer.render(scene, camera);
        pressure.swap();
      }

      mesh.material = gradientMat;
      gradientMat.uniforms.uPressure.value = pressure.read.target.texture;
      gradientMat.uniforms.uVelocity.value = velocity.read.target.texture;
      gradientMat.uniforms.texelSize.value.set(velocity.read.texelSizeX, velocity.read.texelSizeY);
      renderer.setRenderTarget(velocity.write.target);
      renderer.render(scene, camera);
      velocity.swap();

      mesh.material = advectionMat;
      advectionMat.uniforms.uVelocity.value = velocity.read.target.texture;
      advectionMat.uniforms.uSource.value = velocity.read.target.texture;
      advectionMat.uniforms.texelSize.value.set(velocity.read.texelSizeX, velocity.read.texelSizeY);
      advectionMat.uniforms.dyeTexelSize.value.set(velocity.read.texelSizeX, velocity.read.texelSizeY);
      advectionMat.uniforms.dt.value = dt;
      advectionMat.uniforms.dissipation.value = params.velocityDissipation;
      renderer.setRenderTarget(velocity.write.target);
      renderer.render(scene, camera);
      velocity.swap();

      advectionMat.uniforms.uVelocity.value = velocity.read.target.texture;
      advectionMat.uniforms.uSource.value = dye.read.target.texture;
      advectionMat.uniforms.dyeTexelSize.value.set(dye.read.texelSizeX, dye.read.texelSizeY);
      advectionMat.uniforms.dissipation.value = params.densityDissipation;
      renderer.setRenderTarget(dye.write.target);
      renderer.render(scene, camera);
      dye.swap();
    }

    let rafId = 0;
    let lastTime = 0;
    const loop = profileEffectFrame(canvas, (time: number) => {
      rafId = requestAnimationFrame(loop);
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 1 / 60) : 1 / 60;
      lastTime = time;

      // Seed the current buffers, after any resize callbacks have recreated them.
      if (startupSplashPending) {
        initialSplash();
        startupSplashPending = false;
      }

      if (pointer.moved) {
        const dx = (pointer.x - pointer.lastX) * params.splatForce;
        const dy = (pointer.y - pointer.lastY) * params.splatForce;
        splat(pointer.x, pointer.y, dx, dy, pointer.color);
        pointer.lastX = pointer.x;
        pointer.lastY = pointer.y;
        pointer.moved = false;
      }

      step(dt);

      if (params.bloom) applyBloom();
      if (params.sunrays) applySunrays();

      mesh.material = displayMat;
      displayMat.uniforms.uTexture.value = dye.read.target.texture;
      displayMat.uniforms.uBloom.value = params.bloom && bloomChain.length > 1 ? bloomChain[0].target.texture : blackTexture;
      displayMat.uniforms.bloomIntensity.value = params.bloom ? params.bloomIntensity : 0;
      displayMat.uniforms.uSunrays.value = params.sunrays ? sunraysFbo.target.texture : whiteTexture;
      displayMat.uniforms.sunraysEnabled.value = params.sunrays ? 1 : 0;
      displayMat.uniforms.shading.value = params.shading ? 1 : 0;
      displayMat.uniforms.texelSize.value.set(dye.read.texelSizeX, dye.read.texelSizeY);
      renderer.setRenderTarget(null);
      // The reference demo's `drawColor(fbo, BACK_COLOR)` step: paint the page's own background
      // color first, then let the display pass's alpha-blended draw (set up above) composite the
      // dye on top of it.
      renderer.setClearColor(pageBg, 1);
      renderer.clear();
      renderer.render(scene, camera);
    });
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      themeObserver.disconnect();
      stopResize();
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      disposeSim();
      geometry.dispose();
      [clearMat, splatMat, advectionMat, divergenceMat, curlMat, vorticityMat, pressureMat, gradientMat, displayMat, bloomPrefilterMat, bloomBlurMat, bloomBlurAdditiveMat, sunraysMaskMat, sunraysMat].forEach((m) => m.dispose());
      blackTexture.dispose(); whiteTexture.dispose();
      renderer.dispose();
    };
  }, [accent, rev, tuning, host]);

  return (
    <>
      {createPortal(
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
        />,
        host ?? document.body,
      )}
      <EffectTuningPanel tuning={tuning} onChange={bump} />
    </>
  );
}
