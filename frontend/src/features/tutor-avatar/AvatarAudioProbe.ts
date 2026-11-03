type CapturableAudio = HTMLAudioElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

type ProbeOptions = {
  onAnalyser: (analyser: AnalyserNode | null) => void;
  createContext?: () => AudioContext;
};

/** Reads a copy of native element playback. Never reroutes, mutes, pauses or plays the element. */
export class AvatarAudioProbe {
  private context: AudioContext | null = null;
  private element: CapturableAudio | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private disposed = false;
  private warned = false;

  constructor(private options: ProbeOptions) {}

  /** Call directly in the Play click, before awaiting the audio API. Does not delay playback. */
  unlock(): void {
    if (this.disposed) return;
    try {
      if (!this.context) {
        this.context = this.options.createContext?.() ?? new AudioContext();
        this.context.addEventListener('statechange', this.onContextState);
      }
      void this.context.resume().then(() => this.capture()).catch(() => this.warn('Audio analysis could not be resumed'));
    } catch {
      this.warn('Audio analysis is unavailable');
    }
  }

  /** Attach once native playback has started and its audio track is available. */
  attach(element: HTMLAudioElement): void {
    this.detach();
    if (this.disposed) return;
    // Exams use API-supplied data URLs. Do not capture remote media or change CORS settings.
    if (!element.src.startsWith('data:audio/')) return;
    this.element = element;
    this.capture();
  }

  private onContextState = () => {
    if (this.disposed) return;
    if (this.context?.state === 'running') this.capture();
    else this.options.onAnalyser(null);
  };

  private capture(): void {
    if (this.disposed || !this.element || this.context?.state !== 'running') return;
    if (this.source && this.analyser) { this.options.onAnalyser(this.analyser); return; }
    try {
      if (!this.stream) {
        const capture = this.element.captureStream ?? this.element.mozCaptureStream;
        if (!capture) { this.warn('This browser cannot capture element audio'); return; }
        this.stream = capture.call(this.element);
        this.stream.addEventListener('addtrack', this.connectStream);
      }
      this.connectStream();
    } catch {
      this.warn('Element audio could not be analysed');
      this.detach();
    }
  }

  private connectStream = () => {
    if (this.disposed || this.source || !this.stream?.getAudioTracks().length || this.context?.state !== 'running') return;
    try {
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 1024;
      this.source = this.context.createMediaStreamSource(this.stream);
      // The analyser output stays unconnected: the original element remains the only audible output.
      this.source.connect(this.analyser);
      this.options.onAnalyser(this.analyser);
    } catch {
      this.warn('Captured audio could not be analysed');
      this.detach();
    }
  };

  detach(): void {
    this.element = null;
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.source = null;
    this.analyser = null;
    this.stream?.removeEventListener('addtrack', this.connectStream);
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    if (!this.disposed) this.options.onAnalyser(null);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.detach();
    this.context?.removeEventListener('statechange', this.onContextState);
    void this.context?.close().catch(() => this.warn('Audio analysis context could not be closed'));
    this.context = null;
  }

  private warn(message: string): void {
    if (this.warned || this.disposed) return;
    this.warned = true;
    console.warn(`[AvatarAudioProbe] ${message}; native playback continues.`);
  }
}
