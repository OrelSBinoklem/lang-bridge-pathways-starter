const extendedRetentionModels = /^(gpt-5\.5(?:-pro)?|gpt-5\.4|gpt-5\.2|gpt-5\.1(?:-codex(?:-max|-mini)?|-chat-latest)?|gpt-5(?:-codex)?|gpt-4\.1)(?:-\d{4}-\d{2}-\d{2})?$/;

export function tutorPromptCache(model, retention = process.env.OPENAI_TUTOR_PROMPT_CACHE_RETENTION || '24h') {
  if (!['24h', 'in_memory', 'default'].includes(retention)) throw new Error('Invalid tutor prompt cache retention.');
  // Newer model families have different TTLs and write prices. Do not guess their settings.
  return extendedRetentionModels.test(model) && retention !== 'default'
    ? { prompt_cache_retention: retention } : {};
}
