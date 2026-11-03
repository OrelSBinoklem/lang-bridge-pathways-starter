/**
 * The kaleidoscope's picture in HDR (WebGPU): a canvas of its own under the scene's 2D canvas, configured for extended
 * range ('rgba16float', toneMapping 'extended'), where the honeycomb is put together — every eyepiece six copies of
 * the traced triangle, every other one mirrored, as composeHex does on the 2D canvas — from the tracer's float result
 * (kaleidoscopeGlass.ts, render with hdrPeak > 1), so the lamps' glints can go brighter than white, up to the monitor's
 * peak. The 2D canvas above keeps the frames, the buttons and the panels.
 *
 * Chrome takes a float canvas's values as sRGB-encoded (extended): 0.5 there is the grey that 128 is on a 2D canvas
 * (checked side by side), and whatever is above 1 is brighter than SDR white. The tracer writes them with the exact
 * sRGB curve (the darks as a gamma-2.2 monitor shows them in SDR), and only the glints go beyond white.
 *
 * Only where it can work: a display that reports high dynamic range (the '(dynamic-range: high)' media query — the
 * system's HDR switched on) and WebGPU with extended tone mapping. Anywhere else the scene draws as before.
 */

export type HdrFrame = {
  /** The honeycomb: the eyepiece's radius, the origin of the grid, the triangle's margin (all css px). */
  R: number;
  ox: number;
  oy: number;
  m: number;
  /** The traced triangle's pixels per css px. */
  triDpr: number;
  /** How much the eyepieces darken towards their rim (kalVignette). */
  vignette: number;
  /** A pulled eyepiece: its home centre, offset, scale and how far it is lifted (0…1); null when none. */
  grab: { cx: number; cy: number; ox: number; oy: number; scale: number; lift: number } | null;
  /** The calibration strip (css px), while the settings panel shows it; null otherwise. */
  strip: { x: number; y: number; w: number; h: number } | null;
};

/**
 * The calibration strip's patches, in multiples of SDR white: each a small square at that brightness on a ground at
 * STRIP_GROUND. Where the monitor reaches its peak both clip to the same light and the square vanishes: the last one
 * still seen is the peak (as HDR calibration screens in games do it).
 */
export const STRIP_VALUES = [1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10];
const STRIP_GROUND = 12;

