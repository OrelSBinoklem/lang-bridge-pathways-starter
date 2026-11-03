'use client';
import { profileEffectFrame } from './effectDiagnostics';


import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EffectTuningPanel } from './tuning/EffectTuningPanel';
import styles from './body-liquid-glass.module.css';
import { useEffectHost, effectBounds, effectPoint } from './EffectHost';

export type LiquidGlassParams = {
  count: number; size: number; speed: number; merge: number; refraction: number;
  tint: number; shine: number; shadow: number; edgeWidth: number; artwork: number; brightness: number; follow: boolean;
  dispersion: number; renderScale: number;
};

// Select by cover size in physical pixels, including portrait screens and monitor scaling.
const pickArt = (dark: boolean, size: { width: number; height: number }) => {
  const pixels = Math.max(size.width, size.height * 16 / 9) * (window.devicePixelRatio || 1);
  return `/course/effects/curiosity-art${dark ? '-dark' : ''}-${pixels > 2200 ? '4k' : '1920'}.jpg`;
};
const notify = () => {};

// Smooth union blends both distance and pigment, so touching drops become one lens.
const fragmentShader = `
precision highp float;
uniform sampler2D uArt;
uniform vec2 uResolution;
uniform vec3 uDrops[9];
uniform float uCount, uMerge, uRefraction, uTint, uShine, uArtwork, uDark;
uniform float uShadow, uEdgeWidth, uBrightness, uDispersion, uPixelRatio;
varying vec2 vUv;
vec3 pigment(int i) {
  float a = float(i) * 2.4;
  return .55 + .4 * cos(a + vec3(0., 2., 4.));
}
vec4 field(vec2 p) {
  float d = 100.; vec3 color = vec3(0.);
  for (int i=0; i<9; i++) {
    if (float(i) >= uCount) break;
    float next = length(p-uDrops[i].xy)-uDrops[i].z;
    float h = clamp(.5+.5*(next-d)/uMerge,0.,1.);
    d = mix(next,d,h)-uMerge*h*(1.-h);
    color = mix(pigment(i),color,h);
  }
  return vec4(color,d);
}
vec2 contourGradient(vec2 p) {
  float d = 100.;
  vec2 gradient = vec2(0.);
  for (int i=0; i<9; i++) {
    if (float(i) >= uCount) break;
    vec2 delta = p-uDrops[i].xy;
    float distanceToCenter = length(delta);
    float next = distanceToCenter-uDrops[i].z;
    float h = clamp(.5+.5*(next-d)/uMerge,0.,1.);
    gradient = mix(delta/max(distanceToCenter,.00001),gradient,h);
    d = mix(next,d,h)-uMerge*h*(1.-h);
  }
  return gradient;
}
vec3 background(vec2 uv) {
  float aspect = uResolution.x/uResolution.y;
  float artAspect = 3840./2160.;
  vec2 scale = vec2(min(aspect/artAspect,1.),min(artAspect/aspect,1.));
  vec3 art = texture2D(uArt,clamp((uv-.5)*scale+.5,.001,.999)).rgb;
  vec3 paper = mix(vec3(.95,.96,.95),vec3(.025,.032,.037),uDark);
  art = pow(max(art,vec3(0.)),vec3(1./uBrightness));
  return mix(paper,art,uArtwork);
}
void main() {
  float aspect = uResolution.x/uResolution.y;
  vec2 p = (vUv-.5)*vec2(aspect,1.);
  vec4 f = field(p);
  float aa = 1./(uResolution.y*uPixelRatio);
  vec3 color = background(vUv);
  float shadow = 0.;
  if (uShadow > 0.) {
    shadow = (1.-smoothstep(0.,.035,field(p+vec2(-.012,.018)).w))*.3*uShadow;
  }
  color *= 1.-shadow;
  if (f.w < aa) {
    vec2 gradient = contourGradient(p);
    // Flat interior with a rounded bevel. Its slope vanishes before the center,
    // avoiding the distance-field singularity while keeping a strong optical rim.
    float bevel = min(uEdgeWidth/uResolution.y, .025);
    float edge = clamp(1.+min(f.w,0.)/bevel,0.,1.);
    float slope = min(edge*edge,.999);
    vec3 normal = normalize(vec3(gradient*slope,sqrt(1.-slope*slope)));
    vec3 ray = refract(vec3(0.,0.,-1.),normal,1./1.4);
    vec2 bend = -ray.xy/max(-ray.z,.05)*(.25*uRefraction)/vec2(aspect,1.);
    vec3 lens;
    lens.r=background(vUv-bend*(1.+uDispersion)).r;
    lens.g=background(vUv-bend).g;
    lens.b=background(vUv-bend*(1.-uDispersion)).b;
    lens=mix(lens,lens*.65+f.rgb*.55,uTint*(.45+.55*edge));
    float spec = pow(max(dot(normal,normalize(vec3(-.6,.8,1.))),0.),24.);
    float rim = pow(edge,5.);
    lens += (spec*.65*edge+rim*.32)*uShine;
    color=mix(color,lens,1.-smoothstep(-aa,aa,f.w));
  }
  gl_FragColor=vec4(color,1.);
}`;

