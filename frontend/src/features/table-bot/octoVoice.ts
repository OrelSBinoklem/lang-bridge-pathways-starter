/**
 * The octopus's voice: lines recorded with Gemini Flash-Lite in a few candidate voices
 * (tools/tour/generate-tour-voice.mjs --octopus → public/audio/table-bot/<release>-<voice>/). "Under water" runs the
 * clip through a muffling filter and a slow wobble (a modulated short delay) and lowers it a little.
 * Browsers allow sound only after a user gesture: call `unlock()` from a click before the first line.
 */
import lines from '../../../../resources/table-bot/octopus-lines.json';

export type OctoLine = (typeof lines.lines)[number]['key'];
export const OCTO_VOICES = lines.voices;
export const octoText = (key: OctoLine) => lines.lines.find(l => l.key === key)?.ru ?? '';

export class OctoVoice {
  private ctx?: AudioContext;
  private audio?: HTMLAudioElement;
  private dry?: GainNode;
  private wet?: GainNode;
  private token = 0;

  constructor(private onSpeaking: (on: boolean) => void) {}

  unlock() {
    if (!this.ctx && typeof AudioContext !== 'undefined') {
      const ctx = new AudioContext(), audio = new Audio();
      audio.crossOrigin = 'anonymous';
      const source = ctx.createMediaElementSource(audio);
      this.dry = ctx.createGain(); this.wet = ctx.createGain(); this.wet.gain.value = 0;
      const muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 1500; muffle.Q.value = 4;
      const wobble = ctx.createDelay(0.05); wobble.delayTime.value = 0.012;
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = 5.5; depth.gain.value = 0.004;
      lfo.connect(depth).connect(wobble.delayTime); lfo.start();
      source.connect(this.dry).connect(ctx.destination);
      source.connect(muffle).connect(wobble).connect(this.wet).connect(ctx.destination);
      this.ctx = ctx; this.audio = audio;
    }
    void this.ctx?.resume().catch(() => {});
  }

  /** Plays one line; resolves when it ends, is replaced or fails. Unknown voice or no audio: silently resolves. */
  async say(key: OctoLine, voice: string | null, underWater: boolean) {
    const token = ++this.token;
    this.audio?.pause();
    if (!voice || !this.audio || !this.dry || !this.wet) { this.onSpeaking(false); return; }
    const audio = this.audio;
    this.dry.gain.value = underWater ? 0 : 1;
    this.wet.gain.value = underWater ? 1.4 : 0;
    audio.src = `/audio/table-bot/${lines.release}-${voice.toLowerCase()}/${key}-ru.mp3`;
    audio.preservesPitch = false;
    audio.playbackRate = underWater ? 0.94 : 1;
    this.onSpeaking(true);
    await new Promise<void>(resolve => {
      audio.onended = audio.onerror = audio.onpause = () => resolve();
      audio.play().catch(() => resolve());
    });
    if (token === this.token) this.onSpeaking(false);
  }

  stop() { this.token++; this.audio?.pause(); this.onSpeaking(false); }

  dispose() { this.stop(); void this.ctx?.close().catch(() => {}); }
}
