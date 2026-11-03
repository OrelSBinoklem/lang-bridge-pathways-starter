
import { profileEffectFrame } from '../course/effects/effectDiagnostics';
import * as THREE from 'three';
import { drawTechArtwork, TECH_ASPECT } from './techArtwork';

export const artwork = '/course/holographic-foil/island-v1.png';
export const foilDefaults = {
    strength: 1,
    scale: 1,
    density: 7,
    response: 3,
    gloss: 0.5,
    exposure: 1,
    original: false,
    frozen: false,
    // 0: the painted island; 1: a monochrome technical print on silver foil (like the Sonic cartridge's label).
    art: 0,
};
export type FoilSettings = typeof foilDefaults;
export type FoilRenderer = {
    update(settings: FoilSettings): void;
    dispose(): void;
};

const vertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }
`;
/*
 * The foil (owner: the holograms «слишком резко за курсором идут и ощущаются как наложенные картинки», «плотность
 * слабая», «на картридже они почти одна на другую накладывались»): stamped hologram discs packed over the whole label
 * on a jittered hexagonal grid, a little over each other (where they overlap the later stamp covers the earlier).
 * Each is a diffraction grating, lit by a lamp up left and seen by a fixed eye, and the card tilts after the cursor
 * (a spring, so it lags and settles like a card in the hand). What a point shows follows the grating equation: with
 * q = the in-plane parts of the unit vectors to the lamp and to the eye, light leaves in order m where q is along the
 * grating vector g, at wavelength λ = d·|q·g|/m — so a disc lights only where that holds and is clear glass elsewhere,
 * and every disc, sitting elsewhere under the lamp, answers differently. A disc is a starburst of 48–96 thin wedges, each a
 * patch of grooves across its own direction: a rainbow fan of rays through the centre that swings and changes colour as
 * the card tilts. Plus the mirror glint (q ≈ 0), a faint foil sheen and an embossed rim.
 */
const fragment = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uArtwork;
uniform vec2 uCrop;
uniform float uImageAspect;
uniform float uStrength;
uniform float uScale;
uniform float uDensity;
uniform float uGloss;
uniform float uExposure;
uniform bool uOriginal;
// 1: silver foil (the print's tone is the metal's brightness, a broad sheen moves with the tilt, and fine random
// grating dots glitter everywhere, like a dot-matrix hologram); 0: a clear laminate over a colour print.
uniform float uMetal;
// The lamp and the eye in the card's frame (units of the artwork's height, the card's centre at the origin, z out).
uniform vec3 uLight;
uniform vec3 uEye;
const float TAU=6.2831853;
const float PI=3.14159265;
float hash12(vec2 p){vec3 q=fract(vec3(p.xyx)*0.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec4 hash42(vec2 p){vec4 q=fract(vec4(p.xyxy)*vec4(0.1031,0.103,0.0973,0.1099));q+=dot(q,q.wzxy+33.33);return fract((q.xxyz+q.yzzw)*q.zywx);}
vec3 spectral(float w){
    if(w<380.0||w>740.0) return vec3(0.0);
    float r=exp(-pow((w-605.0)/48.0,2.0))+0.22*exp(-pow((w-430.0)/22.0,2.0));
    float g=exp(-pow((w-545.0)/42.0,2.0));
    float b=exp(-pow((w-455.0)/30.0,2.0));
    return vec3(r,g,b)*smoothstep(380.0,410.0,w)*(1.0-smoothstep(700.0,740.0,w));
}
// Light diffracted by a grating with vector g (unit, across the grooves) and pitch d (nm), for in-plane q; spread: how
// wide the bright locus is (the lamp's size).
vec3 grating(vec2 q,vec2 g,float d,float spread){
    float along=abs(dot(q,g));
    float across=dot(q,vec2(-g.y,g.x));
    float w=exp(-across*across/(spread*spread));
    vec3 c=spectral(d*along)+spectral(d*along*0.5)*0.55+spectral(d*along/3.0)*0.3;
    return c*w;
}
void main() {
    vec2 uv=(vUv-0.5)*uCrop+0.5;
    vec3 ink=texture2D(uArtwork,uv).rgb;
    if(uOriginal) {
        gl_FragColor=vec4(ink,1.0);
    } else {
        vec2 p=(uv-0.5)*vec2(uImageAspect,1.0);
        vec3 P=vec3(p,0.0);
        vec3 l=normalize(uLight-P);
        vec3 v=normalize(uEye-P);
        vec2 q=l.xy+v.xy;
        float luma=dot(ink,vec3(0.2126,0.7152,0.0722));
        vec3 base=ink;
        if(uMetal>0.5){
            float sheen=exp(-dot(q,q)/0.45);
            base=mix(vec3(0.05,0.055,0.07),vec3(0.82,0.85,0.9),pow(luma,1.5))*(0.62+0.8*sheen);
            vec2 cf=p*300.0;
            vec2 cell=floor(cf);
            vec4 hc=hash42(cell+3.7);
            float ga=hc.x*TAU;
            base+=grating(q,vec2(cos(ga),sin(ga)),700.0+300.0*hc.y,0.22)*(0.15+0.5*luma)*0.55*uStrength*step(0.35,hc.z)*(1.0-smoothstep(0.25,0.4,length(fract(cf)-0.5)));
        }
        // The stamps: a jittered hexagonal grid, uDensity across the height; the topmost one covering this point.
        float s=1.0/uDensity;
        vec2 hp=p/s;
        float row=floor(hp.y/0.8660254+0.5);
        float best=-1.0;
        vec2 bc=vec2(0.0);
        float bR=0.0;
        vec4 bh=vec4(0.0);
        for(int j=-1;j<=1;j++){
            for(int i=-1;i<=1;i++){
                float rj=row+float(j);
                float ci=floor(hp.x-0.5*mod(rj,2.0)+0.5)+float(i);
                vec2 id=vec2(ci,rj);
                vec4 h=hash42(id+17.0);
                vec2 c=(vec2(ci+0.5*mod(rj,2.0),rj*0.8660254)+(h.xy-0.5)*0.3)*s;
                float R=s*0.6*uScale*(0.85+0.3*h.z);
                if(length(p-c)<R&&h.w>best){best=h.w;bc=c;bR=R;bh=h;}
            }
        }
        vec3 color=base;
        if(best>=0.0){
            vec2 d=p-bc;
            float r=length(d);
            float aa=max(fwidth(r)*1.5,0.0015);
            float mask=1.0-smoothstep(bR-aa,bR,r);
            vec2 gr=d/max(r,1e-5);
            // A starburst: n wedges, each a patch of grooves across its own direction (a little off, per wedge). Where q
            // runs along a wedge's grating vector it lights, each in its own colour: a rainbow fan of rays through the
            // centre, pointing the way the lamp is, swinging and changing colour as the card tilts.
            float n=floor(48.0+48.0*bh.z);
            float a=atan(d.y,d.x)+bh.y*TAU;
            float f=a/(TAU/n);
            float k=floor(f);
            float wj=hash12(vec2(k,best*91.0));
            float ga=(k+0.5)*TAU/n-bh.y*TAU+(wj-0.5)*0.12;
            float pitch=(600.0+400.0*bh.x)*(0.94+0.12*wj);
            float spread=0.4+0.2*bh.w;
            vec3 diff=grating(q,vec2(cos(ga),sin(ga)),pitch,spread);
            // The wedges' seams (thin, fading where they would alias near the centre).
            float seam=abs(fract(f)-0.5)*2.0;
            float seamW=fwidth(f)*1.5;
            diff*=1.0-0.75*smoothstep(1.0-seamW*2.0,1.0-seamW*0.5,seam)*(1.0-smoothstep(0.15,0.4,seamW));
            // Each ray its own brightness, brightest towards the centre (a starburst).
            diff*=(0.6+0.4*wj)*mix(1.15,0.5,r/bR);
            // The very centre: a small mirror boss.
            diff*=smoothstep(bR*0.05,bR*0.12,r);
            // The fine grooves themselves show a little (a faint ring texture that fades where it would alias).
            float groove=0.92+0.08*sin(r*s*2600.0)*(1.0-smoothstep(0.2,0.6,fwidth(r*s*2600.0)));
            float lit=uMetal>0.5?0.3+0.9*luma:0.55+0.45*sqrt(luma);
            // A clear laminate over the print: the ink shows through, a touch darker.
            color=base*(1.0-0.06*mask)+(diff*uStrength*1.6*lit*groove+vec3(0.035,0.038,0.042)*uGloss)*mask;
            // The mirror glint (the lamp's reflection, q near 0) and the embossed rim catching the lamp.
            float glint=exp(-dot(q,q)/0.006);
            float rimX=clamp((r-(bR-0.012))/0.012,0.0,1.0);
            vec3 nr=normalize(vec3(gr*(rimX-0.5)*1.4*step(bR-0.012,r),1.0));
            float rim=pow(max(dot(reflect(-l,nr),v),0.0),40.0)*step(bR-0.012,r);
            color+=vec3(0.92,0.98,1.0)*uGloss*(glint*0.8+rim*0.6)*mask;
        }
        color*=uExposure;
        color=color/(1.0+max(color-0.85,0.0)*0.4);
        gl_FragColor=vec4(color,1.0);
    }
    #include <colorspace_fragment>
}
`;