export function BodyLiquidGlassEffect() {
  const host = useEffectHost();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);
  const tuning = useMemo(() => ({ kind: 'liquid-glass' as const, params: {
    count: 7, size: 1, speed: .65, merge: .065, refraction: .2,
    tint: .65, shine: 0, shadow: 1, edgeWidth: 40, artwork: 1, brightness: 1.12, follow: true,
    dispersion: .18, renderScale: 1.25,
  } }), []);

  useEffect(() => {
    // The body portal must not participate in server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !canvasRef.current) return;
    let disposed = false;
    let release = () => {};
    if (!host) document.body.classList.add('liquid-glass-active');
    void (async () => {
      const THREE = await import('three');
      if (disposed) return;
      const canvas = canvasRef.current!;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      } catch (error) {
        console.warn('Course liquid glass: WebGL unavailable; using artwork fallback.', error);
        return;
      }
      const scene = new THREE.Scene();
      const camera = new THREE.Camera();
      const drops = Array.from({ length: 9 }, () => new THREE.Vector3());
      const texture = new THREE.Texture();
      const loader = new THREE.TextureLoader();
      const textures = new Map<string, InstanceType<typeof THREE.Texture>>();
      const loadedArt = new Set<string>();
      let requestedArt = '';
      const uniforms = {
        uArt: { value: texture }, uResolution: { value: new THREE.Vector2() },
        uDrops: { value: drops }, uCount: { value: 7 }, uMerge: { value: .065 },
        uRefraction: { value: tuning.params.refraction }, uTint: { value: tuning.params.tint }, uShine: { value: tuning.params.shine },
        uArtwork: { value: tuning.params.artwork }, uDark: { value: 0 },
        uShadow: { value: tuning.params.shadow }, uEdgeWidth: { value: tuning.params.edgeWidth },
        uBrightness: { value: tuning.params.brightness },
        uDispersion: { value: tuning.params.dispersion }, uPixelRatio: { value: 1 },
      };
      const updateArtwork = () => {
        const dark = document.documentElement.classList.contains('dark');
        uniforms.uDark.value = dark ? 1 : 0;
        const url = pickArt(dark, effectBounds(host));
        if (requestedArt === url) return;
        requestedArt = url;
        canvas.dataset.artworkReady = 'false';
        canvas.dataset.artwork = url;
        // Show the matching CSS backdrop while loading, never a light frame in dark mode.
        canvas.parentElement?.style.setProperty('background-image', `url("${url}")`);
        const apply = (art: InstanceType<typeof THREE.Texture>) => {
          if (disposed || requestedArt !== url) return;
          uniforms.uArt.value = art;
          canvas.dataset.artworkReady = 'true';
        };
        const cached = textures.get(url);
        if (cached) {
          if (loadedArt.has(url)) apply(cached);
          return;
        }
        const art = loader.load(url, (loaded) => {
          if (disposed) { loaded.dispose(); return; }
          loadedArt.add(url);
          apply(loaded);
        }, undefined, (error) => {
          textures.delete(url);
          art.dispose();
          console.warn(`Course liquid glass: artwork failed to load (${url}).`, error);
        });
        // Keep full-resolution texels at the refracting edge.
        art.generateMipmaps = false;
        art.minFilter = THREE.LinearFilter;
        art.magFilter = THREE.LinearFilter;
        textures.set(url, art);
      };
      const material = new THREE.ShaderMaterial({ uniforms, fragmentShader,
        vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
        depthTest: false, depthWrite: false,
      });
      const geometry = new THREE.PlaneGeometry(2, 2);
      scene.add(new THREE.Mesh(geometry, material));
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      let width = 1, height = 1, time = 0, last = 0, frame = 0;
      let appliedScale = 0, appliedDpr = 0;
      let active = false, pointerX = 0, pointerY = 0, smoothX = 0, smoothY = 0;
      const resize = () => {
        width = Math.max(1, canvas.clientWidth); height = Math.max(1, canvas.clientHeight);
        appliedScale = tuning.params.renderScale;
        appliedDpr = devicePixelRatio || 1;
        // Supersample above native DPR, bounded by GPU size and a 16 MP allocation budget.
        const ratio = Math.min(appliedDpr*appliedScale,
          renderer.capabilities.maxTextureSize/Math.max(width,height),
          Math.sqrt(16000000/(width*height)));
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);
        uniforms.uResolution.value.set(width, height);
        uniforms.uPixelRatio.value = ratio;
        canvas.dataset.renderResolution = `${canvas.width}x${canvas.height}`;
        canvas.dataset.nativeDpr = String(appliedDpr);
        updateArtwork();
      };
      const move = (e: PointerEvent) => {
        if (e.pointerType === 'touch') return;
        active = true;
        const point = effectPoint(host, e);
        if (!point.inside) { active = false; return; }
        pointerX = (point.x-width/2)/height;
        pointerY = (.5-point.y/height);
      };
      const leave = () => { active = false; };
      const observer = new MutationObserver(updateArtwork);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
      const render = profileEffectFrame(canvas, (now: number) => {
        frame = requestAnimationFrame(render);
        const dt = last ? Math.min((now-last)/1000,.05) : 0;
        last = now;
        if (document.hidden) return;
        const p = tuning.params;
        if (p.renderScale !== appliedScale || (devicePixelRatio || 1) !== appliedDpr) resize();
        if (!reducedMotion.matches) time += dt*p.speed;
        const aspect = width/height;
        smoothX += (pointerX-smoothX)*(1.-Math.exp(-dt*7.));
        smoothY += (pointerY-smoothY)*(1.-Math.exp(-dt*7.));
        for (let i=0;i<9;i++) {
          const phase = i*2.399;
          let x = Math.sin(time*.27+phase)*aspect*.37;
          let y = Math.cos(time*.32+phase*1.3)*.34;
          if (i===0 && active && p.follow && !reducedMotion.matches) { x=smoothX; y=smoothY; }
          drops[i].set(x,y,(.06+(i%3)*.013)*p.size*Math.min(1,aspect*1.5));
        }
        uniforms.uCount.value=p.count; uniforms.uMerge.value=p.merge;
        uniforms.uRefraction.value=p.refraction; uniforms.uTint.value=p.tint;
        uniforms.uShine.value=p.shine; uniforms.uArtwork.value=p.artwork;
        uniforms.uShadow.value=p.shadow; uniforms.uEdgeWidth.value=p.edgeWidth;
        uniforms.uBrightness.value=p.brightness;
        uniforms.uDispersion.value=p.dispersion;
        renderer.render(scene,camera);
      });
      const contextLost = (e: Event) => {
        e.preventDefault();
        cancelAnimationFrame(frame);
        console.warn('Course liquid glass: WebGL context lost; using artwork fallback.');
      };
      const contextRestored = () => { last=0; frame=requestAnimationFrame(render); };
      addEventListener('resize',resize);
      addEventListener('pointermove',move,{passive:true});
      addEventListener('blur',leave);
      document.documentElement.addEventListener('pointerleave',leave);
      canvas.addEventListener('webglcontextlost',contextLost);
      canvas.addEventListener('webglcontextrestored',contextRestored);
      frame=requestAnimationFrame(render);
      release = () => {
        cancelAnimationFrame(frame); observer.disconnect(); resizeObserver.disconnect();
        removeEventListener('resize',resize); removeEventListener('pointermove',move);
        removeEventListener('blur',leave);
        document.documentElement.removeEventListener('pointerleave',leave);
        canvas.removeEventListener('webglcontextlost',contextLost);
        canvas.removeEventListener('webglcontextrestored',contextRestored);
        geometry.dispose(); material.dispose(); texture.dispose();
        textures.forEach((art) => art.dispose()); textures.clear();
        renderer.dispose();
      };
    })().catch((error) => console.warn('Course liquid glass failed to initialize.', error));
    return () => {
      disposed=true; release(); if (!host) document.body.classList.remove('liquid-glass-active');
    };
  }, [mounted, tuning, host]);

  if (!mounted) return null;
  return <>
    {createPortal(<div className={styles.backdrop} aria-hidden="true">
      <canvas ref={canvasRef} data-course-liquid-glass="" />
    </div>, host ?? document.body)}
    <EffectTuningPanel tuning={tuning} onChange={notify} />
  </>;
}
