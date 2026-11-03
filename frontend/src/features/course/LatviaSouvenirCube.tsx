'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import type { Group } from 'three';
import type { LatviaCubeTuningParams, LatviaPortalTuningParams } from './effects/tuning/types';

const SOUVENIR_TEXTURES = [
  '/course/effects/latvia-cat-v1.webp',
  '/course/effects/latvia-sprats-v1.webp',
  '/course/effects/latvia-amber-v1.webp',
  '/course/effects/latvia-monument-v1.webp',
];

const DEPTH_TEXTURES = [
  '/course/effects/latvia-cat-depth-v2.webp',
  '/course/effects/latvia-sprats-depth-v2.webp',
  '/course/effects/latvia-amber-depth-v2.webp',
  '/course/effects/latvia-monument-depth-v2.webp',
];

const CUBE_HALF_SIZE = 0.76;
const FRAME_SPAN = CUBE_HALF_SIZE * 2;

const PARALLAX_VERTEX_SHADER = `
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
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const PARALLAX_FRAGMENT_SHADER = `
  uniform sampler2D uImage;
  uniform float uBrightness;
  varying vec2 vUv;

  void main() {
    vec4 color = texture2D(uImage, vUv);
    color.rgb *= uBrightness;
    gl_FragColor = color;
  }