const SHADER = /* wgsl */ `
struct U {
  size: vec2f,
  dpr: f32,
  R: f32,
  origin: vec2f,
  m: f32,
  triDpr: f32,
  vignette: f32,
  lift: f32,
  grabOn: f32,
  grabScale: f32,
  grabC: vec2f,
  grabOff: vec2f,
  strip: vec4f,
  stripOn: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var tri: texture_2d<f32>;

const PI = 3.14159265;

// Linear light (multiples of SDR white) to the canvas's extended sRGB.
fn srgbEnc(y: f32) -> f32 {
  return select(1.055 * pow(y, 1.0 / 2.4) - 0.055, 12.92 * y, y < 0.0031308);
}
const SQ3 = 1.7320508;

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(p[i], 0.0, 1.0);
}

// The triangle's texture, bilinear (a float texture is not filterable by the sampler). Its rows come bottom up (as
// WebGL reads them).
fn triSample(q: vec2f) -> vec3f {
  let size = vec2i(textureDimensions(tri));
  let p = (q + vec2f(u.m)) * u.triDpr - 0.5;
  let i0 = vec2i(floor(p));
  let f = p - floor(p);
  var c = vec3f(0.0);
  for (var k = 0; k < 4; k++) {
    let o = vec2i(k & 1, k >> 1);
    let ij = clamp(i0 + o, vec2i(0), size - 1);
    let w = select(1.0 - f.x, f.x, o.x == 1) * select(1.0 - f.y, f.y, o.y == 1);
    c += textureLoad(tri, vec2i(ij.x, size.y - 1 - ij.y), 0).rgb * w;
  }
  return c;
}

// A point of an eyepiece (css px from its centre, y down) back into the triangle: sector k of six; even ones the
// triangle turned by k·60°, odd ones mirrored in the shared edge.
fn eyepiece(local: vec2f) -> vec3f {
  var a = atan2(local.y, local.x);
  if (a < 0.0) { a += 2.0 * PI; }
  let k = min(floor(a / (PI / 3.0)), 5.0);
  var ang = k * PI / 3.0;
  let odd = (i32(k) & 1) == 1;
  if (odd) { ang = (k + 1.0) * PI / 3.0; }
  let cs = cos(ang);
  let sn = sin(ang);
  var q = vec2f(cs * local.x + sn * local.y, -sn * local.x + cs * local.y);
  if (odd) { q.y = -q.y; }
  var col = triSample(q);
  let r = length(local);
  col *= 1.0 - 0.38 * u.vignette * clamp((r - 0.55 * u.R) / (0.47 * u.R), 0.0, 1.0);
  return col;
}

// Distance to a hexagon of radius R with corners at 0°, 60°… (flat top), negative inside.
fn hexSdf(p: vec2f, R: f32) -> f32 {
  let a = abs(p);
  return max(0.8660254 * a.x + 0.5 * a.y, a.y) - 0.8660254 * R;
}

// The centre of the eyepiece a point is in (axial rounding, as hexAt in kaleidoscope.ts).
fn hexCentre(p: vec2f) -> vec2f {
  let px = (p.x - u.origin.x) / u.R;
  let py = (p.y - u.origin.y) / u.R;
  let q = (2.0 / 3.0) * px;
  let r = (-1.0 / 3.0) * px + (SQ3 / 3.0) * py;
  let s = -q - r;
  var rq = round(q);
  var rr = round(r);
  let rs = round(s);
  let dq = abs(rq - q);
  let dr = abs(rr - r);
  let ds = abs(rs - s);
  if (dq > dr && dq > ds) { rq = -rr - rs; } else if (dr > ds) { rr = -rq - rs; }
  return u.origin + u.R * vec2f(1.5 * rq, SQ3 * (rr + rq / 2.0));
}

const STRIP = array<f32, 10>(${STRIP_VALUES.map((v) => v.toFixed(2)).join(', ')});

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let p = pos.xy / u.dpr;
  // The calibration strip: ten patches, a small square at the patch's brightness on a ground far above any peak.
  if (u.stripOn > 0.5 && p.x >= u.strip.x && p.x < u.strip.x + u.strip.z && p.y >= u.strip.y && p.y < u.strip.y + u.strip.w) {
    let fx = (p.x - u.strip.x) / u.strip.z * 10.0;
    let i = min(i32(floor(fx)), 9);
    let lx = fract(fx);
    let ly = (p.y - u.strip.y) / u.strip.w;
    if (lx < 0.06) { return vec4f(0.0, 0.0, 0.0, 1.0); }
    var v = ${STRIP_GROUND.toFixed(1)};
    if (abs(lx - 0.53) < 0.2 && abs(ly - 0.5) < 0.25) { v = STRIP[i]; }
    return vec4f(vec3f(srgbEnc(v)), 1.0);
  }
  let c = hexCentre(p);
  var col: vec3f;
  let grabbed = u.grabOn > 0.5;
  // The hole a pulled eyepiece was lifted out of is black.
  if (grabbed && distance(c, u.grabC) < 1.0) { col = vec3f(0.0); } else { col = eyepiece(p - c); }
  if (grabbed) {
    // Its shadow on the others, a little below it and soft, then the eyepiece itself, a little bigger.
    let centre = u.grabC + u.grabOff;
    let d = hexSdf((p - centre - vec2f(0.0, 10.0 * u.lift)) / u.grabScale, u.R) * u.grabScale;
    let soft = max(12.0 * u.lift, 1.0);
    col *= 1.0 - 0.6 * u.lift * (1.0 - smoothstep(-soft, soft, d));
    let lq = (p - centre) / u.grabScale;
    if (hexSdf(lq, u.R) < 0.0) { col = eyepiece(lq); }
  }
  return vec4f(col, 1.0);
}`;

// The few WebGPU calls used here, typed locally (TypeScript's DOM library has no WebGPU; a types package would be a
// new dependency on the server's build).
type GpuTexture = { width: number; height: number; createView(): unknown; destroy(): void };
type GpuBuffer = { destroy(): void };
type GpuPass = { setPipeline(p: unknown): void; setBindGroup(i: number, g: unknown): void; draw(n: number): void; end(): void };
type GpuDevice = {
  createShaderModule(d: { code: string }): unknown;
  createRenderPipeline(d: object): { getBindGroupLayout(i: number): unknown };
  createBuffer(d: { size: number; usage: number }): GpuBuffer;
  createTexture(d: { size: number[]; format: string; usage: number }): GpuTexture;
  createBindGroup(d: object): unknown;
  createCommandEncoder(): { beginRenderPass(d: object): GpuPass; finish(): unknown };
  queue: {
    writeTexture(dst: object, data: Float32Array, layout: object, size: object): void;
    writeBuffer(b: GpuBuffer, offset: number, data: Float32Array): void;
    submit(c: unknown[]): void;
  };
  destroy(): void;
};
type GpuCanvasContext = {
  configure(c: object): void;
  getCurrentTexture(): GpuTexture;
  getConfiguration?(): { toneMapping?: { mode?: string } } | null;
};
type Gpu = { requestAdapter(): Promise<{ requestDevice(): Promise<GpuDevice> } | null> };
/** GPUBufferUsage.UNIFORM | COPY_DST, GPUTextureUsage.TEXTURE_BINDING | COPY_DST. */
const BUFFER_UNIFORM_COPY = 0x40 | 0x08;
const TEXTURE_BINDING_COPY = 0x04 | 0x02;

