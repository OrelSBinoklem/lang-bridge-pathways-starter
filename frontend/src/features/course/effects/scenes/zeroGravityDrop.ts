import { CanvasTexture, Color, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, SphereGeometry, Vector2, Vector3, Vector4, WebGLRenderer, LinearFilter, RepeatWrapping } from 'three';
import type { CanvasSceneDef } from './types';
import { createDropState, DROP_IMPULSE_LIMIT } from './zeroGravityDropState';
import { dropHitCoordinates, zeroGravityDropLayout } from './zeroGravityDropLayout';

const environmentGLSL = `
uniform sampler2D uEnvironment;
uniform sampler2D uBackdrop;
uniform vec2 uHalfView;
vec3 backdrop(vec2 p) {
  return pow(texture2D(uBackdrop,clamp(p/(2.*uHalfView)+.5,.001,.999)).rgb,vec3(2.2));
}
vec3 room(vec3 d) {
  d = normalize(d);
  vec2 uv = vec2(atan(d.z,d.x)/6.2831853+0.5, asin(clamp(d.y,-1.,1.))/3.14159265+0.5);
  return pow(texture2D(uEnvironment,uv).rgb,vec3(2.2));
}
vec3 display(vec3 c) { return pow(max(c,vec3(0.)),vec3(1./2.2)); }
`;
const vertex = `
uniform float uTime;
uniform vec4 uImpulses[8];
uniform float uPower[8];
varying vec3 vPosition;
varying vec3 vNormal;
float radius(vec3 n) {
  float h = 0.022*sin(uTime*.86)*(3.*n.y*n.y-1.) + 0.012*sin(uTime*.61+1.2)*n.x*n.z;
  for(int i=0;i<8;i++) {
    float a = uImpulses[i].w;
    if(a<0.) continue;
    float cosine = clamp(dot(n,uImpulses[i].xyz),-1.,1.);
    float theta = acos(cosine);
    float dent = -0.19*exp(-theta*theta/0.16)*exp(-a*1.1)*cos(a*6.);
    // The wave traverses the sphere and returns; it no longer disappears after one pass.
    float front = acos(cos(a*1.3));
    float wave = .065*sin(theta*11.-a*8.)*exp(-pow((theta-front)/.7,2.))*exp(-a*.19);
    float mode = .085*(3.*cosine*cosine-1.)*sin(a*4.1)*exp(-a*.23);
    h += (dent+wave+mode)*uPower[i];
  }
  return 0.94+0.24*tanh(h/0.24);
}
vec3 surface(vec3 n) { return n*radius(n); }
void main() {
  vec3 n=normalize(position);
  vec3 tangent=normalize(cross(abs(n.y)>.95?vec3(1,0,0):vec3(0,1,0),n));
  vec3 bitangent=cross(n,tangent);
  vec3 p=surface(n);
  vec3 a=surface(normalize(n+tangent*.003))-p;
  vec3 b=surface(normalize(n+bitangent*.003))-p;
  vec3 normalLocal=normalize(cross(a,b));
  vPosition=(modelMatrix*vec4(p,1.)).xyz;
  vNormal=normalize(mat3(modelMatrix)*normalLocal);
  gl_Position=projectionMatrix*viewMatrix*vec4(vPosition,1.);
}`;
const fragment = `
${environmentGLSL}
uniform vec3 uCenter;
uniform vec3 uTint;
uniform float uExposure;
varying vec3 vPosition;
varying vec3 vNormal;
void main() {
  vec3 n=normalize(vNormal);
  vec3 incoming=vec3(0,0,-1);
  float facing=clamp(dot(-incoming,n),0.,1.);
  float fresnel=.0204+.9796*pow(1.-facing,5.);
  vec3 reflected=room(reflect(incoming,n));
  // Two interfaces: enter water (IOR 1.333), then leave at an approximate rear surface.
  vec3 inside=refract(incoming,n,1./1.333);
  vec3 local=vPosition-uCenter;
  float thickness=max(.08,-2.*dot(local,inside));
  vec3 rearNormal=normalize(local+inside*thickness);
  vec3 exitDirection=refract(inside,-rearNormal,1.333);
  float tir=step(dot(exitDirection,exitDirection),.001);
  exitDirection=mix(exitDirection,reflect(inside,-rearNormal),tir);
  // Intersect the same finite background plane seen outside the water. An environment
  // map alone makes the whole object look like a chrome ball, even with low Fresnel.
  vec3 rearPoint=vPosition+inside*thickness;
  float distanceToBackdrop=max(0.,(-3.-rearPoint.z)/min(-.04,exitDirection.z));
  vec3 transmitted=backdrop(rearPoint.xy+exitDirection.xy*distanceToBackdrop);
  transmitted=mix(transmitted,room(exitDirection),smoothstep(-.08,.08,exitDirection.z));
  // Weak absorption, not a metallic/opaque blue ball.
  vec3 absorption=exp(-(vec3(.018,.006,.003)+(1.-uTint)*.025)*thickness);
  transmitted*=absorption;
  vec3 c=mix(transmitted,reflected,fresnel);
  gl_FragColor=vec4(display(c*uExposure),1.);
}`;

