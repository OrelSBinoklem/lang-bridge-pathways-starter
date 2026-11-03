/**
 * The guide cat's voice. Prefers pre-recorded Gemini Flash-Lite clips (public/audio/tour/<release>/manifest.json);
 * without them it falls back to the browser's speech synthesis. Loudness drives the cat's mouth. Browsers only
 * allow sound after a user gesture, so speaking is silent (but still timed) until `unlock()` is called from a click.
 */
type Clip = { url: string };

export class TourVoice {
  muted = false;
  private unlocked = false;
  private clips: Record<string, Clip> | null = null;
  private audio?: HTMLAudioElement;
  private context?: AudioContext;
  private analyser?: AnalyserNode;
  private finish?: () => void;
  private raf = 0;

  constructor(private release: string | null, private onMouth: (level: number | null) => void) {}

  async load() {
    if (!this.release) return;
    try {
      // Revalidate: new lines are added to the same release, and a stale list would fall back to the browser voice.
      const response = await fetch(`/audio/tour/${this.release}/manifest.json`, { cache: 'no-cache' });
      if (response.ok) this.clips = (await response.json()).clips ?? null;
    } catch { /* no clips: browser voice */ }
  }

  /** Call from a click: allows audio for the rest of the tour. */
  unlock() {
    this.unlocked = true;
    if (!this.context && typeof AudioContext !== 'undefined') {
      this.context = new AudioContext();
      this.audio = new Audio();
      this.audio.crossOrigin = 'anonymous';
      const source = this.context.createMediaElementSource(this.audio);
      this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 512;
      source.connect(this.analyser); this.analyser.connect(this.context.destination);
    }
    this.context?.resume().catch(() => { /* closed by dispose meanwhile */ });
  }

  get canSpeak() { return this.unlocked && !this.muted; }

  /** Mutes without cutting the line short: a clip keeps playing silently (its timing still drives the tour). */
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.audio) this.audio.muted = muted;
    if (muted && typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking) speechSynthesis.cancel();
  }

  /** Resolves when the line has been said (or would have been read), or at once after stop(). */
  speak(key: string, lang: 'ru' | 'uk', text: string): Promise<void> { return this.speakClip(`${key}-${lang}`, lang, text); }

  /** Same as speak() with the clip named directly (voice samples). */
  speakClip(clipKey: string, lang: 'ru' | 'uk', text: string): Promise<void> {
    this.stop();
    return new Promise<void>(resolve => {
      let done = false;
      const timers: number[] = [];
      const finish = () => { if (done) return; done = true; timers.forEach(clearTimeout); if (this.finish === finish) this.finish = undefined; cancelAnimationFrame(this.raf); this.onMouth(null); resolve(); };
      this.finish = finish;
      const readTime = Math.min(10000, Math.max(2600, text.length * 62));
      /** Safety net: the line also ends after `ms` (no audio, blocked autoplay, a voice that never reports its end). */
      const fallbackTimer = (ms: number) => { if (!done) timers.push(window.setTimeout(finish, ms)); };
      const clip = this.clips?.[clipKey];
      if (!this.canSpeak) { fallbackTimer(readTime); return; }
      if (clip && this.audio) {
        this.audio.src = clip.url;
        this.audio.onended = () => finish();
        this.audio.onerror = () => finish();
        this.audio.play().then(() => this.trackLoudness()).catch(() => fallbackTimer(readTime));
        fallbackTimer(30000);
        return;
      }
      // A browser voice of another language would mangle the text: then the line is only shown, for its reading time.
      const browserVoice = typeof speechSynthesis === 'undefined' ? undefined : speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(lang));
      if (!browserVoice) { fallbackTimer(readTime); return; }
      const started = performance.now();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'uk' ? 'uk-UA' : 'ru-RU';
      utterance.voice = browserVoice;
      utterance.pitch = 1.35; utterance.rate = 1.05;
      utterance.onend = () => finish();
      utterance.onerror = () => { cancelAnimationFrame(this.raf); this.onMouth(null); fallbackTimer(Math.max(0, readTime - (performance.now() - started))); };
      speechSynthesis.speak(utterance);
      this.flapMouth();
      fallbackTimer(readTime * 2.5);
    });
  }

  stop() {
    this.audio?.pause();
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    this.finish?.();
  }

  dispose() { this.stop(); this.context?.close().catch(() => {}); this.context = undefined; }

  private trackLoudness() {
    const analyser = this.analyser, data = analyser && new Uint8Array(analyser.fftSize);
    const tick = () => {
      if (!analyser || !data) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += ((v - 128) / 128) ** 2;
      this.onMouth(Math.min(0.85, Math.sqrt(sum / data.length) * 5.5));
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  /** Browser voices expose no audio, so the mouth just flaps while speaking. */
  private flapMouth() {
    const start = performance.now();
    const tick = (now: number) => { this.onMouth(0.12 + 0.3 * Math.abs(Math.sin((now - start) / 75))); this.raf = requestAnimationFrame(tick); };
    this.raf = requestAnimationFrame(tick);
  }
}
