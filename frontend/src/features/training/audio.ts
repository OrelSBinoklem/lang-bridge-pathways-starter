/** Озвучка тренировки — как WP `src/config/audioConfig.js`. */

const SUPPORTED = {
  LV: {
    folder: 'lv',
    slugify: (word: string) =>
      word
        .toLowerCase()
        .trim()
        .replace(/[?!.]+$/, '')
        .replace(/ā/g, 'aa')
        .replace(/č/g, 'ch')
        .replace(/ē/g, 'ee')
        .replace(/ģ/g, 'gj')
        .replace(/ī/g, 'ii')
        .replace(/ķ/g, 'kj')
        .replace(/ļ/g, 'lj')
        .replace(/ņ/g, 'nj')
        .replace(/š/g, 'sh')
        .replace(/ū/g, 'uu')
        .replace(/ž/g, 'zh')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_'),
  },
  EN: {
    folder: 'en',
    slugify: (word: string) =>
      word
        .toLowerCase()
        .trim()
        .replace(/[?!.]+$/, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_'),
  },
} as const;

type LangCode = keyof typeof SUPPORTED;

const DEFAULT_LANG: LangCode = 'LV';
const AUDIO_EXT = '.mp3';
/** Windows reserved device names cannot be stored as bare filenames (e.g. con.mp3). */
const WIN_RESERVED_SLUG = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function safeAudioSlug(slug: string): string {
  return WIN_RESERVED_SLUG.test(slug) ? `${slug}_` : slug;
}

function audioBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_AUDIO_BASE?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return '/audio/synthesis';
}

function normalizeLang(learnLang?: string | null): LangCode | null {
  const code = String(learnLang || DEFAULT_LANG)
    .trim()
    .toUpperCase();
  if (code in SUPPORTED) return code as LangCode;
  return null;
}

/** Убрать часть речи и прочее в скобках: "downstairs (adverb)" → "downstairs" */
export function normalizeWordForAudio(wordText: string): string {
  return String(wordText || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .trim();
}

export function isLanguageSupported(learnLang?: string | null): boolean {
  return normalizeLang(learnLang) != null;
}

/** Record-specific English audio keeps homographs and pronunciation variants separate. */
export function wordAudioPath(wordText: string, learnLang?: string | null, soundUrl?: string | null): string | null {
  const lang = normalizeLang(learnLang);
  if (!lang) return null;
  if (lang === 'EN' && typeof soundUrl === 'string'
    && /^\/audio\/dictionary\/en-flash\/[a-f0-9]{64}\.mp3$/.test(soundUrl)) return soundUrl;
  const cfg = SUPPORTED[lang];
  const slug = safeAudioSlug(cfg.slugify(normalizeWordForAudio(wordText)));
  if (!slug) return null;
  return `${audioBase()}/${cfg.folder}/audio/${slug}${AUDIO_EXT}`;
}

/** Воспроизведение MP3 записи; прежний путь остаётся для слов без новой озвучки. */
export function playWordAudio(wordText: string, learnLang?: string | null, soundUrl?: string | null): void {
  try {
    const audioPath = wordAudioPath(wordText, learnLang, soundUrl);
    if (!audioPath) return;
    const audio = new Audio(audioPath);
    void audio.play().catch(error => console.warn('Word audio playback failed', { path: audioPath, reason: error?.name }));
  } catch (error) {
    console.warn('Word audio could not start', { reason: error instanceof Error ? error.name : 'UnknownError' });
  }
}
