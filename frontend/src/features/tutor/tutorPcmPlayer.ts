export type TtsStreamEvent =
  | { type: 'tts.stream.start'; streamId: string; playbackId: string; sampleRate: number; channels: number; format: string; metadata?: Record<string, unknown> }
  | { type: 'tts.stream.chunk'; streamId: string; playbackId: string; sequence: number; audio: string }
  | { type: 'tts.stream.end'; streamId: string; playbackId: string; ok: boolean; cancelled?: boolean; error?: { code?: string; message?: string }; metadata?: Record<string, unknown> };

type Segment = {
  id: string;
  index: number;
  metadata?: Record<string, unknown>;
  rate: number;
  chunks: Float32Array[];
  offset: number;
  samples: number;
  sequence: number;
  oddByte?: number;
  ended: boolean;
  started: boolean;
};

type PlayerOptions = {
  createContext?: () => AudioContext;
  onFirstPlayback: (playbackId: string, metadata?: Record<string, unknown>) => void;
  onError: (message: string) => void;
  onAnalyser?: (analyser: AnalyserNode | null) => void;
  onPlaybackState?: (speaking: boolean) => void;
  setTimer?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
};

const PCM_RATE = 24000;
const LOOKAHEAD = 1;
const PREFILL = 0.4;
const MIN_BLOCK = 0.08;
const MAX_BLOCK = 0.24;
const MAX_QUEUED_SECONDS = 300;
const MAX_CHUNK_BASE64_CHARS = 60 * 24000 * 2 * 4 / 3;

