/** Metres, shared by the offline light baker and the open sleeping-car scene. No compartment doors. */
export const TRAIN_WINDOW = { x: -1.86, y0: .92, y1: 2.05, z0: -.84, z1: .83 };
export const TRAIN_BAKE_SURFACES = {
  table: { origin: [-1.73, .825, -.48], u: [1.48, 0, 0], v: [0, 0, 1.06], normal: [0, 1, 0] },
  partition: { origin: [-1.84, 0, -1.24], u: [2.49, 0, 0], v: [0, 2.52, 0], normal: [0, 0, 1] },
  floor: { origin: [-1.85, .015, -12], u: [4, 0, 0], v: [0, 0, 16], normal: [0, 1, 0] },
  ceiling: { origin: [-1.85, 2.58, -12], u: [4, 0, 0], v: [0, 0, 16], normal: [0, -1, 0] },
  right: { origin: [2.12, 0, -12], u: [0, 0, 16], v: [0, 2.58, 0], normal: [-1, 0, 0] },
} as const;
export const TRAIN_OCCLUDERS = [
  { min: [-1.84, .29, -1.16], max: [.65, .51, -.49], color: [.24, .31, .25] },
  { min: [-1.84, 1.91, -1.16], max: [.65, 2.06, -.49], color: [.35, .3, .21] },
  { min: [-1.84, .29, .89], max: [.65, .51, 1.55], color: [.24, .31, .25] },
  { min: [-1.73, .76, -.48], max: [-.25, .82, .58], color: [.4, .25, .12] },
  { min: [-1.24, .83, -.11], max: [-1.04, 1.08, .09], color: [.45, .32, .16] },
  { min: [-.8, .83, .11], max: [-.39, .89, .52], color: [.8, .78, .68] },
  { min: [-1.85, 0, -1.34], max: [.65, 2.52, -1.25], color: [.48, .38, .25] },
  { min: [1.42, .3, -1.1], max: [2.1, .5, 1.05], color: [.22, .28, .22] },
  { min: [1.42, 1.91, -1.1], max: [2.1, 2.06, 1.05], color: [.32, .3, .23] },
] as const;

export function trainSipPose(t: number) {
  if (t < 0 || t >= 4.5) return 0;
  const smooth = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  return smooth(t / 1.3) * (1 - smooth((t - 2.8) / 1.7));
}
