const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';
const MAX_DIALOGUE_CHARS = 2000;

function missingKey() {
  return {
    ok: false,
    error: {
      code: 'elevenlabs_key_missing',
      message: 'ELEVENLABS_API_KEY is not configured on the tutor gateway.',
    },
  };
}

async function errorResult(response, metadata) {
  const payload = await response.json().catch(() => ({}));
  return {
    ok: false,
    error: {
      code: payload?.detail?.status || payload?.detail?.code || payload?.error?.code || 'elevenlabs_tts_failed',
      message: payload?.detail?.message || payload?.detail || payload?.error?.message || `ElevenLabs speech failed with HTTP ${response.status}.`,
    },
    metadata: {
      ...metadata,
      status: response.status,
    },
  };
}

function baseMetadata(response, startedAt, model) {
  return {
    provider: 'elevenlabs',
    model,
    latencyMs: Date.now() - startedAt,
    characterCost: response.headers.get('character-cost') || null,
    requestId: response.headers.get('request-id') || null,
  };
}

export async function synthesizeElevenLabsSpeech({
  text,
  voiceId = process.env.ELEVENLABS_TTS_VOICE_ID || '',
  model = process.env.ELEVENLABS_TTS_MODEL || 'eleven_v3',
  languageCode = process.env.ELEVENLABS_TTS_LANGUAGE || '',
  signal,
}) {
  const input = String(text || '').trim();
  if (!input) return { ok: false, error: { code: 'empty_tts_input', message: 'TTS input is empty.' } };
  if (!process.env.ELEVENLABS_API_KEY) return missingKey();
  if (!voiceId) {
    return {
      ok: false,
      error: {
        code: 'elevenlabs_voice_missing',
        message: 'ELEVENLABS_TTS_VOICE_ID is not configured on the tutor gateway.',
      },
    };
  }

  const startedAt = Date.now();
  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: input.slice(0, 5000),
      model_id: model,
      language_code: languageCode || undefined,
    }),
    signal,
  });
  const metadata = { ...baseMetadata(response, startedAt, model), voiceId };
  if (!response.ok) return errorResult(response, metadata);

  const audio = Buffer.from(await response.arrayBuffer());
  return {
    ok: true,
    audio: audio.toString('base64'),
    mimeType: 'audio/mpeg',
    metadata: { ...metadata, sizeBytes: audio.length },
  };
}

export async function synthesizeElevenLabsDialogue({
  segments,
  voiceIds,
  model = process.env.ELEVENLABS_DIALOGUE_MODEL || 'eleven_v3',
  languageCode = process.env.ELEVENLABS_TTS_LANGUAGE || '',
  signal,
}) {
  if (!process.env.ELEVENLABS_API_KEY) return missingKey();

  const inputs = (Array.isArray(segments) ? segments : [])
    .map((segment) => ({
      text: String(segment?.text || '').trim(),
      voice_id: voiceIds?.[segment?.speaker] || voiceIds?.tutor || '',
    }))
    .filter((segment) => segment.text);
  const characterCount = inputs.reduce((total, input) => total + input.text.length, 0);
  if (!inputs.length) return { ok: false, error: { code: 'empty_dialogue_input', message: 'Dialogue input is empty.' } };
  if (inputs.some((input) => !input.voice_id)) {
    return {
      ok: false,
      error: {
        code: 'elevenlabs_dialogue_voice_missing',
        message: 'Configure a voice ID for every dialogue role used (ELEVENLABS_DIALOGUE_VOICE_A_ID and ELEVENLABS_DIALOGUE_VOICE_B_ID).',
      },
    };
  }
  if (characterCount > MAX_DIALOGUE_CHARS) {
    return {
      ok: false,
      error: {
        code: 'dialogue_too_long',
        message: `Dialogue is ${characterCount} characters; ElevenLabs dialogue requests are limited to ${MAX_DIALOGUE_CHARS}.`,
      },
      metadata: { provider: 'elevenlabs', model, characterCount, maxCharacters: MAX_DIALOGUE_CHARS },
    };
  }

  const startedAt = Date.now();
  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-dialogue?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs,
      model_id: model,
      language_code: languageCode || undefined,
    }),
    signal,
  });
  const metadata = { ...baseMetadata(response, startedAt, model), characterCount, speakers: [...new Set(inputs.map((input) => input.voice_id))].length };
  if (!response.ok) return errorResult(response, metadata);

  const audio = Buffer.from(await response.arrayBuffer());
  return {
    ok: true,
    audio: audio.toString('base64'),
    mimeType: 'audio/mpeg',
    metadata: { ...metadata, sizeBytes: audio.length },
  };
}
