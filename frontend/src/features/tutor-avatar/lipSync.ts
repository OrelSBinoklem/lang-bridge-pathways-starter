/**
 * Rough vowel lip sync from an AnalyserNode: loudness opens the mouth, the balance of the first two formant bands
 * picks the shape (a / i / u / e / o). Good enough for a stylised face; no phoneme timings are needed from the TTS.
 */
export type Visemes = { aa: number; ih: number; ou: number; ee: number; oh: number };
export const NO_VISEMES: Visemes = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };

export class LipSync {
  private freq: Float32Array<ArrayBuffer>;
  private wave: Float32Array<ArrayBuffer>;
  private out: Visemes = { ...NO_VISEMES };
  private floor = 0.01;
  private openStat = { mean: 0, dev: 0.5 };
  private frontStat = { mean: -1.5, dev: 0.6 };

  constructor(private analyser: AnalyserNode) {
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.5;
    this.freq = new Float32Array(analyser.frequencyBinCount);
    this.wave = new Float32Array(analyser.fftSize);
  }

  /** Energy (linear) between two frequencies. */
  private band(lo: number, hi: number) {
    const hz = this.analyser.context.sampleRate / this.analyser.fftSize;
    let sum = 0;
    for (let i = Math.max(1, Math.floor(lo / hz)); i <= Math.min(this.freq.length - 1, Math.ceil(hi / hz)); i++) sum += 10 ** (this.freq[i] / 20);
    return sum;
  }

  /** Current mouth shape, smoothed toward the new frame (dt in seconds). */
  sample(dt: number): Visemes {
    this.analyser.getFloatTimeDomainData(this.wave);
    let rms = 0;
    for (const v of this.wave) rms += v * v;
    rms = Math.sqrt(rms / this.wave.length);
    this.floor = Math.min(this.floor * 1.002 + 0.00001, Math.max(0.004, rms));
    const open = Math.max(0, Math.min(1, (rms - this.floor * 1.4) * 9));
    const target: Visemes = { ...NO_VISEMES };
    if (open > 0.02) {
      this.analyser.getFloatFrequencyData(this.freq);
      const f1Low = this.band(250, 550), f1High = this.band(550, 1000), f2Low = this.band(700, 1300), f2High = this.band(1700, 3200);
      // Openness ~ first formant high vs low, frontness ~ second formant high vs low. Both are compared with this
      // voice's own running average, so a low or a high voice still spreads over all five shapes.
      const a = this.norm(this.openStat, Math.log((f1High + 1e-6) / (f1Low + 1e-6)));
      const f = this.norm(this.frontStat, Math.log((f2High + 1e-6) / (f2Low + 1e-6)));
      const aa = a * a, rest = 1 - aa;
      // a: open; e: half-open front; i: closed front; o: half-open back; u: closed back.
      const shapes: Visemes = { aa, ee: rest * a * f, ih: rest * (1 - a) * f, oh: rest * a * (1 - f), ou: rest * (1 - a) * (1 - f) };
      for (const k of Object.keys(shapes) as (keyof Visemes)[]) target[k] = shapes[k] * open;
    }
    const k = 1 - Math.exp(-dt * 22);
    for (const key of Object.keys(target) as (keyof Visemes)[]) this.out[key] += (target[key] - this.out[key]) * k;
    return this.out;
  }

  /** 0..1 position of x against a running mean and spread of the same feature. */
  private norm(stat: { mean: number; dev: number }, x: number) {
    stat.mean += (x - stat.mean) * 0.03;
    stat.dev += (Math.abs(x - stat.mean) - stat.dev) * 0.03;
    return 1 / (1 + Math.exp(-((x - stat.mean) / Math.max(0.05, stat.dev)) * 1.6));
  }

  loudness() { return this.out.aa + this.out.ih + this.out.ou + this.out.ee + this.out.oh; }
}