`;

const stencilContent = (id: number) => ({
  stencilWrite: true,
  stencilFunc: THREE.EqualStencilFunc,
  stencilRef: id,
  stencilFuncMask: 0xff,
  stencilZPass: THREE.KeepStencilOp,
  stencilZFail: THREE.KeepStencilOp,
  stencilFail: THREE.KeepStencilOp,
});

type PortalRenderParams = LatviaPortalTuningParams & Pick<LatviaCubeTuningParams, 'portalSize' | 'parallaxOnly'>;

type PortalProps = {
  id: number;
  rotation: number;
  texture: THREE.Texture;
  depthTexture: THREE.Texture;
  params: PortalRenderParams;
};

function ParallaxArtwork({ id, texture, depthTexture, params }: Pick<PortalProps, 'id' | 'texture' | 'depthTexture' | 'params'>) {
  const renderOrder = 20 + id;
  const uniforms = useMemo(() => ({
    uImage: { value: texture },
    uDepth: { value: depthTexture },
    uStrength: { value: params.depthScale },
    uDepthBlend: { value: params.parallaxOpacity },
    uBrightness: { value: params.artworkBrightness },
  }), [depthTexture, params.artworkBrightness, params.depthScale, params.parallaxOpacity, texture]);

  return (
    <mesh position={[0, 0, 0]} renderOrder={renderOrder}>
      <planeGeometry args={[params.portalSize + 0.015, params.portalSize + 0.015, 96, 96]} />
      <shaderMaterial
        key={`portal-parallax-v2-${id}`}
        uniforms={uniforms}
        vertexShader={PARALLAX_VERTEX_SHADER}
        fragmentShader={PARALLAX_FRAGMENT_SHADER}
        side={THREE.DoubleSide}
        transparent
        depthWrite
        depthTest
        toneMapped={false}
        {...stencilContent(id)}
      />
    </mesh>
  );
}

/**
 * The outer side is only a stencil window. Its image is at the cube's midpoint, not attached to
 * the side itself: this is what makes the box behave like an impossible display rather than a
 * textured physical cube.
 */
function SouvenirPortal({ id, rotation, texture, depthTexture, params }: PortalProps) {
  const renderOrder = id;
  const mask = {
    colorWrite: false,
    depthWrite: false,
    stencilWrite: true,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilRef: id,
    stencilFuncMask: 0xff,
    stencilZPass: THREE.ReplaceStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilFail: THREE.KeepStencilOp,
  };

  return (
    <group rotation={[0, rotation, 0]}>
      <mesh position={[0, 0, CUBE_HALF_SIZE]} renderOrder={renderOrder}>
        <planeGeometry args={[params.portalSize, params.portalSize]} />
        <meshBasicMaterial transparent side={THREE.FrontSide} {...mask} />
      </mesh>
      {/* Keep masks, backgrounds and artwork in the same render queue, in that order.
          The opening-sized backdrop fills the window but never writes scene depth. */}
      <mesh position={[0, 0, CUBE_HALF_SIZE]} renderOrder={10 + id} visible={!params.parallaxOnly}>
        <planeGeometry args={[params.portalSize, params.portalSize]} />
        <meshBasicMaterial
          color="#151a23"
          transparent
          opacity={params.roomBackdropOpacity}
          side={THREE.FrontSide}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
          {...stencilContent(id)}
        />
      </mesh>
      <ParallaxArtwork id={id} texture={texture} depthTexture={depthTexture} params={params} />
    </group>
  );
}

function DecorativeFrame({ frameThickness: thickness }: Pick<LatviaCubeTuningParams, 'frameThickness'>) {
  const h = CUBE_HALF_SIZE;
  const bars: Array<{ position: [number, number, number]; size: [number, number, number] }> = [];

  const barLength = FRAME_SPAN + thickness;
  for (const y of [-h, h]) for (const z of [-h, h]) bars.push({ position: [0, y, z], size: [barLength, thickness, thickness] });
  for (const x of [-h, h]) for (const z of [-h, h]) bars.push({ position: [x, 0, z], size: [thickness, barLength, thickness] });
  for (const x of [-h, h]) for (const y of [-h, h]) bars.push({ position: [x, y, 0], size: [thickness, thickness, barLength] });

  return (
    <group>
      {bars.map(({ position, size }, index) => (
        <mesh key={index} position={position}>
          <boxGeometry args={size} />
          <meshPhysicalMaterial color="#c99747" emissive="#3d2108" emissiveIntensity={0.42} metalness={0.9} roughness={0.18} clearcoat={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * An impossible display cube: each outer side is an invisible stencil portal, while its souvenir
 * image is suspended at the midpoint. Rotating the frame therefore exposes a different world
 * through every side instead of pasting pictures onto the cube's skin.
 */
export function LatviaCubeEffect({ dark, params }: { dark: boolean; params: LatviaCubeTuningParams }) {
  const cubeRef = useRef<Group>(null);
  const [loadedTextures, setLoadedTextures] = useState<THREE.Texture[]>([]);
  // Do not suspend the whole Canvas while images load: R3F's delayed teardown
  // can otherwise invalidate the reused WebGL context during preview switches.
  useEffect(() => {
    let disposed = false;
    const owned: THREE.Texture[] = [];
    const loader = new THREE.TextureLoader();
    Promise.all([...SOUVENIR_TEXTURES, ...DEPTH_TEXTURES].map(url => loader.loadAsync(url).then(texture => {
      if (disposed) texture.dispose(); else owned.push(texture);
      return texture;
    }))).then(loaded => { if (!disposed) setLoadedTextures(loaded); }).catch(error => {
      if (!disposed) console.error('[latvia-souvenir-cube] Texture loading failed', error);
    });
    return () => { disposed = true; owned.forEach(texture => texture.dispose()); };
  }, []);
  const textures = useMemo(() => loadedTextures.slice(0, 4).map((texture) => {
    const next = texture.clone();
    next.colorSpace = THREE.SRGBColorSpace;
    next.anisotropy = 4;
    // The source shots include generous black studio margins. Cropping them in UV space makes
    // each souvenir fill its portal without creating a second derived image asset.
    next.needsUpdate = true;
    return next;
  }), [loadedTextures]);
  const depthTextures = useMemo(() => loadedTextures.slice(4).map((texture) => {
    const next = texture.clone();
    next.colorSpace = THREE.NoColorSpace;
    next.anisotropy = 4;
    next.minFilter = THREE.LinearFilter;
    next.magFilter = THREE.LinearFilter;
    next.generateMipmaps = false;
    next.needsUpdate = true;
    return next;
  }), [loadedTextures]);

  useEffect(() => () => { [...textures, ...depthTextures].forEach(texture => texture.dispose()); }, [textures, depthTextures]);

  useFrame((state, delta) => {
    if (!cubeRef.current) return;
    cubeRef.current.rotation.y += delta * params.rotationSpeed;
    cubeRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.28) * 0.03;
    cubeRef.current.position.x = params.positionX;
    cubeRef.current.scale.setScalar(params.cubeScale);

    const offset = (1 - params.imageZoom) / 2;
    [...textures, ...depthTextures].forEach((texture) => {
      texture.repeat.set(params.imageZoom, params.imageZoom);
      texture.offset.set(offset, offset);
    });
  });

  return (
    <group ref={cubeRef} position={[params.positionX, 0, 0]}>
      <ambientLight intensity={dark ? 0.62 : 0.8} />
      <directionalLight position={[3.8, 1.6, 4.4]} intensity={dark ? 4.6 : 3.6} color="#fff0c9" />
      <pointLight position={[2.4, 2.8, 3.2]} intensity={dark ? 14 : 10} color="#ffe0a0" />
      <pointLight position={[-2.2, -1, 2.4]} intensity={dark ? 5 : 3} color="#d95f79" />
      {textures.length === 4 && <>
      <SouvenirPortal id={1} rotation={0} texture={textures[0]} depthTexture={depthTextures[0]} params={{ ...params.portals.cat, portalSize: params.portalSize, parallaxOnly: params.parallaxOnly }} />
      <SouvenirPortal id={2} rotation={Math.PI / 2} texture={textures[1]} depthTexture={depthTextures[1]} params={{ ...params.portals.sprats, portalSize: params.portalSize, parallaxOnly: params.parallaxOnly }} />
      <SouvenirPortal id={3} rotation={Math.PI} texture={textures[2]} depthTexture={depthTextures[2]} params={{ ...params.portals.amber, portalSize: params.portalSize, parallaxOnly: params.parallaxOnly }} />
      <SouvenirPortal id={4} rotation={-Math.PI / 2} texture={textures[3]} depthTexture={depthTextures[3]} params={{ ...params.portals.monument, portalSize: params.portalSize, parallaxOnly: params.parallaxOnly }} />
      </>}
      <DecorativeFrame frameThickness={params.frameThickness} />
    </group>
  );
}
