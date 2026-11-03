import { readFileSync } from 'node:fs';

const profiles = JSON.parse(readFileSync(new URL('../../../../frontend/src/config/tutor-reasoning.json', import.meta.url), 'utf8'));

export function tutorModel(config = {}) {
  return config.tutorModel || process.env.OPENAI_TUTOR_MODEL || 'gpt-5.4';
}

export function reasoningProfile(model) {
  const name = String(model).replace(/-\d{4}-\d{2}-\d{2}$/, '');
  const efforts = profiles[name] || [];
  const enabled = efforts.filter(effort => effort !== 'none');
  const high = ['high', 'xhigh', 'max', 'medium', 'low'].find(effort => enabled.includes(effort)) || null;
  return { efforts, high, supportsUpdate: name === 'gpt-6.1-sol' };
}

export function resolveTutorTurnConfig(config = {}, questionMode) {
  const model = tutorModel(config);
  const profile = reasoningProfile(model);
  const complex = questionMode === 'complex';
  if (complex && !profile.high) {
    throw new Error(`Модель ${model} не поддерживает режим сложного вопроса.`);
  }
  const requested = config.reasoningEnabled === false ? 'none'
    : config.reasoningEffort || process.env.OPENAI_TUTOR_REASONING_EFFORT || 'none';
  const baseline = profile.efforts.includes(requested) ? requested : profile.efforts[0] || null;
  const effort = complex ? profile.high : baseline;
  return {
    ...config,
    tutorModel: model,
    tutorPipeline: config.tutorPipeline || process.env.OPENAI_TUTOR_PIPELINE || 'stt_text_tts',
    reasoningEnabled: Boolean(effort && effort !== 'none'),
    reasoningEffort: effort,
    reasoningBaseEffort: baseline,
    complexQuestion: complex,
  };
}

export function reasoningRequest(config, model) {
  const profile = reasoningProfile(model);
  const requested = config.reasoningEnabled ? config.reasoningEffort : 'none';
  const effort = profile.efforts.includes(requested) ? requested : profile.efforts[0] || null;
  // Keep the request-level effort and developer prefix fixed for GPT-6.1 Sol.
  const update = config.complexQuestion && profile.supportsUpdate;
  const baseline = profile.efforts.includes(config.reasoningBaseEffort)
    ? config.reasoningBaseEffort : profile.efforts[0];
  const reasoningLimit = effort && effort !== 'none' ? 8192 : 700;
  const presetLimit = Number.isInteger(config.maxOutputTokens) && config.maxOutputTokens >= 700 && config.maxOutputTokens <= 8192
    ? config.maxOutputTokens : reasoningLimit;
  return {
    reasoning: effort ? { effort: update ? baseline : effort } : undefined,
    update: update ? { type: 'configuration_update', reasoning: { effort } } : null,
    effort,
    maxOutputTokens: Math.min(reasoningLimit, presetLimit),
  };
}