function bytesFromBase64(audio: string) {
  const binary = atob(audio);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

/** Keep PCM on one sample clock and enough scheduled audio to survive UI stalls. */
export class TutorPcmPlayer {
  private options: PlayerOptions;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private speaking = false;
  private playbackId: string | null = null;
  private generation = 0;
  private segments: Segment[] = [];
  private streams = new Map<string, Segment>();
  private sources = new Set<AudioBufferSourceNode>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextTime = 0;
  private nextSegment = 0;
  private firstTime: number | null = null;
  private firstMetadata?: Record<string, unknown>;
  private firstPlayed = false;
  private transport: 'pcm' | 'legacy' | null = null;
  private prefill = PREFILL;

  constructor(options: PlayerOptions) { this.options = options; }

  begin(playbackId: string) {
    this.stop();
    this.playbackId = playbackId;
  }

  accepts(playbackId: unknown) {
    return typeof playbackId === 'string' && playbackId === this.playbackId;
  }

  // Call synchronously in the user event handler, before any network or microphone await.
  unlock(): Promise<void> {
    const generation = this.generation;
    try {
      if (!this.context || this.context.state === 'closed') {
        // Resample the continuous mixed output, not each tiny PCM source separately.
        const context = this.options.createContext?.() || new AudioContext({ sampleRate: PCM_RATE, latencyHint: 'interactive' });
        this.context = context;
        if (typeof context.createAnalyser === 'function') {
          this.analyser = context.createAnalyser();
          this.analyser.fftSize = 512;
          this.analyser.connect(context.destination);
          this.options.onAnalyser?.(this.analyser);
        }
        context.onstatechange = () => {
          if (this.context !== context || !this.playbackId) return;
          if (context.state !== 'running' && (this.segments.length || this.sources.size)) {
            this.fail('Воспроизведение приостановлено браузером. Нажмите микрофон или отправьте сообщение ещё раз.');
          }
        };
      }
      const context = this.context;
      return context.resume().then(() => {
        if (generation !== this.generation) return;
        if (context.state !== 'running') throw new Error('Браузер заблокировал звук. Повторите действие.');
        this.pump();
      }).catch(() => {
        if (generation === this.generation) this.fail('Браузер заблокировал звук. Нажмите микрофон или отправьте сообщение ещё раз.');
      });
    } catch {
      this.fail('Не удалось включить звук в браузере.');
      return Promise.resolve();
    }
  }

  handle(event: TtsStreamEvent) {
    if (!this.accepts(event.playbackId)) return;
    try {
      if (event.type === 'tts.stream.start') {
        if (this.streams.has(event.streamId)) return;
        if (this.transport === 'legacy') throw new Error('Несовместимые форматы TTS в одном ответе.');
        if (event.sampleRate !== 24000 || event.channels !== 1 || event.format !== 'pcm_s16le') {
          throw new Error('Неподдерживаемый формат потокового звука.');
        }
        const index = event.metadata?.segmentIndex;
        if (!Number.isInteger(index) || Number(index) < this.nextSegment || this.segments.some(segment => segment.index === index)) {
          throw new Error('Нарушен порядок сегментов TTS.');
        }
        if (this.streams.size >= 256) throw new Error('Слишком много сегментов TTS.');
        this.transport = 'pcm';
        const segment = this.makeSegment(event.streamId, Number(index), event.sampleRate, event.metadata);
        this.streams.set(event.streamId, segment);
        this.segments.push(segment);
        this.segments.sort((a, b) => a.index - b.index);
      } else {
        const segment = this.streams.get(event.streamId);
        if (!segment) throw new Error('Получен звук без начала потока.');
        if (event.type === 'tts.stream.end') {
          if (event.cancelled) { this.stop(); return; }
          if (!event.ok) throw new Error(event.error?.message || 'Ошибка потоковой озвучки.');
          if (segment.oddByte !== undefined) throw new Error('Оборванный PCM-сэмпл в конце потока.');
          segment.ended = true;
        } else {
          if (!Number.isInteger(event.sequence) || event.sequence < 0) throw new Error('Некорректный номер PCM-фрагмента.');
          if (event.sequence < segment.sequence) return;
          if (segment.ended || event.sequence !== segment.sequence) throw new Error('Пропущен или переставлен PCM-фрагмент.');
          // Check encoded size before allocating decoded memory.
          if (event.audio.length > MAX_CHUNK_BASE64_CHARS) throw new Error('Слишком большой PCM-фрагмент.');
          const bytes = bytesFromBase64(event.audio);
          const carry = segment.oddByte;
          const length = bytes.length + (carry === undefined ? 0 : 1);
          // Count allocated chunks, including the consumed prefix of the current chunk.
          const queuedSamples = this.segments.reduce((total, item) => total + item.chunks.reduce((sum, data) => sum + data.length, 0), 0);
          if (queuedSamples + Math.floor(length / 2) > MAX_QUEUED_SECONDS * 24000) {
            throw new Error('Переполнен буфер озвучки.');
          }
          const samples = new Float32Array(Math.floor(length / 2));
          const byte = (i: number) => carry === undefined ? bytes[i] : i === 0 ? carry : bytes[i - 1];
          for (let i = 0; i < samples.length; i++) {
            const value = byte(i * 2) | (byte(i * 2 + 1) << 8);
            samples[i] = (value >= 0x8000 ? value - 0x10000 : value) / 32768;
          }
          segment.oddByte = length % 2 ? byte(length - 1) : undefined;
          if (samples.length) segment.chunks.push(samples);
          segment.samples += samples.length;
          segment.sequence++;
        }
      }
      this.pump();
    } catch (error) { this.fail(error instanceof Error ? error.message : 'Ошибка воспроизведения.'); }
  }

  async playLegacy(event: { playbackId: string; audio: string; metadata?: Record<string, unknown> }) {
    if (!this.accepts(event.playbackId)) return;
    const generation = this.generation;
    try {
      if (this.transport === 'pcm') throw new Error('Несовместимые форматы TTS в одном ответе.');
      const context = this.runningContext();
      this.transport = 'legacy';
      const segment = this.makeSegment(`legacy-${this.streams.size}`, this.streams.size, context.sampleRate, event.metadata);
      if (this.streams.size >= 256 || event.audio.length > 16_000_000) throw new Error('Переполнен буфер озвучки.');
      this.streams.set(segment.id, segment);
      this.segments.push(segment);
      const buffer = await context.decodeAudioData(bytesFromBase64(event.audio).buffer);
      if (generation !== this.generation || !this.accepts(event.playbackId)) return;
      // TTS is mono; downmix legacy files if the decoder returns stereo.
      const samples = new Float32Array(buffer.length);
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < samples.length; i++) samples[i] += data[i] / buffer.numberOfChannels;
      }
      segment.rate = buffer.sampleRate;
      segment.chunks.push(samples);
      segment.samples = samples.length;
      segment.ended = true;
      if (this.segments.reduce((seconds, item) => seconds + item.samples / item.rate, 0) > MAX_QUEUED_SECONDS) {
        throw new Error('Переполнен буфер озвучки.');
      }
      this.pump();
    } catch (error) {
      if (generation === this.generation) this.fail(error instanceof Error ? error.message : 'Не удалось воспроизвести аудио.');
    }
  }

  stop() {
    this.setSpeaking(false);
    this.generation++;
    this.playbackId = null;
    if (this.timer !== null) (this.options.clearTimer || clearTimeout)(this.timer);
    this.timer = null;
    for (const source of this.sources) {
      source.onended = null;
      try { source.stop(); } catch { /* Already ended. */ }
      source.disconnect();
    }
    this.sources.clear();
    this.segments = [];
    this.streams.clear();
    this.nextTime = 0;
    this.nextSegment = 0;
    this.firstTime = null;
    this.firstMetadata = undefined;
    this.firstPlayed = false;
    this.transport = null;
    this.prefill = PREFILL;
  }

  dispose() {
    this.stop();
    this.analyser?.disconnect();
    this.analyser = null;
    this.options.onAnalyser?.(null);
    const context = this.context;
    this.context = null;
    if (context) {
      context.onstatechange = null;
      if (context.state !== 'closed') void context.close().catch(() => undefined);
    }
  }

  private makeSegment(id: string, index: number, rate: number, metadata?: Record<string, unknown>): Segment {
    return { id, index, rate, metadata, chunks: [], offset: 0, samples: 0, sequence: 0, ended: false, started: false };
  }

  private runningContext() {
    if (!this.context || this.context.state !== 'running') {
      throw new Error('Звук недоступен. Нажмите микрофон или отправьте сообщение ещё раз.');
    }
    return this.context;
  }

  private fail(message: string) {
    this.stop();
    this.options.onError(message);
  }

  private pump() {
    if (!this.playbackId) return;
    try {
      if (!this.segments.length && !this.sources.size && (this.firstTime === null || this.firstPlayed)) { this.setSpeaking(false); return; }
      const context = this.runningContext();
      if (!this.firstPlayed && this.firstTime !== null && context.currentTime >= this.firstTime) {
        this.firstPlayed = true;
        this.setSpeaking(true);
        this.options.onFirstPlayback(this.playbackId, this.firstMetadata);
      }
      while (this.segments.length && this.nextTime < context.currentTime + LOOKAHEAD) {
        const segment = this.segments[0];
        if (segment.index !== this.nextSegment) break;
        if (!segment.samples) {
          if (!segment.ended) {
            if (segment.started && this.nextTime <= context.currentTime) {
              segment.started = false;
              this.prefill = Math.min(0.9, this.prefill + 0.2);
            }
            break;
          }
          this.segments.shift();
          this.nextSegment++;
          continue;
        }
        if (segment.started && this.nextTime <= context.currentTime) {
          segment.started = false;
          this.prefill = Math.min(0.9, this.prefill + 0.2);
        }
        if (!segment.started && !segment.ended && segment.samples < Math.round(segment.rate * this.prefill)) break;
        const when = this.nextTime > context.currentTime ? this.nextTime : context.currentTime + 0.01;
        const count = Math.min(segment.samples, Math.floor(segment.rate * Math.min(MAX_BLOCK, context.currentTime + LOOKAHEAD - when)));
        if (count <= 0) break;
        // Wait for a useful block instead of creating a new source on every 20ms timer.
        if (count < segment.rate * MIN_BLOCK && !(segment.ended && count === segment.samples)) break;
        segment.started = true;
        const buffer = context.createBuffer(1, count, segment.rate);
        const output = buffer.getChannelData(0);
        let copied = 0;
        while (copied < count) {
          const chunk = segment.chunks[0];
          const take = Math.min(count - copied, chunk.length - segment.offset);
          output.set(chunk.subarray(segment.offset, segment.offset + take), copied);
          copied += take;
          segment.offset += take;
          if (segment.offset === chunk.length) { segment.chunks.shift(); segment.offset = 0; }
        }
        segment.samples -= count;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.analyser || context.destination);
        this.sources.add(source);
        const generation = this.generation;
        source.onended = () => {
          source.disconnect();
          if (generation !== this.generation) return;
          this.sources.delete(source);
          this.pump();
        };
        source.start(when);
        if (this.firstTime === null) { this.firstTime = when; this.firstMetadata = segment.metadata; }
        this.nextTime = when + count / segment.rate;
      }
      if (this.timer === null && (this.segments.length || this.sources.size)) {
        const generation = this.generation;
        this.timer = (this.options.setTimer || setTimeout)(() => {
          if (generation !== this.generation) return;
          this.timer = null;
          this.pump();
        }, 20);
      }
    } catch (error) { this.fail(error instanceof Error ? error.message : 'Ошибка воспроизведения.'); }
  }

  private setSpeaking(value: boolean) {
    if (this.speaking === value) return;
    this.speaking = value;
    this.options.onPlaybackState?.(value);
  }
}