function studioTexture(palette: string[]) {
  const image = document.createElement('canvas'); image.width = 1024; image.height = 512;
  const g = image.getContext('2d')!;
  const gradient = g.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#a2b5bc'); gradient.addColorStop(.42, '#d6e1e1');
  gradient.addColorStop(.5, '#ecede5'); gradient.addColorStop(.57, '#cbd5d5'); gradient.addColorStop(1, '#8b9fa8');
  g.fillStyle = gradient; g.fillRect(0, 0, 1024, 512);
  // Equirectangular studio: broad softboxes and narrow coloured cards create legible moving reflections.
  for (const [x, y, w, h, color] of [
    [665, 265, 90, 155, '#ffffff'], [830, 220, 16, 210, palette[2]],
    [375, 145, 32, 240, '#f4fbff'], [115, 225, 26, 180, '#fff5e8'],
  ] as [number, number, number, number, string][]) {
    g.shadowColor = color; g.shadowBlur = 18; g.fillStyle = color;
    g.beginPath(); g.roundRect(x, y, w, h, 5); g.fill(); g.shadowBlur = 0;
  }
  // Architectural lines behind the drop make the optical inversion visible.
  g.strokeStyle = '#c8d4dd38'; g.lineWidth = 1;
  for (let y = 190; y < 280; y += 16) { g.beginPath(); g.moveTo(120, y); g.lineTo(365, y); g.stroke(); }
  const texture = new CanvasTexture(image);
  texture.wrapS = RepeatWrapping; texture.minFilter = texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return { image, texture };
}

/** A finite, recognisable backdrop: its lines and colours remain visible through the lens. */
function makeBackdrop(aspect: number) {
  const image = document.createElement('canvas');
  image.width = Math.min(2048, Math.round(1200 * Math.max(1, aspect)));
  image.height = Math.round(image.width / aspect);
  const g = image.getContext('2d')!; const w = image.width, h = image.height;
  const base = g.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, '#f3efe5'); base.addColorStop(.5, '#e2edf0'); base.addColorStop(1, '#d8e4df');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (const [x, y, color] of [[.31, .48, '#51a8b7'], [.68, .5, '#e6a083']] as const) {
    const glow = g.createRadialGradient(w*x, h*y, 0, w*x, h*y, h*.5);
    glow.addColorStop(0, color); glow.addColorStop(1, `${color}00`);
    g.fillStyle = glow; g.fillRect(0, 0, w, h);
  }
  g.strokeStyle = '#466b7326'; g.lineWidth = 1;
  const spacing = h / 12;
  for (let x = w / 2 % spacing; x < w; x += spacing) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += spacing) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.strokeStyle = '#ffffff8c'; g.lineWidth = h*.014;
  g.beginPath(); g.moveTo(0, h*.67); g.bezierCurveTo(w*.25, h*.36, w*.7, h*.86, w, h*.42); g.stroke();
  g.fillStyle = '#34596373'; g.font = `500 ${h*.026}px system-ui`; g.textAlign = 'center';
  g.fillText('W A T E R   /   0 1', w*.5, h*.52);
  const texture = new CanvasTexture(image); texture.minFilter = texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return { image, texture };
}

