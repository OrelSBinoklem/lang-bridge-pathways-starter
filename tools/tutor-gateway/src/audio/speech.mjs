import { readSpeechEvents } from './googleSpeech.mjs';

const defaultSpeechInstructions = [
  'Speak exactly the input text in the same language as it is written. Do not translate or switch languages.',
  'For Russian text, use natural Russian pronunciation. For Latvian text, use natural Latvian pronunciation.',
  'Use slightly slower speech for A1-B1 learners.',
].join(' ');

export const speechStyleInstructions = {
  neutral_teacher:
    'Use a calm, professional, classroom-appropriate teacher tone. Avoid intimate, seductive, whispery, or theatrical delivery.',
  warm_encouragement:
    'Sound warm and encouraging, with light positive emotion. Keep it professional and not intimate.',
  gentle_correction:
    'Sound gentle and supportive while correcting a mistake. Do not sound disappointed. Emphasize corrected Latvian words naturally.',
  calm_explanation:
    'Use a calm explanatory tone for Russian explanations. Speak clearly and not dramatically.',
  playful_practice:
    'Use a lightly playful practice-drill tone, energetic but still teacher-like and not childish.',
};

export function buildSpeechInstructions(style = 'neutral_teacher') {
  const styleInstruction = speechStyleInstructions[style] || speechStyleInstructions.neutral_teacher;
  return `${defaultSpeechInstructions} ${styleInstruction}`;
}

const supportsSpeechInstructions = (model) => !['tts-1', 'tts-1-hd'].includes(model);
const legacyTtsVoices = new Set(['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer']);

const resolveSpeechVoice = (model, voice) => {
  if (!['tts-1', 'tts-1-hd'].includes(model)) return voice;
  return legacyTtsVoices.has(voice) ? voice : 'nova';
};

export async function synthesizeSpeech({
  text,
  model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
  voice = process.env.OPENAI_TTS_VOICE || 'onyx',
  instructions = defaultSpeechInstructions,
  signal,
}) {
  const input = String(text || '').trim();
  if (!input) {
    return {
      ok: false,
      error: {
        code: 'empty_tts_input',
        message: 'TTS input is empty.',
      },
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      error: {
        code: 'openai_key_missing',
        message: 'OPENAI_API_KEY is not configured on the tutor gateway.',
      },
    };
  }

  const startedAt = Date.now();
  const resolvedVoice = resolveSpeechVoice(model, voice);
  const requestBody = {
    model,
    voice: resolvedVoice,
    input: input.slice(0, 4096),
    response_format: 'mp3',
  };

  if (supportsSpeechInstructions(model)) {
    requestBody.instructions = instructions;
    requestBody.stream_format = 'sse';
  }

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    return {
      ok: false,
      error: {
        code: payload?.error?.code || 'tts_failed',
        message: payload?.error?.message || `OpenAI speech failed with HTTP ${response.status}.`,
      },
      metadata: {
        model,
        voice: resolvedVoice,
        requestedVoice: voice,
        latencyMs: Date.now() - startedAt,
        status: response.status,
      },
    };
  }

  let buffer, usage = null;
  if (requestBody.stream_format === 'sse') {
    const chunks = [];
    let size = 0, done = false;
    for await (const event of readSpeechEvents(response.body, signal)) {
      if (event.type === 'speech.audio.delta' && typeof event.audio === 'string') {
        const chunk = Buffer.from(event.audio, 'base64');
        size += chunk.length;
        if (size > 12 * 1024 * 1024) throw new Error('Speech exceeds audio limit');
        chunks.push(chunk);
      }
      if (event.type === 'speech.audio.done') { done = true; usage = event.usage || null; }
      if (event.type === 'error') throw new Error('Speech generation failed');
    }
    if (!done || !size) throw new Error('Speech stream did not complete');
    buffer = Buffer.concat(chunks);
  } else buffer = Buffer.from(await response.arrayBuffer());
  return {
    ok: true,
    audio: buffer.toString('base64'),
    mimeType: 'audio/mpeg',
    metadata: {
      model,
      voice: resolvedVoice,
      requestedVoice: voice,
      latencyMs: Date.now() - startedAt,
      sizeBytes: buffer.length,
      usage,
    },
  };
}
