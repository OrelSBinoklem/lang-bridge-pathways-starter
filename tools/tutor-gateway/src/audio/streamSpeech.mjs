import { randomUUID } from 'node:crypto';
import { streamGoogleSpeech } from './googleSpeech.mjs';
import { buildSpeechInstructions } from './speech.mjs';
import { ttsCatalog } from './ttsConfig.mjs';
import { tutorDiagnostics } from '../diagnostics.mjs';

export async function streamSpeechToSocket({ ws, segment, model = ttsCatalog.defaultModel, voice, playbackId, segmentIndex = 0, segmentCount = null, signal,
  synthesize = streamGoogleSpeech, streamId = randomUUID() }) {
  if (signal?.aborted || ws.readyState !== ws.OPEN) return false;
  const envelope = { streamId, playbackId: playbackId ?? null };
  const started=Date.now();let chunks=0,bytes=0;
  const diagnostic={model,voice,stream_id:streamId,playback_id:playbackId,segment_index:segmentIndex,text_chars:String(segment.text||'').length};
  tutorDiagnostics.log('tts.start',diagnostic);
  const send = data => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ ...data, ...envelope })); };
  const metadata = { provider: 'google', model, voice, segmentIndex, segmentCount,
    segmentText: segment.text, segmentStyle: segment.style || 'neutral_teacher', speaker: segment.speaker || 'tutor', streaming: true };
  send({ type: 'tts.stream.start', format: 'pcm_s16le', sampleRate: 24000, channels: 1, metadata });
  try {
    const result = await synthesize({ text: segment.text, model, voice, instructions: buildSpeechInstructions(segment.style), signal,
      onChunk: ({ pcm, sequence }) => {
        if(chunks===0)tutorDiagnostics.log('tts.first_audio',{...diagnostic,first_audio_ms:Date.now()-started});
        chunks++;bytes+=pcm.length;
        if (signal?.aborted || ws.readyState !== ws.OPEN) throw new DOMException('Speech cancelled.', 'AbortError');
        if (ws.bufferedAmount > 2 * 1024 * 1024) throw new Error('Speech playback connection is too slow.');
        send({ type: 'tts.stream.chunk', sequence, audio: pcm.toString('base64') });
      } });
    if (signal?.aborted) throw new DOMException('Speech cancelled.', 'AbortError');
    send({ type: 'tts.stream.end', ok: true, metadata: { ...metadata, ...result } });
    tutorDiagnostics.log('tts.completed',{...diagnostic,ok:true,chunks,stream_bytes:bytes,duration_ms:Date.now()-started});
    return true;
  } catch (error) {
    const cancelled = Boolean(signal?.aborted || ws.readyState !== ws.OPEN);
    tutorDiagnostics.log('tts.failed',{...diagnostic,cancelled,error_type:error?.name||'Error',chunks,stream_bytes:bytes,duration_ms:Date.now()-started});
    // Provider messages can contain private request details. Keep them off the socket and logs.
    if (!cancelled) console.error('[tutor] Google speech stream failed', {
      code: 'google_tts_failed', reason: error?.name || 'Error',
      httpStatus: String(error?.message ?? '').match(/HTTP (\d{3})/)?.[1] ?? null,
      credentialsConfigured: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    });
    send({ type: 'tts.stream.end', ok: false, cancelled, metadata,
      error: cancelled ? undefined : { code: error?.status === 402 ? 'credits_unavailable' : 'google_tts_failed',
        message: error?.status === 402 ? 'Недостаточно кредитов для озвучки. Текст ответа сохранён.' : 'Не удалось озвучить ответ через Google. Повтор не запускался. Можно выбрать прежнюю озвучку в настройках.' } });
    return false;
  }
}
