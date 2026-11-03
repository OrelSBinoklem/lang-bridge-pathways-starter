
import { profileEffectFrame } from '../course/effects/effectDiagnostics';
import * as THREE from 'three';
import {
    bakeFragment,
    bakeVertex,
    streetFragment,
    streetVertex,
} from './shaders';

export type StreetSettings = {
    power: number;
    ambient: number;
    exposure: number;
    wet: number;
    parallax: number;
    depthTravel: number;
    depthResponse: number;
    depthStep: number;
    color: string;
    samples: number;
    resolution: number;
    mode: 'scene' | 'original' | 'depth';
    frozen: boolean;
};
export const defaults: StreetSettings = {
    power: 2.4,
    ambient: 0.55,
    exposure: 1,
    wet: 0.8,
    parallax: 0.005,
    depthTravel: 1,
    depthResponse: 5,
    depthStep: 0,
    color: '#ffe2ae',
    samples: 64,
    resolution: 1,
    mode: 'scene',
    frozen: false,
};
export type StreetStats = {
    samples: number;
    target: number;
    width: number;
    height: number;
    dpr: number;
    fps: number;
    triangles: number;
};
export type StreetRenderer = {
    update(settings: StreetSettings): void;
    dispose(): void;
};
export const lightDepths = [
    { distance: 6, label: 'Ближний план' },
    { distance: 14, label: 'Передний план' },
    { distance: 28, label: 'Середина улицы' },
    { distance: 55, label: 'Дальний план' },
    { distance: 100, label: 'В глубине улицы' },
] as const;
const W = 768,
    H = 576,
    ASPECT = 4 / 3,
    TAN = Math.tan(Math.PI / 8);

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
        img.src = src;
    });
}

function imagePixels(image: HTMLImageElement) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(image, 0, 0, W, H);
    return context.getImageData(0, 0, W, H).data;
}

// The network depth is relative. Calibrate the visible ground to a plane; keep
// objects in front of it separate, and never derive depth from photograph brightness.
function makeField(depth: HTMLImageElement) {
    const pixels = imagePixels(depth);
    const data = new Float32Array(W * H * 4);
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
            const u = x / (W - 1),
                v = y / (H - 1);
            let raw = 0,
                weight = 0;
            const center = pixels[((H - 1 - y) * W + x) * 4] / 255;
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                    const px = Math.max(0, Math.min(W - 1, x + dx));
                    const py = Math.max(0, Math.min(H - 1, H - 1 - y + dy));
                    const value = pixels[(py * W + px) * 4] / 255;
                    const k = Math.exp(-Math.abs(value - center) * 60);
                    raw += value * k;
                    weight += k;
                }
            raw /= weight;
            const sky = raw < 0.028;
            let distance = sky ? 110 : 4.8 / (0.04 + 0.96 * Math.pow(raw, 2.3));
            const top = 1 - v;
            const edge =
                u < 0.28 ? 0.59 + (0.28 - u) * 0.25 : 0.59 + (u - 0.28) * 0.26;
            const floorDistance =
                1.6 / Math.max(0.016, 2 * TAN * (0.5 - v) - 0.08);
            const ratio = distance / floorDistance;
            const ground =
                top > edge && ratio > 0.63 && ratio < 1.65
                    ? THREE.MathUtils.smoothstep(top, edge, edge + 0.045)
                    : 0;
            distance = THREE.MathUtils.lerp(
                distance,
                floorDistance,
                ground * 0.96,
            );
            const i = (y * W + x) * 4;
            data[i] = Math.min(distance, 110);
            data[i + 1] = ground;
            data[i + 2] = sky ? 1 : 0;
            data[i + 3] = 1;
        }
    const texture = new THREE.DataTexture(
        data,
        W,
        H,
        THREE.RGBAFormat,
        THREE.FloatType,
    );
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return { data, texture };
}

