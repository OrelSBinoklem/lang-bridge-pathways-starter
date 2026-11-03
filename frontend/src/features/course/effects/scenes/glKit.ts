/**
 * Small WebGL2 toolkit shared by the LED cube (ledCubeGL.ts) and the fireworks (fireworksGL.ts): programs, render
 * targets in linear light (half float when the GPU can render into it, 8-bit otherwise), a bloom pyramid (halve the
 * picture several times, then add the levels back up with a tent filter) and a full-screen triangle.
 */

export type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number };
export type Program = { p: WebGLProgram; u: (name: string) => WebGLUniformLocation | null };

export const FULL_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const DOWN_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uTexel;
out vec4 o;
void main() {
  o = (texture(uSrc, vUv + uTexel * vec2(-1.0, -1.0)) + texture(uSrc, vUv + uTexel * vec2(1.0, -1.0))
    + texture(uSrc, vUv + uTexel * vec2(-1.0, 1.0)) + texture(uSrc, vUv + uTexel * vec2(1.0, 1.0))) * 0.25;
}`;

const UP_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uBase;
uniform sampler2D uSmall;
uniform vec2 uTexel;
out vec4 o;
void main() {
  vec4 s = texture(uSmall, vUv) * 4.0;
  s += (texture(uSmall, vUv + vec2(uTexel.x, 0.0)) + texture(uSmall, vUv - vec2(uTexel.x, 0.0))
      + texture(uSmall, vUv + vec2(0.0, uTexel.y)) + texture(uSmall, vUv - vec2(0.0, uTexel.y))) * 2.0;
  s += texture(uSmall, vUv + uTexel) + texture(uSmall, vUv - uTexel)
      + texture(uSmall, vUv + vec2(uTexel.x, -uTexel.y)) + texture(uSmall, vUv + vec2(-uTexel.x, uTexel.y));
  o = texture(uBase, vUv) + s / 16.0;
}`;

/** GLSL: ACES filmic curve and linear → sRGB. */
export const TONEMAP_GLSL = `
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
`;

