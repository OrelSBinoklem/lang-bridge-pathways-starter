import { tutorDiagnostics } from '../diagnostics.mjs';

const defaultPrompt = [
  'The speaker is learning Latvian.',
  'Expected languages are Latvian and Russian.',
  'Preserve the language actually spoken.',
  'Do not translate Latvian into Russian.',
  'Pay special attention to Latvian diacritics and similar forms such as mācos and mācu.',
].join(' ');

const latvianPriorityPrompt = [
  'The speaker is practicing Latvian in a Latvian language lesson.',
  'Treat Latvian as the priority language for this transcription attempt.',
  'The audio may sound accented and may include short Russian hesitation words, but the target utterance is likely Latvian.',
  'Prefer plausible Latvian learning phrases over Russian lookalike guesses when the sound is ambiguous.',
  'Preserve Latvian as Latvian. Do not translate Latvian into Russian.',
  'Pay close attention to Latvian diacritics: ā, č, ē, ģ, ī, ķ, ļ, ņ, š, ū, ž.',
  'Pay close attention to forms such as mācos, mācu, latviešu valoda, latviešu valodu, es mācos, es runāju, es saprotu.',
  'If there is a clearly Russian segment, keep it in Russian, but do not let Russian dominate uncertain Latvian words.',
].join(' ');

const russianPriorityPrompt = [
  'The speaker is a Russian-speaking learner of Latvian.',
  'Treat Russian as the priority language for this transcription attempt.',
  'Preserve Latvian words if they are clearly spoken, especially lesson vocabulary.',
  'Do not translate Latvian words into Russian.',
].join(' ');

function buildPromptForLanguage(language, prompt) {
  if (prompt) return prompt;
  if (language === 'lv') return latvianPriorityPrompt;
  if (language === 'ru') return russianPriorityPrompt;
  return defaultPrompt;
}

function normalizeBase64Audio(audio) {
  const value = String(audio || '');
  const marker = ';base64,';
  const markerIndex = value.indexOf(marker);
  return markerIndex >= 0 ? value.slice(markerIndex + marker.length) : value;
}

export async function transcribeAudio({
  audio,
  mimeType = 'audio/webm',
  model = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-transcribe',
  prompt = '',
  language = '',
  contextMessages = [],
}) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      error: {
        code: 'openai_key_missing',
        message: 'OPENAI_API_KEY is not configured on the tutor gateway.',
      },
    };
  }

  const audioBytes = Buffer.from(normalizeBase64Audio(audio), 'base64');
  if (audioBytes.length === 0) {
    return {
      ok: false,
      error: {
        code: 'empty_audio',
        message: 'Audio payload is empty.',
      },
    };
  }

  const extension = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'webm';
  const form = new FormData();
  const basePrompt = buildPromptForLanguage(language, prompt);
  const contextPrompt = Array.isArray(contextMessages) && contextMessages.length
    ? `${basePrompt}\nRecent lesson context:\n${contextMessages.slice(-6).join('\n')}`
    : basePrompt;
  form.append('model', model);
  if (model === 'whisper-1') form.append('response_format', 'verbose_json');
  form.append('prompt', contextPrompt.slice(0, 2000));
  if (language && language !== 'auto') {
    form.append('language', language);
  }
  form.append('file', new Blob([audioBytes], { type: mimeType }), `speech.${extension}`);

  const startedAt = Date.now();
  tutorDiagnostics.log('stt.start',{model,language:language||'auto',audio_bytes:audioBytes.length});
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: form,
  });
  const latencyMs = Date.now() - startedAt;
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    tutorDiagnostics.log('stt.failed',{model,language:language||'auto',status_code:response.status,duration_ms:latencyMs});
    return {
      ok: false,
      error: {
        code: payload?.error?.code || 'transcription_failed',
        message: payload?.error?.message || `OpenAI transcription failed with HTTP ${response.status}.`,
      },
      metadata: {
        model,
        language: language || 'auto',
        latencyMs,
        status: response.status,
      },
    };
  }

  tutorDiagnostics.log('stt.completed',{model,language:language||'auto',status_code:response.status,duration_ms:latencyMs,output_chars:String(payload.text||'').length,ok:true});
  return {
    ok: true,
    text: payload.text || '',
    metadata: {
      model,
      language: language || 'auto',
      latencyMs,
      usage: payload.usage || null,
    },
  };
}