function makeGeometry(data: Float32Array) {
    const nx = 512,
        ny = 384,
        vertices = (nx + 1) * (ny + 1);
    const positions = new Float32Array(vertices * 3),
        uv = new Float32Array(vertices * 2),
        depths = new Float32Array(vertices);
    for (let y = 0; y <= ny; y++)
        for (let x = 0; x <= nx; x++) {
            const u = x / nx,
                v = y / ny,
                i = y * (nx + 1) + x;
            const depth =
                data[
                    (Math.round(v * (H - 1)) * W + Math.round(u * (W - 1))) * 4
                ];
            depths[i] = depth;
            positions.set(
                [
                    (u * 2 - 1) * TAN * ASPECT * depth,
                    (v * 2 - 1) * TAN * depth,
                    -depth,
                ],
                i * 3,
            );
            uv.set([u, v], i * 2);
        }
    const indices: number[] = [];
    const add = (a: number, b: number, c: number) => {
        const lo = Math.min(depths[a], depths[b], depths[c]),
            hi = Math.max(depths[a], depths[b], depths[c]);
        // Disconnect occlusion edges instead of stretching triangles over silhouettes.
        if (hi - lo < Math.max(0.65, lo * 0.16)) indices.push(a, b, c);
    };
    for (let y = 0; y < ny; y++)
        for (let x = 0; x < nx; x++) {
            const a = y * (nx + 1) + x,
                b = a + 1,
                c = a + nx + 1,
                d = c + 1;
            add(a, b, d);
            add(a, d, c);
        }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
}

