/** Poll parallel shader compilation without forcing the browser to wait for the driver. */
export function createProgressiveProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string, label: string) {
  const extension = gl.getExtension('KHR_parallel_shader_compile') as { COMPLETION_STATUS_KHR: number } | null;
  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vs || !fs || !program) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    if (program) gl.deleteProgram(program);
    return null;
  }
  gl.shaderSource(vs, vertex);
  gl.shaderSource(fs, fragment);
  gl.compileShader(vs);
  gl.compileShader(fs);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  let state: 'pending' | 'ready' | 'failed' | 'disposed' = 'pending';
  let shadersReleased = false;
  const releaseShaders = () => {
    if (shadersReleased) return;
    shadersReleased = true;
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  };
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  return {
    prog: program,
    ready() {
      if (state !== 'pending') return state === 'ready';
      if (gl.isContextLost()) return false;
      if (extension && !gl.getProgramParameter(program, extension.COMPLETION_STATUS_KHR)) return false;
      if (gl.getProgramParameter(program, gl.LINK_STATUS)) state = 'ready';
      else {
        state = 'failed';
        console.error(`[${label}] program:`, gl.getProgramInfoLog(program), gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs));
      }
      releaseShaders();
      return state === 'ready';
    },
    failed: () => state === 'failed',
    u(name: string) {
      if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name));
      return uniforms.get(name) ?? null;
    },
    dispose() {
      if (state === 'disposed') return;
      state = 'disposed';
      releaseShaders();
      gl.deleteProgram(program);
    },
  };
}