export const ZERO_GRAVITY_DROP: CanvasSceneDef = {
  kind: 'canvas', id: 'zero-gravity-drop', label: 'Невесомость · большая капля',
  palettes: [['#08121f', '#d5b17d', '#96dcf7', '#e2f6ff'], ['#0d1020', '#fca4c4', '#b5b0ff', '#eedfff'], ['#09191c', '#e7c287', '#7ce6cf', '#defff3']],
  defaultParams: { speed: 1, react: 1, intensity: 1, quality: 1 },
  pixelRatioCap: 2, warmupFrames: 1,
  create(c) {
    const course = c.params.zgLayout === 1;
    const aspect = c.width / c.height;
    const layout = zeroGravityDropLayout(c.width, c.height, course, c.body, c.contentVisible !== false);
    const { halfX, halfY } = layout;
    const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    const resolution = Math.min(c.dpr, Math.sqrt(1_800_000 / (c.width * c.height)));
    renderer.setPixelRatio(resolution); renderer.setSize(c.width, c.height, false);
    const scene = new Scene();
    const camera = new OrthographicCamera(-halfX, halfX, halfY, -halfY, .1, 20);
    camera.position.set(0, 0, 5);
    const { image, texture } = studioTexture(c.palette);
    const backing = makeBackdrop(aspect);
    const optics = { uEnvironment: { value: texture }, uBackdrop: { value: backing.texture }, uHalfView: { value: new Vector2(halfX, halfY) } };
    const backgroundGeometry = new PlaneGeometry(halfX * 2, halfY * 2);
    const backgroundMaterial = new ShaderMaterial({
      uniforms: optics,
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `${environmentGLSL}
        varying vec2 vUv;
        void main(){gl_FragColor=vec4(texture2D(uBackdrop,vUv).rgb,1.);}`,
      depthWrite: false,
    });
    const background = new Mesh(backgroundGeometry, backgroundMaterial); background.position.z = -3; scene.add(background);
    const geometry = new SphereGeometry(1, 160, 96);
    const drops = layout.drops.map(placement => {
      const model = createDropState();
      const impulses = Array.from({ length: DROP_IMPULSE_LIMIT }, () => new Vector4(0, 0, 1, -1));
      const powers = new Float32Array(DROP_IMPULSE_LIMIT);
      const center = new Vector3(placement.x, placement.y, 0);
      const material = new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: {
        ...optics, uTime: { value: placement.phase }, uImpulses: { value: impulses }, uPower: { value: powers },
        uCenter: { value: center }, uTint: { value: new Color(placement.warm ? '#ffd6b5' : c.palette[3]) }, uExposure: { value: 1 },
      } });
      const mesh = new Mesh(geometry, material);
      mesh.position.copy(center); mesh.scale.setScalar(placement.scale); scene.add(mesh);
      return { model, impulses, powers, center, material, mesh, placement };
    });
    let diagnosticAt = 0;
    let lost = false;
    const onLost = (event: Event) => { event.preventDefault(); lost = true; console.warn('Zero-gravity drop: WebGL context lost'); };
    const onRestored = () => { lost = false; };
    renderer.domElement.addEventListener('webglcontextlost', onLost);
    renderer.domElement.addEventListener('webglcontextrestored', onRestored);
    return {
      update(dt, _t, pointer) {
        for (const { model, impulses, powers, center, material, mesh, placement } of drops) {
          if (pointer.active && pointer.clicked) {
            const hit = dropHitCoordinates(pointer.rawX, pointer.rawY, c.width, c.height, halfX, halfY, center.x, center.y, placement.scale);
            model.poke(hit.x, hit.y, c.params.react);
          }
          model.update(dt * placement.rate);
          const phase = model.time + placement.phase;
          center.set(placement.x + (model.center.x + Math.sin(phase * .42) * .035) * placement.scale,
            placement.y + (model.center.y + Math.sin(phase * .56) * .045) * placement.scale, 0);
          mesh.position.copy(center);
          material.uniforms.uTime.value = phase;
          material.uniforms.uExposure.value = Math.max(.2, Math.min(2, c.params.intensity));
          for (let i = 0; i < DROP_IMPULSE_LIMIT; i++) {
            const impulse = model.impulses[i];
            if (impulse) { impulses[i].set(impulse.x, impulse.y, impulse.z, impulse.age); powers[i] = impulse.strength; }
            else { impulses[i].w = -1; powers[i] = 0; }
          }
        }
      },
      draw(g) {
        if (lost) {
          g.fillStyle = '#101923'; g.fillRect(0, 0, c.width, c.height);
          g.fillStyle = '#e3f5ff'; g.font = '14px system-ui'; g.fillText('Графический контекст потерян. Перезапустите эффект.', 20, 40); return;
        }
        renderer.render(scene, camera);
        g.drawImage(renderer.domElement, 0, 0, c.width, c.height);
        if (!course) {
          g.textAlign = 'center'; g.fillStyle = '#365560b0'; g.font = `${Math.max(10, Math.min(14, c.width / 65))}px system-ui`;
          g.fillText('КОСНИТЕСЬ КАПЛИ — ИМПУЛЬС И ВОЛНЫ', c.width / 2, c.height * .9);
        }
        if (process.env.NODE_ENV !== 'production' && performance.now() - diagnosticAt > 500) {
          g.canvas.dataset.zeroDrop = JSON.stringify({ count: drops.length, drops: drops.map(({ center, placement, model }) => ({
            x: (center.x / halfX + 1) * c.width / 2, y: (1 - center.y / halfY) * c.height / 2,
            radius: .94 * placement.scale * c.height / (2 * halfY), impulses: model.impulses.length,
          })) });
          diagnosticAt = performance.now();
        }
      },
      dispose() {
        renderer.domElement.removeEventListener('webglcontextlost', onLost);
        renderer.domElement.removeEventListener('webglcontextrestored', onRestored);
        geometry.dispose(); backgroundGeometry.dispose(); drops.forEach(({ material }) => material.dispose()); backgroundMaterial.dispose(); texture.dispose();
        backing.texture.dispose(); backing.image.width = backing.image.height = 1;
        renderer.dispose(); renderer.forceContextLoss(); image.width = image.height = 1;
      },
    };
  },
};