export async function createStreetRenderer(
    canvas: HTMLCanvasElement,
    initial: StreetSettings,
    onStats: (stats: StreetStats) => void,
    onError: (error: string) => void,
    signal: AbortSignal,
    onLightPosition: (x: number, y: number) => void,
    /** A page's background: the photograph covers the canvas (no bars), the cursor is followed over the whole window. */
    options: { cover?: boolean; pointerTarget?: EventTarget; pointerPoint?: (event: PointerEvent, bounds: DOMRect) => { clientX: number; clientY: number } } = {},
): Promise<StreetRenderer> {
    const [photoImage, depthImage] = await Promise.all([
        loadImage('/course/street-relight/source.jpg'),
        loadImage('/course/street-relight/depth-v1.png'),
    ]);
    signal.throwIfAborted();
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
    });
    if (
        !renderer.capabilities.isWebGL2 ||
        !renderer.extensions.has('EXT_color_buffer_float')
    ) {
        renderer.dispose();
        throw new Error(
            'Для запекания света нужен WebGL2 с поддержкой float-текстур.',
        );
    }
    renderer.setClearColor('#090b0d');
    renderer.autoClear = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const photo = new THREE.Texture(photoImage);
    photo.colorSpace = THREE.SRGBColorSpace;
    photo.needsUpdate = true;
    photo.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const field = makeField(depthImage),
        geometry = makeGeometry(field.data);
    const bakeWidth = 384,
        bakeHeight = 288;
    const baked = new THREE.WebGLArrayRenderTarget(bakeWidth, bakeHeight, 9, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
    });
    const bakeMaterial = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: bakeVertex,
        fragmentShader: bakeFragment,
        uniforms: {
            uPhoto: { value: photo },
            uField: { value: field.texture },
            uProbe: { value: 0 },
            uSample: { value: 0 },
        },
        depthTest: false,
        depthWrite: false,
        transparent: true,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendEquationAlpha: THREE.AddEquation,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneFactor,
    });
    const bakeScene = new THREE.Scene(),
        bakePlane = new THREE.PlaneGeometry(2, 2);
    bakeScene.add(new THREE.Mesh(bakePlane, bakeMaterial));
    const bakeCamera = new THREE.Camera();
    for (let layer = 0; layer < 9; layer++) {
        renderer.setRenderTarget(baked, layer);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
    }
    renderer.setRenderTarget(null);
    renderer.setClearColor('#090b0d', 1);
    const uniforms = {
        uPhoto: { value: photo },
        uField: { value: field.texture },
        uBake: { value: baked.texture },
        uPointer: { value: new THREE.Vector2(-0.45, 0.3) },
        uAimDepth: { value: Number(lightDepths[initial.depthStep].distance) },
        uDepthTravel: { value: initial.depthTravel },
        uLightColor: { value: new THREE.Color(initial.color) },
        uPower: { value: initial.power },
        uAmbient: { value: initial.ambient },
        uWet: { value: initial.wet },
        uExposure: { value: initial.exposure },
        uIndirect: { value: 1 },
        uMode: { value: 0 },
        uBakeSize: { value: new THREE.Vector2(bakeWidth, bakeHeight) },
    };
    const material = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: streetVertex,
        fragmentShader: streetFragment,
        uniforms,
        side: THREE.DoubleSide,
    });
    const scene = new THREE.Scene(),
        mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    const backgroundGeometry = new THREE.PlaneGeometry(
        2 * TAN * ASPECT * 115,
        2 * TAN * 115,
    );
    const backgroundMaterial = new THREE.MeshBasicMaterial({
        map: photo,
        toneMapped: false,
    });
    const background = new THREE.Mesh<THREE.PlaneGeometry, THREE.Material>(
        backgroundGeometry,
        backgroundMaterial,
    );
    background.position.z = -115;
    scene.add(background);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 180);
    let settings = { ...initial },
        frame = 0,
        disposed = false,
        lastTime = performance.now(),
        lastStats = 0,
        frameCount = 0,
        fps = 60;
    const samples = new Uint16Array(9),
        target = new THREE.Vector2(-0.45, 0.3),
        smoothed = target.clone();
    // Smooth near/far travel in log distance, including the last-to-first wrap.
    let logDepth = Math.log(lightDepths[initial.depthStep].distance);
    let imageWidth = 1,
        imageHeight = 1;
    let width = 1,
        height = 1,
        dpr = 1;
    const resize = () => {
        const rect = canvas.getBoundingClientRect();
        width = Math.max(1, rect.width);
        height = Math.max(1, rect.height);
        imageWidth = options.cover ? Math.max(width, height * ASPECT) : Math.min(width, height * ASPECT);
        imageHeight = imageWidth / ASPECT;
        dpr = Math.min(
            window.devicePixelRatio * settings.resolution,
            3,
            Math.sqrt(9_000_000 / (width * height)),
        );
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.fov = THREE.MathUtils.radToDeg(
            2 * Math.atan(TAN * (options.cover ? Math.min(1, ASPECT / camera.aspect) : Math.max(1, ASPECT / camera.aspect))),
        );
        camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    window.addEventListener('resize', resize);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = (event: PointerEvent) => {
        if (settings.frozen) return;
        const rect = canvas.getBoundingClientRect();
        const aim = options.pointerPoint?.(event, rect) ?? event;
        target.set(
            THREE.MathUtils.clamp(
                ((aim.clientX - rect.left - (width - imageWidth) / 2) /
                    imageWidth) *
                    2 -
                    1,
                -1,
                1,
            ),
            THREE.MathUtils.clamp(
                1 -
                    ((aim.clientY - rect.top - (height - imageHeight) / 2) /
                        imageHeight) *
                        2,
                -1,
                1,
            ),
        );
    };
    const pointerSource: EventTarget = options.pointerTarget ?? canvas;
    pointerSource.addEventListener('pointermove', pointer as EventListener);
    pointerSource.addEventListener('pointerdown', pointer as EventListener);
    const contextLost = (event: Event) => {
        event.preventDefault();
        onError('Графический контекст потерян. Перезагрузите сцену.');
    };
    canvas.addEventListener('webglcontextlost', contextLost);
    let shaderFailed = false;
    renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
        if (!shaderFailed) {
            console.error(
                '[street-relight] Shader failed',
                gl.getProgramInfoLog(program),
                gl.getShaderInfoLog(vertex),
                gl.getShaderInfoLog(fragment),
            );
            onError(
                'Не удалось скомпилировать освещение. Подробности в консоли.',
            );
            shaderFailed = true;
        }
    };
    const tick = profileEffectFrame(canvas, (time: number) => {
        if (disposed || shaderFailed) return;
        frame = requestAnimationFrame(tick);
        const dt = Math.min((time - lastTime) / 1000, 0.1);
        lastTime = time;
        if (document.hidden) return;
        if (!settings.frozen) {
            smoothed.lerp(target, 1 - Math.exp(-dt * 10));
            logDepth = THREE.MathUtils.lerp(
                logDepth,
                Math.log(lightDepths[settings.depthStep].distance),
                1 - Math.exp(-dt * settings.depthResponse),
            );
        }
        uniforms.uPointer.value.copy(smoothed);
        uniforms.uAimDepth.value = Math.exp(logDepth);
        uniforms.uDepthTravel.value = reducedMotion.matches
            ? 0
            : settings.depthTravel;
        onLightPosition(
            (width + smoothed.x * imageWidth) / 2,
            (height - smoothed.y * imageHeight) / 2,
        );
        const shift =
            settings.mode === 'original' || reducedMotion.matches
                ? 0
                : settings.parallax;
        camera.position.set(smoothed.x * shift, smoothed.y * shift * 0.6, 0);
        camera.lookAt(smoothed.x * shift * 0.2, smoothed.y * shift * 0.12, -12);
        if (settings.mode !== 'original') {
            let next = 0;
            for (let i = 1; i < 9; i++)
                if (samples[i] < samples[next]) next = i;
            if (samples[next] < settings.samples) {
                bakeMaterial.uniforms.uProbe.value = next;
                bakeMaterial.uniforms.uSample.value = samples[next];
                renderer.setRenderTarget(baked, next);
                renderer.render(bakeScene, bakeCamera);
                samples[next]++;
            }
        }
        renderer.setRenderTarget(null);
        renderer.clear();
        mesh.visible = settings.mode !== 'original';
        background.material =
            settings.mode === 'original' ? backgroundMaterial : material;
        renderer.render(scene, camera);
        frameCount++;
        if (time - lastStats > 650) {
            fps = (frameCount * 1000) / Math.max(time - lastStats, 1);
            frameCount = 0;
            lastStats = time;
            onStats({
                samples: Math.min(...samples),
                target: settings.samples,
                width: canvas.width,
                height: canvas.height,
                dpr,
                fps: Math.round(fps),
                triangles: geometry.index!.count / 3,
            });
        }
    });
    frame = requestAnimationFrame(tick);
    return {
        update(next) {
            const resolutionChanged = settings.resolution !== next.resolution;
            settings = { ...next };
            uniforms.uPower.value = next.power;
            uniforms.uAmbient.value = next.ambient;
            uniforms.uWet.value = next.wet;
            uniforms.uExposure.value = next.exposure;
            uniforms.uLightColor.value.set(next.color);
            uniforms.uMode.value = next.mode === 'depth' ? 2 : 0;
            if (resolutionChanged) resize();
        },
        dispose() {
            disposed = true;
            cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener('resize', resize);
            pointerSource.removeEventListener('pointermove', pointer as EventListener);
            pointerSource.removeEventListener('pointerdown', pointer as EventListener);
            canvas.removeEventListener('webglcontextlost', contextLost);
            geometry.dispose();
            backgroundGeometry.dispose();
            backgroundMaterial.dispose();
            material.dispose();
            bakePlane.dispose();
            bakeMaterial.dispose();
            baked.dispose();
            photo.dispose();
            field.texture.dispose();
            renderer.dispose();
        },
    };
}
