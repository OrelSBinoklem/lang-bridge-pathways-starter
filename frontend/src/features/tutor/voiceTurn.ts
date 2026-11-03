import profiles from '../../config/tutor-reasoning.json';

export type TutorVoiceMode = 'standard' | 'complex';

export function tutorReasoningEfforts(model: string | null): string[] {
  const name = (model || '').replace(/-\d{4}-\d{2}-\d{2}$/, '');
  return (profiles as Record<string, string[]>)[name] || [];
}

export function complexQuestionEffort(model: string | null) {
  const efforts = tutorReasoningEfforts(model);
  return ['high', 'xhigh', 'max', 'medium', 'low'].find(effort => efforts.includes(effort)) || null;
}
