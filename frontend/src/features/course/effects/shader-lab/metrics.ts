export type Samples = { frames: number[]; cpu: number[]; gpu: number[] };
export function percentile(values: number[], p: number): number | null {
  const sorted = values.filter(v => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))];
}
export function summarize(samples: Samples) {
  const frames = samples.frames.filter(v => Number.isFinite(v) && v > 0);
  return {
    samples: frames.length,
    fps: frames.length ? 1000 * frames.length / frames.reduce((a, b) => a + b, 0) : null,
    frameP95: percentile(frames, 0.95), cpuMedian: percentile(samples.cpu, 0.5), gpuMedian: percentile(samples.gpu, 0.5),
    slowFrames: frames.filter(v => v > 1000 / 30).length,
    gpuSamples: samples.gpu.length,
    reliable: frames.length >= 30,
  };
}
export type Statistics = ReturnType<typeof summarize>;
export function previewSize(width: number, height: number, dpr: number, quality: number) {
  const density = Math.max(1, Math.min(2, dpr));
  const scale = Math.min(density * Math.max(0.5, Math.min(1.5, quality)), Math.sqrt(4200000 / Math.max(1, width * height)));
  return { width: Math.max(2, Math.floor(width * scale)), height: Math.max(2, Math.floor(height * scale)) };
}
export function tileRects(width: number, height: number, count: number) {
  const columns = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / columns);
  return Array.from({ length: count }, (_, i) => {
    const x = Math.floor((i % columns) * width / columns), right = Math.floor((i % columns + 1) * width / columns);
    const top = Math.floor(Math.floor(i / columns) * height / rows), bottom = Math.floor((Math.floor(i / columns) + 1) * height / rows);
    return { x, y: height - bottom, width: right - x, height: bottom - top };
  });
}
