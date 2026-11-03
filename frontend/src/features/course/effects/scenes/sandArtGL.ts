/**
 * The sand of the sand-art lamp on the GPU (sandArt.ts): a falling-sand cellular automaton on a grid of up to ~1000²
 * cells (about one cell a device pixel), as Margolus blocks — the grid is cut into 2 × 2 blocks, every other pass shifted
 * by one cell, and each block rearranges its four cells by the rules below, so every cell is written by exactly one
 * block and nothing is lost. A grain sinks into an empty cell under it (its colour's chance a pass: fine white sand
 * sinks slowest), or, lying on something, slides down diagonally (its colour's chance: fine sand slides further, dark
 * coarse sand stacks steep) — which sorts the colours into fine strata on the way down. Squeezing through an opening of
 * the divider is slower; a grain slides freely only on an open face (rarely squeezing past a neighbour), so inside the
 * pile the sand drains more as a column and the strata leave more in order; a grain lying on the divider is dragged sideways towards the nearest opening (the direction is
 * stored in the divider's cells). The randomness is one hash per block and pass, so the four fragments of a block agree.
 *
 * Cells are RGBA8: R the kind (0 liquid, 1…8 a sand colour, 255 wall), G the grain's shade, B the divider's direction
 * to the nearest opening (1 left, 2 right) or, for sand, the grain's own random (above 245/255: a glinting grain of
 * mica). A small pass counts the sand per tile (32 × 32 tiles, above the divider and in all) for the auto turn-over and
 * for the bubbles; the picture pass shades the grains (relief from the neighbours, the backlit liquid through thin sand,
 * glints) into a canvas the size of the glass.
 */

export type SandGrid = {
  /** N × N cells, row 0 at the top; the divider is row (N − 1) / 2. */
  n: number;
  kind: Uint8Array;
  shade: Uint8Array;
  extra: Uint8Array;
};

