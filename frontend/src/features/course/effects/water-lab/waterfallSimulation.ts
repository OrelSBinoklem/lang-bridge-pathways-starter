export type WaterTool = 'barrier' | 'push' | 'pull';
export type WaterPointer = { x: number; y: number; active: boolean; radius: number; tool: WaterTool };

export const FLUID_DT = 1 / 60;
export const PRESSURE_ITERATIONS = 18;

/** Square simulation cells, bounded independently of the display's pixel ratio. */
export function fluidGrid(aspect: number) {
  const safe = Math.max(.25, Math.min(4, Number.isFinite(aspect) ? aspect : 1));
  const height = Math.min(192, Math.floor(320 / safe));
  return { width: Math.max(32, Math.round(height * safe)), height };
}

export function fluidSteps(accumulator: number, elapsed: number) {
  const time = accumulator + Math.max(0, Math.min(Number.isFinite(elapsed) ? elapsed : 0, .05));
  const steps = Math.min(3, Math.floor((time + 1e-8) / FLUID_DT));
  return { steps, remainder: Math.max(0, time - steps * FLUID_DT) % FLUID_DT };
}
