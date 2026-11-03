export type TutorActivity = {
  phase: 'idle' | 'transcribing' | 'thinking' | 'reference';
  commandId?: string;
};

type ActivityEvent = {
  type: string;
  status?: string;
  ok?: boolean;
  text?: string;
  commandId?: string;
  action?: { type: string; endpoint?: string };
};

export const idleTutorActivity: TutorActivity = { phase: 'idle' };

export function tutorActivityReducer(current: TutorActivity, event: ActivityEvent): TutorActivity {
  switch (event.type) {
    case 'request.text':
      return { phase: 'thinking' };
    case 'request.audio':
      return { phase: 'transcribing' };
    case 'tutor.thinking':
      return event.status === 'started' ? { phase: 'thinking' } : idleTutorActivity;
    case 'transcription.result':
      return event.ok && event.text?.trim() ? { phase: 'thinking' } : idleTutorActivity;
    case 'ui.command':
      return event.action?.type === 'client_api' && event.action.endpoint === '/tutor/references'
        ? { phase: 'reference', commandId: event.commandId } : current;
    case 'reference.settled':
      return current.phase === 'reference' && current.commandId === event.commandId
        ? { phase: 'thinking' } : current;
    case 'activity.reset':
    case 'session.ready':
    case 'assistant.message':
    case 'tts.audio':
    case 'tts.playback.started':
    case 'error':
      return idleTutorActivity;
    default:
      return current;
  }
}

export function tutorActivityLabel(activity: TutorActivity): string {
  switch (activity.phase) {
    case 'transcribing': return 'Распознаёт речь…';
    case 'thinking': return 'Бот думает…';
    case 'reference': return 'Проверяет по словарю…';
    default: return '';
  }
}