export type SandLook = {
  /** The base's light (0…1 sRGB) and the liquid's own colour. */
  led: [number, number, number];
  liquid: [number, number, number];
  time: number;
};

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uGrid;
uniform int uN;
int kindOf(vec4 v) { return int(v.r * 255.0 + 0.5); }
vec4 cellAt(ivec2 p) {
  if (p.x < 0 || p.y < 0 || p.x >= uN || p.y >= uN) return vec4(1.0, 0.0, 0.0, 1.0);
  return texelFetch(uGrid, p, 0);
}
`;

const STEP = `${HEAD}
uniform int uOff;
uniform uint uSeed;
uniform int uMid;
uniform float uFall[8];
uniform float uSlide[8];
// How readily a sinking grain is carried sideways by the liquid (fine light sand most): veils rather than threads.
uniform float uDrift[8];
out vec4 o;
uint hashU(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float fallOf(int k) { return k >= 1 && k <= 8 ? uFall[k - 1] : 0.0; }
float slideOf(int k) { return k >= 1 && k <= 8 ? uSlide[k - 1] : 0.0; }
float driftOf(int k) { return k >= 1 && k <= 8 ? uDrift[k - 1] : 0.0; }
bool isSand(int k) { return k >= 1 && k <= 8; }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  // The block's top left cell (rows grow downwards).
  ivec2 b = ((p + uOff) / 2) * 2 - uOff;
  ivec2 l = p - b;
  vec4 A = cellAt(b), B = cellAt(b + ivec2(1, 0)), C = cellAt(b + ivec2(0, 1)), D = cellAt(b + ivec2(1, 1));
  int a = kindOf(A), bb = kindOf(B), c = kindOf(C), d = kindOf(D);
  uint h = hashU(uint(b.x + 2) * 73856093u ^ uint(b.y + 2) * 19349663u ^ uSeed);
  float r1 = float(h & 255u) / 255.0, r2 = float((h >> 8) & 255u) / 255.0, r3 = float((h >> 16) & 255u) / 255.0;
  bool leftFirst = ((h >> 24) & 1u) == 0u;
  float holeSlow = b.y + 1 == uMid ? 0.45 : 1.0;
  // A grain slides freely only on an open face (the cell beside it, towards the slope, empty); squeezing diagonally
  // past a neighbour is rare, and sand right above slows it a little — so inside the pile the sand drains as a
  // column and the strata leave more in order, while the faces keep the angle of repose.
  float burA = isSand(kindOf(cellAt(b + ivec2(0, -1)))) ? 0.6 : 1.0;
  float burB = isSand(kindOf(cellAt(b + ivec2(1, -1)))) ? 0.6 : 1.0;
  bool fellA = false, fellB = false;
  // Sinking.
  // Sinking — straight down, or (both below empty, away from the divider) carried a cell sideways.
  bool open2 = c == 0 && d == 0 && b.y + 1 != uMid;
  if (isSand(a) && c == 0 && r1 < fallOf(a) * holeSlow) {
    if (open2 && bb == 0 && r3 < driftOf(a)) { D = A; A = vec4(0.0); } else { vec4 t = A; A = C; C = t; }
    fellA = true;
  }
  int d2 = kindOf(D), c2 = kindOf(C);
  if (isSand(bb) && d2 == 0 && r2 < fallOf(bb) * holeSlow) {
    if (open2 && c2 == 0 && !fellA && r3 < driftOf(bb)) { C = B; B = vec4(0.0); } else { vec4 t = B; B = D; D = t; }
    fellB = true;
  }
  a = kindOf(A); bb = kindOf(B); c = kindOf(C); d = kindOf(D);
  // On the divider: dragged towards the nearest opening.
  if (c == 255 && d == 255 && b.y + 1 == uMid) {
    int dir = int(C.b * 255.0 + 0.5);
    if (dir == 2 && isSand(a) && bb == 0 && r3 < 0.15 * max(burA, 0.2)) { B = A; A = vec4(0.0); }
    else if (dir == 1 && isSand(bb) && a == 0 && r3 < 0.15 * max(burB, 0.2)) { A = B; B = vec4(0.0); }
  } else {
    // Sliding down a slope, one diagonal a block (the side tried first at random).
    bool canA = !fellA && isSand(a) && c != 0 && d == 0 && r3 < slideOf(a) * burA * (bb == 0 ? 1.0 : 0.12);
    bool canB = !fellB && isSand(bb) && d != 0 && c == 0 && r3 < slideOf(bb) * burB * (a == 0 ? 1.0 : 0.12);
    if (canA && (leftFirst || !canB)) { D = A; A = vec4(0.0); }
    else if (canB) { C = B; B = vec4(0.0); }
  }
  o = l.y == 0 ? (l.x == 0 ? A : B) : (l.x == 0 ? C : D);
  // Outside the grid (the shifted blocks' edges) nothing is written back anyway.
}`;

const FLIP = `${HEAD}
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 v = cellAt(ivec2(uN - 1) - p);
  // The divider's directions mirror with it.
  if (kindOf(v) == 255) {
    int dir = int(v.b * 255.0 + 0.5);
    if (dir == 1) v.b = 2.0 / 255.0; else if (dir == 2) v.b = 1.0 / 255.0;
  }
  o = v;
}`;

/** Sand per tile: R + G·256 above the divider, B + A·256 in all (each /255). */
const COUNT = `${HEAD}
uniform int uTile;
uniform int uMid;
out vec4 o;
void main() {
  ivec2 t = ivec2(gl_FragCoord.xy) * uTile;
  int up = 0, all = 0;
  for (int j = 0; j < 64; j++) {
    if (j >= uTile) break;
    for (int i = 0; i < 64; i++) {
      if (i >= uTile) break;
      ivec2 q = t + ivec2(i, j);
      if (q.x >= uN || q.y >= uN) continue;
      int k = kindOf(texelFetch(uGrid, q, 0));
      if (k >= 1 && k <= 8) { all++; if (q.y < uMid) up++; }
    }
  }
  o = vec4(float(up % 256), float(up / 256), float(all % 256), float(all / 256)) / 255.0;
}`;

const RENDER = `${HEAD}
uniform vec2 uSize;
uniform vec3 uPal[8];
uniform vec3 uLed;
uniform vec3 uLiquid;
uniform float uTime;
uniform int uMid;
out vec4 o;
float sandAt(ivec2 p) {
  if (p.x < 0 || p.y < 0 || p.x >= uN || p.y >= uN) return 0.0;
  int k = kindOf(texelFetch(uGrid, p, 0));
  return k >= 1 && k <= 8 ? 1.0 : 0.0;
}
float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  vec2 q = uv * 2.0 - 1.0;
  float rr = dot(q, q);
  if (rr > 1.0) { o = vec4(0.0); return; }
  float rad = sqrt(rr);
  ivec2 cell = clamp(ivec2(int(uv.x * float(uN)), int((1.0 - uv.y) * float(uN))), ivec2(0), ivec2(uN - 1));
  vec4 v = texelFetch(uGrid, cell, 0);
  int k = kindOf(v);
  // The liquid, lit from behind: bright in the middle, the base's colour towards the rim, a slow shimmer.
  float shimmer = vnoise(q * 3.0 + vec2(uTime * 0.05, -uTime * 0.03)) * 0.5 + vnoise(q * 7.0 - uTime * 0.04) * 0.5;
  vec3 liquid = mix(uLiquid, vec3(1.0), 0.45 * (1.0 - rr)) * (0.93 + 0.1 * shimmer);
  liquid = mix(liquid, uLed, 0.12 + 0.3 * smoothstep(0.35, 1.0, rad));
  vec3 col = liquid;
  if (k == 255) {
    // The divider: a thin strip of glass.
    if (cell.y == uMid) col = mix(liquid, vec3(0.78, 0.8, 0.86), 0.45);
  } else if (k >= 1 && k <= 8) {
    vec3 base = uPal[k - 1];
    // Each grain its own shade.
    float sh = 0.8 + 0.4 * v.g;
    // The neighbours: how full around (5 × 5) and which way the sand thins out (the slope's face).
    float occ = 0.0;
    vec2 gsum = vec2(0.0);
    for (int j = -2; j <= 2; j++) {
      for (int i = -2; i <= 2; i++) {
        float s = sandAt(cell + ivec2(i, j));
        occ += s;
        gsum += s * vec2(float(i), float(j));
      }
    }
    occ /= 25.0;
    // A face turned up and left catches the light; one turned down and away is in shade (rows grow downwards).
    vec2 away = -gsum;
    float facing = length(away) > 0.5 ? dot(normalize(away), normalize(vec2(-0.55, -1.0))) : 0.0;
    float edge = smoothstep(0.5, 6.0, length(away));
    col = base * sh * (0.88 + 0.28 * facing * edge);
    // Thin sand (a falling veil, a crest) lets the backlit liquid through.
    col = mix(col, col * 0.55 + liquid * 0.6, (1.0 - occ) * 0.65);
    // Deep in the pile a little darker.
    col *= mix(1.0, 0.88, smoothstep(0.88, 1.0, occ));
    // Mica: now and then a grain glints.
    if (v.b > 0.96) {
      float tw = pow(0.5 + 0.5 * sin(uTime * 1.7 + v.b * 900.0 + v.g * 140.0), 12.0);
      col += vec3(1.0, 0.97, 0.9) * tw * 0.9;
    }
  }
  // The glass's edge: shadowed under the ring, a thin bright line of refracted light just inside it.
  col *= 1.0 - 0.3 * smoothstep(0.86, 1.0, rad);
  col += uLed * 0.35 * exp(-pow((rad - 0.975) / 0.012, 2.0));
  o = vec4(col, 1.0);
}`;

export type SandSim = NonNullable<ReturnType<typeof createSandSim>>;

/** palette: sRGB 0…1 per colour; fall and slide: chances a pass per colour. */
export function createSandSim(grid: SandGrid, palette: [number, number, number][], fall: number[], slide: number[], drift: number[], size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true, alpha: true });
  if (!gl) return null;
  const N = grid.n;
  const mid = (N - 1) / 2;
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const vert = compile(gl.VERTEX_SHADER, VERT);
  const program = (src: string) => {
    const p = gl.createProgram()!;
    gl.attachShader(p, vert);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, src));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    const cache = new Map<string, WebGLUniformLocation | null>();
    return { p, u: (n: string) => { if (!cache.has(n)) cache.set(n, gl.getUniformLocation(p, n)); return cache.get(n)!; } };
  };
  let P: { step: ReturnType<typeof program>; flip: ReturnType<typeof program>; count: ReturnType<typeof program>; render: ReturnType<typeof program> };
  try {
    P = { step: program(STEP), flip: program(FLIP), count: program(COUNT), render: program(RENDER) };
  } catch (e) {
    console.error('[sand-art]', e);
    return null;
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const target = (w: number, h: number, data: Uint8Array | null) => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    const f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  };
  const cells = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i += 1) {
    cells[i * 4] = grid.kind[i];
    cells[i * 4 + 1] = grid.shade[i];
    cells[i * 4 + 2] = grid.extra[i];
    cells[i * 4 + 3] = 255;
  }
  let cur = target(N, N, cells);
  let nxt = target(N, N, null);
  const TILES = 32;
  const tile = Math.ceil(N / TILES);
  const counts = target(TILES, TILES, null);
  const countBuf = new Uint8Array(TILES * TILES * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const pass = (prog: ReturnType<typeof program>, out: { f: WebGLFramebuffer; w: number; h: number } | null, set?: (u: (n: string) => WebGLUniformLocation | null) => void) => {
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.f : null);
    gl.viewport(0, 0, out ? out.w : canvas.width, out ? out.h : canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, cur.t);
    gl.uniform1i(prog.u('uGrid'), 0);
    gl.uniform1i(prog.u('uN'), N);
    set?.(prog.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const swap = () => {
    const t = cur;
    cur = nxt;
    nxt = t;
  };
  let seed = 1;
  let off = 0;
  const fall8 = new Float32Array(8);
  const slide8 = new Float32Array(8);
  const drift8 = new Float32Array(8);
  drift.forEach((v, i) => { drift8[i] = v; });
  fall.forEach((v, i) => { fall8[i] = v; });
  slide.forEach((v, i) => { slide8[i] = v; });
  const pal = new Float32Array(24);
  palette.forEach((c, i) => pal.set(c, i * 3));
  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
  });

  return {
    canvas,
    n: N,
    get lost() {
      return lost;
    },
    /** passes of the automaton. */
    step(passes: number) {
      for (let k = 0; k < passes; k += 1) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        off = 1 - off;
        pass(P.step, nxt, (u) => {
          gl.uniform1i(u('uOff'), off);
          gl.uniform1ui(u('uSeed'), seed);
          gl.uniform1i(u('uMid'), mid);
          gl.uniform1fv(u('uFall'), fall8);
          gl.uniform1fv(u('uSlide'), slide8);
          gl.uniform1fv(u('uDrift'), drift8);
        });
        swap();
      }
    },
    /** The frame turned over: the grid upside down (and the divider's directions mirrored). */
    flip() {
      pass(P.flip, nxt);
      swap();
    },
    /** Sand per tile (32 × 32 over the grid): above the divider and in all; also the total above. */
    count() {
      pass(P.count, counts, (u) => {
        gl.uniform1i(u('uTile'), tile);
        gl.uniform1i(u('uMid'), mid);
      });
      gl.readPixels(0, 0, TILES, TILES, gl.RGBA, gl.UNSIGNED_BYTE, countBuf);
      let upper = 0;
      const occupancy = new Float32Array(TILES * TILES);
      for (let i = 0; i < TILES * TILES; i += 1) {
        upper += countBuf[i * 4] + countBuf[i * 4 + 1] * 256;
        occupancy[i] = (countBuf[i * 4 + 2] + countBuf[i * 4 + 3] * 256) / (tile * tile);
      }
      return { upper, occupancy, tiles: TILES, tile };
    },
    render(look: SandLook) {
      pass(P.render, null, (u) => {
        gl.uniform2f(u('uSize'), canvas.width, canvas.height);
        gl.uniform3fv(u('uPal'), pal);
        gl.uniform3f(u('uLed'), look.led[0], look.led[1], look.led[2]);
        gl.uniform3f(u('uLiquid'), look.liquid[0], look.liquid[1], look.liquid[2]);
        gl.uniform1f(u('uTime'), look.time);
        gl.uniform1i(u('uMid'), mid);
      });
    },
    dispose() {
      for (const t of [cur, nxt, counts]) {
        gl.deleteTexture(t.t);
        gl.deleteFramebuffer(t.f);
      }
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
      for (const p of Object.values(P)) gl.deleteProgram(p.p);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