export function createFoilRenderer(
    canvas: HTMLCanvasElement,
    initial: FoilSettings,
    onReady: () => void,
    onSize: (width: number, height: number, dpr: number) => void,
    onError: (message: string) => void,
    /** A page's background: the card tilts after the cursor anywhere in the window; `instant`: straight to where it
     * points, no spring (owner, group 1777: «реакция на курсор мгновенная»). */
    options: { pointerTarget?: EventTarget; instant?: boolean; pointerPoint?: (event: PointerEvent, bounds: DOMRect) => { clientX: number; clientY: number } } = {},
): FoilRenderer {
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    let settings = { ...initial },
        disposed = false,
        frame = 0,
        lastTime = 0;
    // The card's tilt (radians about y and x) and its rate: a critically damped spring after the cursor.
    const target = new THREE.Vector2(-0.1, 0.06),
        tilt = target.clone(),
        rate = new THREE.Vector2();
    // The lamp up left in front, the eye straight in front (units of the artwork's height).
    const LIGHT = new THREE.Vector3(-1.6, 1.8, 2.6),
        EYE = new THREE.Vector3(0, 0, 2.4);
    const inCard = (w: THREE.Vector3, out: THREE.Vector3) => {
        // Into the tilted card's frame: the inverse of its turn about y (tilt.x), then about x (tilt.y).
        const cy = Math.cos(tilt.x), sy = Math.sin(tilt.x);
        const cx = Math.cos(tilt.y), sx = Math.sin(tilt.y);
        const x = w.x * cy - w.z * sy;
        const z1 = w.x * sy + w.z * cy;
        out.set(x, w.y * cx + z1 * sx, -w.y * sx + z1 * cx);
        return out;
    };
    const uniforms = {
        uArtwork: { value: null as THREE.Texture | null },
        uCrop: { value: new THREE.Vector2(1, 1) },
        uLight: { value: LIGHT.clone() },
        uEye: { value: EYE.clone() },
        uImageAspect: { value: 1.5 },
        uStrength: { value: initial.strength },
        uScale: { value: initial.scale },
        uDensity: { value: initial.density },
        uGloss: { value: initial.gloss },
        uExposure: { value: initial.exposure },
        uOriginal: { value: initial.original },
        uMetal: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.Camera();
    const resize = () => {
        const { width, height } = canvas.getBoundingClientRect();
        if (!width || !height) return;
        const dpr = Math.min(
            window.devicePixelRatio || 1,
            3,
            Math.sqrt(9_000_000 / (width * height)),
        );
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height, false);
        const ratio = width / height / uniforms.uImageAspect.value;
        uniforms.uCrop.value.set(Math.min(1, ratio), Math.min(1, 1 / ratio));
        onSize(canvas.width, canvas.height, dpr);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener('resize', resize);
    resize();
    const pointer = (event: PointerEvent) => {
        if (settings.frozen) return;
        const rect = canvas.getBoundingClientRect();
        // Up to about ±17° each way across the picture.
        const aim = options.pointerPoint?.(event, rect) ?? event;
        target.set(
            THREE.MathUtils.clamp(
                ((aim.clientX - rect.left) / rect.width) * 2 - 1,
                -1,
                1,
            ) * 0.3,
            THREE.MathUtils.clamp(
                1 - ((aim.clientY - rect.top) / rect.height) * 2,
                -1,
                1,
            ) * 0.3,
        );
    };
    const pointerSource: EventTarget = options.pointerTarget ?? canvas;
    pointerSource.addEventListener('pointermove', pointer as EventListener);
    pointerSource.addEventListener('pointerdown', pointer as EventListener);
    const contextLost = (event: Event) => {
        event.preventDefault();
        cancelAnimationFrame(frame);
        onError('Графический контекст потерян. Перезагрузите страницу.');
    };
    canvas.addEventListener('webglcontextlost', contextLost);
    renderer.debug.onShaderError = (
        gl,
        program,
        vertexShader,
        fragmentShader,
    ) => {
        console.error(
            '[holographic-foil]',
            gl.getProgramInfoLog(program),
            gl.getShaderInfoLog(vertexShader),
            gl.getShaderInfoLog(fragmentShader),
        );
        cancelAnimationFrame(frame);
        onError('Не удалось создать голографический материал.');
    };
    let island: THREE.Texture | null = null;
    let tech: THREE.CanvasTexture | null = null;
    let readyCalled = false;
    const showArt = () => {
        const metal = settings.art === 1;
        if (metal && !tech) {
            tech = new THREE.CanvasTexture(drawTechArtwork());
            tech.colorSpace = THREE.SRGBColorSpace;
            tech.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        }
        const tex = metal ? tech : island;
        if (!tex) return;
        uniforms.uArtwork.value = tex;
        uniforms.uImageAspect.value = metal ? TECH_ASPECT : tex.image.width / tex.image.height;
        uniforms.uMetal.value = metal ? 1 : 0;
        resize();
        if (!readyCalled) {
            readyCalled = true;
            onReady();
        }
    };
    const render = profileEffectFrame(canvas, (time: number) => {
        if (disposed) return;
        frame = requestAnimationFrame(render);
        if (!uniforms.uArtwork.value) return;
        const dt = Math.min(Math.max((time - lastTime) / 1000, 0), 0.05);
        lastTime = time;
        if (document.hidden) return;
        if (!settings.frozen && options.instant) {
            tilt.copy(target);
            rate.set(0, 0);
        } else if (!settings.frozen) {
            // Two half steps keep the spring steady at a slow frame.
            const k = settings.response;
            for (let i = 0; i < 2; i += 1) {
                const h = dt / 2;
                rate.x += ((target.x - tilt.x) * k * k - 2 * k * rate.x) * h;
                rate.y += ((target.y - tilt.y) * k * k - 2 * k * rate.y) * h;
                tilt.x += rate.x * h;
                tilt.y += rate.y * h;
            }
        }
        inCard(LIGHT, uniforms.uLight.value);
        inCard(EYE, uniforms.uEye.value);
        renderer.render(scene, camera);
    });
    const texture = new THREE.TextureLoader().load(
        artwork,
        (loaded) => {
            if (disposed) {
                loaded.dispose();
                return;
            }
            loaded.colorSpace = THREE.SRGBColorSpace;
            loaded.anisotropy = Math.min(
                8,
                renderer.capabilities.getMaxAnisotropy(),
            );
            island = loaded;
            showArt();
        },
        undefined,
        (error) => {
            if (!disposed && settings.art !== 1) {
                console.error('[holographic-foil] Artwork load failed', error);
                onError('Не удалось загрузить иллюстрацию.');
            }
        },
    );
    frame = requestAnimationFrame(render);
    showArt();
    return {
        update(next) {
            const artChanged = next.art !== settings.art;
            settings = { ...next };
            if (artChanged) showArt();
            uniforms.uStrength.value = next.strength;
            uniforms.uScale.value = next.scale;
            uniforms.uDensity.value = next.density;
            uniforms.uGloss.value = next.gloss;
            uniforms.uExposure.value = next.exposure;
            uniforms.uOriginal.value = next.original;
        },
        dispose() {
            disposed = true;
            cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener('resize', resize);
            pointerSource.removeEventListener('pointermove', pointer as EventListener);
            pointerSource.removeEventListener('pointerdown', pointer as EventListener);
            canvas.removeEventListener('webglcontextlost', contextLost);
            texture.dispose();
            tech?.dispose();
            material.dispose();
            geometry.dispose();
            renderer.dispose();
        },
    };
}
