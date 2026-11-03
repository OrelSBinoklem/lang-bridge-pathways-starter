/** Rasterize the existing surface particles: foam follows their flow and decay. */
export function createPoolFoam(size = 96) {
  const density = new Float32Array(size * size);
  const pixels = new Uint8Array(size * size);
  return {
    size, pixels,
    update(px: Float32Array, pz: Float32Array, state: Uint8Array, foam: Float32Array, radius: number, poolState: number) {
      density.fill(0);
      for (let i = 0; i < px.length; i++) {
        if (state[i] !== poolState || foam[i] < 0.025) continue;
        const x = (px[i] / radius + 1) * 0.5 * (size - 1);
        const y = (pz[i] / radius + 1) * 0.5 * (size - 1);
        const ix = Math.floor(x), iy = Math.floor(y);
        if (ix < 0 || iy < 0 || ix >= size - 1 || iy >= size - 1) continue;
        const fx = x - ix, fy = y - iy, f = foam[i] * 0.7;
        density[iy * size + ix] += f * (1 - fx) * (1 - fy);
        density[iy * size + ix + 1] += f * fx * (1 - fy);
        density[(iy + 1) * size + ix] += f * (1 - fx) * fy;
        density[(iy + 1) * size + ix + 1] += f * fx * fy;
      }
      for (let i = 0; i < pixels.length; i++) pixels[i] = Math.round(255 * (1 - Math.exp(-density[i])));
    },
  };
}
