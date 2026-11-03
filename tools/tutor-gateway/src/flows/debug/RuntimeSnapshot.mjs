import { TRANSCRIPTION_CONTEXT_RULES } from '../../../../../resources/tutor-flow/transcription-contract.mjs';

/** Only administrative observation metadata; never changes the provider request. */
export function runtimePipelineSnapshot(config, context = {}, defaults = process.env) {
  const settings = context.recognitionSettings || config;
  const model = settings.transcriptionModel || defaults.OPENAI_TRANSCRIBE_MODEL || 'gpt-transcribe';
  return {
    sourceType: context.sourceType || 'user.message',
    recognition: { transcriptionModel: model,
      primaryTranscriptionLanguage: settings.primaryTranscriptionLanguage || '',
      dualTranscriptionEnabled: settings.dualTranscriptionEnabled === true,
      secondaryTranscriptionModel: settings.secondaryTranscriptionModel || model,
      secondaryTranscriptionLanguage: settings.secondaryTranscriptionLanguage || '' },
    ...(context.audioMetadata ? { recordingMetadata: { mimeType: String(context.audioMetadata.mimeType || ''), sizeBytes: Number.isFinite(context.audioMetadata.sizeBytes) ? context.audioMetadata.sizeBytes : null } } : {}),
    transcriptionRules: [...TRANSCRIPTION_CONTEXT_RULES],
  };
}
