/**
 * Adapted from https://github.com/matthias-research/pages/blob/master/tenMinutePhysics/10-softBodies.html
 * Copyright 2021 Matthias Müller - Ten Minute Physics,
 * https://www.youtube.com/channel/UCTG_vrRdKYfrpqCv_WV4eyA
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * Local changes: typed arrays, edge multipliers and plastic rest lengths.
 */
export class TetraBody {
  readonly pos: Float32Array;
  readonly prev: Float32Array;
  readonly velocity: Float32Array;
  readonly restLengths: Float32Array;
  readonly restVolumes: Float32Array;
  private lambdas: Float32Array;
  private gradients = new Float64Array(12);
  private order = [[1, 3, 2], [0, 2, 3], [0, 3, 1], [0, 1, 2]];
  constructor(positions: Float32Array, readonly tets: Uint32Array, readonly edges: Uint32Array, readonly inverseMass: Float32Array) {
    this.pos = positions.slice(); this.prev = positions.slice(); this.velocity = new Float32Array(positions.length);
    this.restLengths = new Float32Array(edges.length / 2); this.lambdas = new Float32Array(this.restLengths.length);
    this.restVolumes = new Float32Array(tets.length / 4); this.bake();
    for (let t = 0; t < this.restVolumes.length; t++) this.restVolumes[t] = this.volume(t);
  }
  volume(t: number) {
    const p = this.pos, ids = this.tets, a = ids[t * 4] * 3, b = ids[t * 4 + 1] * 3, c = ids[t * 4 + 2] * 3, d = ids[t * 4 + 3] * 3;
    const x1 = p[b] - p[a], y1 = p[b + 1] - p[a + 1], z1 = p[b + 2] - p[a + 2];
    const x2 = p[c] - p[a], y2 = p[c + 1] - p[a + 1], z2 = p[c + 2] - p[a + 2];
    return ((y1 * z2 - z1 * y2) * (p[d] - p[a]) + (z1 * x2 - x1 * z2) * (p[d + 1] - p[a + 1]) + (x1 * y2 - y1 * x2) * (p[d + 2] - p[a + 2])) / 6;
  }
  edgeLength(e: number) {
    const a = this.edges[e * 2] * 3, b = this.edges[e * 2 + 1] * 3, p = this.pos;
    return Math.hypot(p[a] - p[b], p[a + 1] - p[b + 1], p[a + 2] - p[b + 2]);
  }
  bake() { for (let e = 0; e < this.restLengths.length; e++) this.restLengths[e] = this.edgeLength(e); }
  predict(dt: number, gravity: number) {
    this.prev.set(this.pos); this.lambdas.fill(0);
    const damping = Math.exp(-14 * dt);
    for (let n = 0; n < this.inverseMass.length; n++) {
      if (!this.inverseMass[n]) continue;
      this.velocity[n * 3 + 1] += gravity * dt;
      for (let k = 0; k < 3; k++) { const i = n * 3 + k; this.velocity[i] *= damping; this.pos[i] += this.velocity[i] * dt; }
    }
  }
  solveEdges(dt: number, compliance: number) {
    const p = this.pos, alpha = compliance / (dt * dt);
    for (let e = 0; e < this.restLengths.length; e++) {
      const a = this.edges[e * 2], b = this.edges[e * 2 + 1], wa = this.inverseMass[a], wb = this.inverseMass[b];
      if (!wa && !wb) continue;
      const x = p[a * 3] - p[b * 3], y = p[a * 3 + 1] - p[b * 3 + 1], z = p[a * 3 + 2] - p[b * 3 + 2];
      const length = Math.hypot(x, y, z); if (length < 1e-8) continue;
      const lambda = (-(length - this.restLengths[e]) - alpha * this.lambdas[e]) / (wa + wb + alpha);
      this.lambdas[e] += lambda;
      const sa = lambda * wa / length, sb = lambda * wb / length;
      p[a * 3] += x * sa; p[a * 3 + 1] += y * sa; p[a * 3 + 2] += z * sa;
      p[b * 3] -= x * sb; p[b * 3 + 1] -= y * sb; p[b * 3 + 2] -= z * sb;
    }
  }
  solveVolumes() {
    const p = this.pos, ids = this.tets, g = this.gradients;
    for (let t = 0; t < this.restVolumes.length; t++) {
      let weight = 0;
      for (let j = 0; j < 4; j++) {
        const order = this.order[j], a = ids[t * 4 + order[0]] * 3, b = ids[t * 4 + order[1]] * 3, c = ids[t * 4 + order[2]] * 3;
        const x1 = p[b] - p[a], y1 = p[b + 1] - p[a + 1], z1 = p[b + 2] - p[a + 2];
        const x2 = p[c] - p[a], y2 = p[c + 1] - p[a + 1], z2 = p[c + 2] - p[a + 2];
        const x = (y1 * z2 - z1 * y2) / 6, y = (z1 * x2 - x1 * z2) / 6, z = (x1 * y2 - y1 * x2) / 6;
        g[j * 3] = x; g[j * 3 + 1] = y; g[j * 3 + 2] = z;
        weight += this.inverseMass[ids[t * 4 + j]] * (x * x + y * y + z * z);
      }
      if (weight < 1e-12) continue;
      const lambda = -(this.volume(t) - this.restVolumes[t]) / weight;
      for (let j = 0; j < 4; j++) {
        const n = ids[t * 4 + j], scale = lambda * this.inverseMass[n];
        p[n * 3] += g[j * 3] * scale; p[n * 3 + 1] += g[j * 3 + 1] * scale; p[n * 3 + 2] += g[j * 3 + 2] * scale;
      }
    }
  }
  finish(dt: number) { for (let i = 0; i < this.pos.length; i++) this.velocity[i] = Math.max(-1.5, Math.min(1.5, (this.pos[i] - this.prev[i]) / dt)); }
}
