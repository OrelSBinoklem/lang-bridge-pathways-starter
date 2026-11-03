import { reasoningRequest } from './reasoning.mjs';
import { assembleServiceInput } from '../../../../resources/ai-studio/assembly.mjs';

function extractText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  const chunks = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n');
}

function fallbackSummary({ previousSummary = '', messages = [] }) {
  const lines = messages
    .slice(-10)
    .map((message) => `${message.role}: ${message.text}`)
    .join('\n');
  return [previousSummary, lines].filter(Boolean).join('\n').slice(-2400);
}

export async function compressTutorContext({
  previousSummary = '',
  messages = [],
  model = process.env.OPENAI_CONTEXT_SUMMARY_MODEL || 'gpt-6-luna',
  signal,
  profile,
  onRequest,
  onResponse,
} = {}) {
  if (!messages.length) {
    return { ok: true, summary: previousSummary, metadata: { skipped: true } };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      summary: fallbackSummary({ previousSummary, messages }),
      metadata: { error: 'openai_key_missing', fallback: true },
    };
  }

  const inputPayload = {
    previous_summary: previousSummary,
    messages: messages.map((message) => ({
      role: message.role,
      text: message.text,
      createdAt: message.createdAt,
    })),
  };

  const startedAt = Date.now();
  if (profile?.model && profile.model !== 'inherit') model = profile.model;
  const reasoning = reasoningRequest({ reasoningEnabled: profile?.reasoning && !['none', 'inherit'].includes(profile.reasoning), reasoningEffort: profile?.reasoning }, model);
  const body = {
    model,
    input: [
      ...((profile?.prompts) || [[
        'Summarize a Latvian tutor chat memory for future turns.',
        'Keep persistent facts, user level signals, repeated mistakes, difficult words, active tasks, current exercise state, and unresolved instructions.',
        'Preserve Latvian words with diacritics exactly.',
        'Do not include filler greetings or one-off small talk.',
        'Answer in compact Russian, max 180 words.',
      ].join(' ')]).map(content => ({ role: 'developer', content })),
      { role: 'user', content: JSON.stringify(inputPayload) },
    ],
    ...(reasoning.reasoning ? { reasoning: reasoning.reasoning } : {}),
    max_output_tokens: profile?.maxOutputTokens > 0 ? profile.maxOutputTokens : reasoning.maxOutputTokens,
  };
  if (profile?.assembly) body.input = assembleServiceInput(profile.assembly, body.input);
  await onRequest?.(body);
  const response = await fetch('https://api.openai.com/v1/responses', {
    creditPurpose: 'conversation_summary',
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const latencyMs = Date.now() - startedAt;
  const payload = await response.json().catch(() => ({}));
  await onResponse?.(payload, response.status);

  if (!response.ok || ['incomplete', 'failed'].includes(payload.status) || !extractText(payload).trim()) {
    return {
      ok: false,
      summary: fallbackSummary({ previousSummary, messages }),
      metadata: {
        model,
        latencyMs,
        status: response.status,
        error: payload?.error || null,
        fallback: true,
      },
    };
  }

  return {
    ok: true,
    summary: extractText(payload).trim().slice(0, 2400),
    metadata: {
      model,
      latencyMs,
      usage: payload.usage || null,
    },
  };
}