export function createKit(canvas: HTMLCanvasElement, label: string, attrs: WebGLContextAttributes = {}) {
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: true, ...attrs });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const g = gl;
  /** Half-float targets need EXT_color_buffer_float; without it bright light is stored scaled down in 8 bits. */
  const hdr = !!g.getExtension('EXT_color_buffer_float');
  const programs: WebGLProgram[] = [];
  const textures: WebGLTexture[] = [];
  const framebuffers: WebGLFramebuffer[] = [];
  const buffers: WebGLBuffer[] = [];
  const arrays: WebGLVertexArrayObject[] = [];

  const shader = (type: number, src: string) => {
    const s = g.createShader(type);
    if (!s) return null;
    g.shaderSource(s, src);
    g.compileShader(s);
    if (!g.getShaderParameter(s, g.COMPILE_STATUS)) {
      console.error(`[${label}] shader:`, g.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const program = (vs: string, fs: string): Program | null => {
    const v = shader(g.VERTEX_SHADER, vs);
    const f = shader(g.FRAGMENT_SHADER, fs);
    const p = g.createProgram();
    if (!v || !f || !p) return null;
    g.attachShader(p, v);
    g.attachShader(p, f);
    g.linkProgram(p);
    g.deleteShader(v);
    g.deleteShader(f);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) {
      console.error(`[${label}] program:`, g.getProgramInfoLog(p));
      return null;
    }
    programs.push(p);
    const cache = new Map<string, WebGLUniformLocation | null>();
    return {
      p,
      u: (name) => {
        if (!cache.has(name)) cache.set(name, g.getUniformLocation(p, name));
        return cache.get(name)!;
      },
    };
  };
  const texture = (w: number, h: number, linearLight: boolean) => {
    const t = g.createTexture()!;
    g.bindTexture(g.TEXTURE_2D, t);
    if (linearLight && hdr) g.texImage2D(g.TEXTURE_2D, 0, g.RGBA16F, w, h, 0, g.RGBA, g.HALF_FLOAT, null);
    else g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    textures.push(t);
    return t;
  };
  const target = (w: number, h: number, linearLight = true): Target | null => {
    const tex = texture(w, h, linearLight);
    const fbo = g.createFramebuffer()!;
    framebuffers.push(fbo);
    g.bindFramebuffer(g.FRAMEBUFFER, fbo);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
    const ok = g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE;
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    return ok ? { tex, fbo, w, h } : null;
  };
  const into = (t: Target | null) => {
    g.bindFramebuffer(g.FRAMEBUFFER, t ? t.fbo : null);
    g.viewport(0, 0, t ? t.w : g.drawingBufferWidth, t ? t.h : g.drawingBufferHeight);
  };
  const bind = (unit: number, tex: WebGLTexture, loc: WebGLUniformLocation | null, kind: number = g.TEXTURE_2D) => {
    g.activeTexture(g.TEXTURE0 + unit);
    g.bindTexture(kind, tex);
    g.uniform1i(loc, unit);
  };
  const emptyVao = g.createVertexArray()!;
  arrays.push(emptyVao);
  const fullscreen = () => {
    g.bindVertexArray(emptyVao);
    g.drawArrays(g.TRIANGLES, 0, 3);
  };

  /** A bloom pyramid over a `w`×`h` picture: `run(src)` returns the blurred sum at half size (levels added up). */
  const bloom = (w: number, h: number, levels: number) => {
    const downProg = program(FULL_VS, DOWN_FS);
    const upProg = program(FULL_VS, UP_FS);
    if (!downProg || !upProg) return null;
    const down: Target[] = [];
    const up: Target[] = [];
    for (let i = 0, lw = w, lh = h; i < levels; i += 1) {
      lw = Math.max(1, Math.round(lw / 2));
      lh = Math.max(1, Math.round(lh / 2));
      const d = target(lw, lh);
      const u = target(lw, lh);
      if (!d || !u) return null;
      down.push(d);
      up.push(u);
    }
    return {
      levels,
      run(src: Target): Target {
        g.disable(g.BLEND);
        g.useProgram(downProg.p);
        let from = src;
        for (const d of down) {
          into(d);
          bind(0, from.tex, downProg.u('uSrc'));
          g.uniform2f(downProg.u('uTexel'), 1 / from.w, 1 / from.h);
          fullscreen();
          from = d;
        }
        g.useProgram(upProg.p);
        let small = down[levels - 1];
        for (let i = levels - 2; i >= 0; i -= 1) {
          into(up[i]);
          bind(0, down[i].tex, upProg.u('uBase'));
          bind(1, small.tex, upProg.u('uSmall'));
          g.uniform2f(upProg.u('uTexel'), 1 / small.w, 1 / small.h);
          fullscreen();
          small = up[i];
        }
        return up[0];
      },
    };
  };

  return {
    gl: g,
    hdr,
    program,
    target,
    texture,
    into,
    bind,
    fullscreen,
    bloom,
    track: {
      buffer(b: WebGLBuffer) {
        buffers.push(b);
        return b;
      },
      vao(v: WebGLVertexArrayObject) {
        arrays.push(v);
        return v;
      },
      texture(t: WebGLTexture) {
        textures.push(t);
        return t;
      },
    },
    lost: () => g.isContextLost(),
    dispose() {
      if (!g.isContextLost()) {
        for (const p of programs) g.deleteProgram(p);
        for (const t of textures) g.deleteTexture(t);
        for (const f of framebuffers) g.deleteFramebuffer(f);
        for (const b of buffers) g.deleteBuffer(b);
        for (const a of arrays) g.deleteVertexArray(a);
      }
      g.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

export type Kit = NonNullable<ReturnType<typeof createKit>>;
