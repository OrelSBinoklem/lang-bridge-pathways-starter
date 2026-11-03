import { SHADER_HEADER, SHADER_MAIN, SHADER_VERTEX } from '../scenes/shaderLib';
import type { ShaderSceneDef } from '../scenes/types';
import { tileRects } from './metrics';

type Program = { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> };
type TimerExtension = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
export type LabFrame = {
  scenes: ShaderSceneDef[]; width: number; height: number; time: number; speed: number;
  palette: number; intensity: number; pointer: [number, number, number, number]; tag?: string;
};

/** One WebGL context for the whole mosaic. Each tile uses its own viewport and local fragment origin. */
export class LabRenderer {
  readonly gl: WebGL2RenderingContext;
  readonly timer: TimerExtension | null;
  private programs = new Map<string, Program>();
  private pending: { query: WebGLQuery; tag: string; at: number }[] = [];
  private trail = new Float32Array(36).fill(-1);
  private colors = new Float32Array(12);
  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL 2 недоступен. Проверьте аппаратное ускорение браузера.');
    this.gl = gl;
    this.timer = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null;
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  }
  private compile(type: number, source: string, id: string) {
    const gl = this.gl, shader = gl.createShader(type);
    if (!shader) throw new Error(`Не удалось создать шейдер ${id}`);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader); gl.deleteShader(shader);
      console.error(`[shader-lab:${id}]`, log); throw new Error(`Ошибка компиляции «${id}». Подробности в консоли.`);
    }
    return shader;
  }
  private program(scene: ShaderSceneDef) {
    const existing = this.programs.get(scene.id); if (existing) return existing;
    const gl = this.gl;
    let vs: WebGLShader | null = null, fs: WebGLShader | null = null, program: WebGLProgram | null = null;
    try {
      vs = this.compile(gl.VERTEX_SHADER, SHADER_VERTEX, scene.id);
      const header = SHADER_HEADER.replace('uniform vec2 uRes;', 'uniform vec2 uRes;\nuniform vec2 uTileOrigin;');
      const main = SHADER_MAIN.replace('gl_FragCoord.xy / uRes', '(gl_FragCoord.xy - uTileOrigin) / uRes');
      fs = this.compile(gl.FRAGMENT_SHADER, header + scene.fragment + main, scene.id);
      program = gl.createProgram(); if (!program) throw new Error('Не удалось создать программу WebGL');
      gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(`[shader-lab:${scene.id}]`, gl.getProgramInfoLog(program)); throw new Error(`Не удалось связать шейдер «${scene.label}»`);
      }
      const uniforms: Program['uniforms'] = {};
      for (const key of ['uRes', 'uTileOrigin', 'uTime', 'uPointer', 'uVel', 'uPal', 'uK', 'uTrail']) uniforms[key] = gl.getUniformLocation(program, key);
      const result = { program, uniforms }; this.programs.set(scene.id, result); return result;
    } catch (error) { if (program) gl.deleteProgram(program); throw error; }
    finally { if (vs) gl.deleteShader(vs); if (fs) gl.deleteShader(fs); }
  }
  poll(): { tag: string; ms: number }[] {
    const gl = this.gl, ext = this.timer; if (!ext) return [];
    const result: { tag: string; ms: number }[] = [];
    if (gl.getParameter(ext.GPU_DISJOINT_EXT)) { this.pending.forEach(p => gl.deleteQuery(p.query)); this.pending = []; return result; }
    while (this.pending.length) {
      const p = this.pending[0];
      if (!gl.getQueryParameter(p.query, gl.QUERY_RESULT_AVAILABLE)) {
        if (performance.now() - p.at < 5000) break;
        gl.deleteQuery(p.query); this.pending.shift(); continue;
      }
      const ms = Number(gl.getQueryParameter(p.query, gl.QUERY_RESULT)) / 1e6;
      if (Number.isFinite(ms) && ms >= 0) result.push({ tag: p.tag, ms });
      gl.deleteQuery(p.query); this.pending.shift();
    }
    return result;
  }
  draw(frame: LabFrame) {
    const gl = this.gl;
    if (gl.isContextLost()) throw new Error('WebGL-контекст потерян. Остановите другие тяжёлые эффекты и откройте лабораторию снова.');
    // Shader compilation and buffer allocation are outside CPU submission timing.
    const programs = frame.scenes.map(scene => this.program(scene));
    if (this.canvas.width !== frame.width || this.canvas.height !== frame.height) { this.canvas.width = frame.width; this.canvas.height = frame.height; }
    const tiles = tileRects(frame.width, frame.height, frame.scenes.length);
    const start = performance.now();
    const query = this.timer && this.pending.length < 8 ? gl.createQuery() : null;
    if (query && this.timer) gl.beginQuery(this.timer.TIME_ELAPSED_EXT, query);
    try {
      gl.enable(gl.SCISSOR_TEST);
      frame.scenes.forEach((scene, i) => {
        const p = programs[i], u = p.uniforms, tile = tiles[i];
        gl.viewport(tile.x, tile.y, tile.width, tile.height); gl.scissor(tile.x, tile.y, tile.width, tile.height); gl.useProgram(p.program);
        const colors = scene.palettes[frame.palette % scene.palettes.length];
        for (let j = 0; j < 4; j++) {
          const n = parseInt(colors[j % colors.length].slice(1), 16);
          this.colors.set([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255], j * 3);
        }
        gl.uniform3fv(u.uPal, this.colors); gl.uniform3fv(u.uTrail, this.trail);
        gl.uniform2f(u.uRes, tile.width, tile.height); gl.uniform2f(u.uTileOrigin, tile.x, tile.y);
        gl.uniform1f(u.uTime, frame.time); gl.uniform4fv(u.uPointer, frame.pointer); gl.uniform2f(u.uVel, 0, 0);
        gl.uniform4f(u.uK, frame.speed, frame.intensity, frame.scenes.length === 1 ? .7 : 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      });
    } finally {
      if (query && this.timer) { gl.endQuery(this.timer.TIME_ELAPSED_EXT); this.pending.push({ query, tag: frame.tag ?? 'preview', at: performance.now() }); }
    }
    return performance.now() - start;
  }
  dispose() {
    this.pending.forEach(p => this.gl.deleteQuery(p.query)); this.pending = [];
    this.programs.forEach(p => this.gl.deleteProgram(p.program)); this.programs.clear();
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