export type HdrPresenter = NonNullable<Awaited<ReturnType<typeof createHdrPresenter>>>;

const mql = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(dynamic-range: high)') : null;
/** For testing the HDR path without an HDR display: localStorage.kalHdrForce = '1' (values above 1 then just clip). */
const forced = () => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('kalHdrForce') === '1';
  } catch {
    return false;
  }
};
/** Whether the display is in HDR now (the system's HDR switched on); follow it every frame. */
export const hdrQuery = mql ? { get matches() { return mql.matches || forced(); } } : null;

/** A WebGPU canvas under `host` that shows the honeycomb in extended range, or null where that cannot be done. */
export async function createHdrPresenter(host: HTMLCanvasElement) {
  if (!hdrQuery?.matches || !('gpu' in navigator) || !host.parentElement) return null;
  const gpu = (navigator as Navigator & { gpu: Gpu }).gpu;
  const adapter = await gpu.requestAdapter().catch(() => null);
  if (!adapter) return null;
  const device = await adapter.requestDevice().catch(() => null);
  if (!device) return null;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  // The browser may hold HDR content back (constrained-high); this canvas may use the whole headroom.
  canvas.style.setProperty('dynamic-range-limit', 'no-limit');
  canvas.width = Math.max(1, host.width);
  canvas.height = Math.max(1, host.height);
  const ctx = canvas.getContext('webgpu') as unknown as GpuCanvasContext | null;
  if (!ctx) {
    device.destroy();
    return null;
  }
  try {
    ctx.configure({ device, format: 'rgba16float', toneMapping: { mode: 'extended' }, alphaMode: 'opaque' });
  } catch {
    device.destroy();
    return null;
  }
  // A browser that knows no extended tone mapping drops the member silently: then this is no HDR.
  const cfg = ctx.getConfiguration?.();
  if (cfg && cfg.toneMapping?.mode !== 'extended') {
    device.destroy();
    return null;
  }
  host.parentElement.insertBefore(canvas, host);

  const shaderModule = device.createShaderModule({ code: SHADER });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: shaderModule, entryPoint: 'vs' },
    fragment: { module: shaderModule, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] },
    primitive: { topology: 'triangle-list' },
  });
  const uniforms = device.createBuffer({ size: 96, usage: BUFFER_UNIFORM_COPY });
  const uData = new Float32Array(24);
  let tex: GpuTexture | null = null;
  let bind: unknown = null;
  let has = false;

  return {
    canvas,
    /** The traced triangle, as the tracer read it back (RGBA float, rows bottom up). */
    upload(data: Float32Array, width: number, height: number) {
      if (!tex || tex.width !== width || tex.height !== height) {
        tex?.destroy();
        tex = device.createTexture({ size: [width, height], format: 'rgba32float', usage: TEXTURE_BINDING_COPY });
        bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniforms } }, { binding: 1, resource: tex.createView() }] });
      }
      device.queue.writeTexture({ texture: tex }, data, { bytesPerRow: width * 16, rowsPerImage: height }, { width, height });
      has = true;
    },
    /** Shown (under the 2D canvas) or not: when not, the scene draws its SDR picture on the 2D canvas as before. */
    set visible(v: boolean) {
      canvas.style.display = v ? 'block' : 'none';
    },
    draw(f: HdrFrame) {
      if (!has || !bind) return;
      if (canvas.width !== host.width || canvas.height !== host.height) {
        canvas.width = Math.max(1, host.width);
        canvas.height = Math.max(1, host.height);
      }
      const cssW = host.getBoundingClientRect().width || host.width;
      const dpr = host.width / cssW;
      const g = f.grab;
      const st = f.strip;
      uData.set([canvas.width, canvas.height, dpr, f.R, f.ox, f.oy, f.m, f.triDpr, f.vignette, g ? g.lift : 0, g ? 1 : 0, g ? g.scale : 1, g ? g.cx : 0, g ? g.cy : 0, g ? g.ox : 0, g ? g.oy : 0,
        st ? st.x : 0, st ? st.y : 0, st ? st.w : 0, st ? st.h : 0, st ? 1 : 0, 0, 0, 0]);
      device.queue.writeBuffer(uniforms, 0, uData);
      const enc = device.createCommandEncoder();
      const pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bind);
      pass.draw(3);
      pass.end();
      device.queue.submit([enc.finish()]);
    },
    dispose() {
      canvas.remove();
      tex?.destroy();
      uniforms.destroy();
      device.destroy();
    },
  };
}
