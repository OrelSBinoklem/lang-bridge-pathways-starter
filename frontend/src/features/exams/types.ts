export type Question = { id: string; type: 'choice' | 'short' | 'essay' | 'speaking'; prompt: string; points: number; image?: string; has_audio?: boolean; options?: { id: string; text: string }[]; correct?: string; accepted?: string[]; explanation?: string; explanation_translations?: { ru?: string; uk?: string } };
export type ExamVisual = { title: string; text?: string; image?: string; credit?: string; bars?: { label: string; value: number }[]; chart_note?: string };
export type ExamReadingGroup = { title: string; announcements: { label: string; text: string }[]; question_ids: string[] };
export type ExamTask = { id: string; title: string; text?: string; image?: string; visuals?: ExamVisual[]; audio_seconds?: number; transcript?: string; questions: Question[]; reading_groups?: ExamReadingGroup[] };
export type ExamSection = { skill: string; seconds: number; tasks: ExamTask[] };
export type Grade = { points: number; maximum: number; feedback: string; example: string; errors?: { original: string; correction: string; explanation: string }[]; recommendation?: string };
export type TranscriptCandidate = { id: string; model: string; language: string; ok: boolean; text: string };
export type SectionResult = { skill: string; points: number; maximum: number; percent: number; passed: boolean; answers: Record<string, Grade> };
export type Attempt = {
  learn_lang?: 'lv' | 'en';
  received_at?: number;
  is_preview?: boolean;
  id: number; level: string; title: string; student_name: string; status: string; section_index: number;
  sections: ExamSection[]; answers: Record<string, { text?: string; source?: string; processing?: string; processing_error?: boolean; transcription_selected?: string; transcript_candidates?: TranscriptCandidate[] }>;
  playbacks: Record<string, { count: number; until?: number }>; server_now: string; deadline_at: string;
  started_at: string; submitted_at: string | null; next_attempt_at: string | null; retain_audio: boolean;
  results: SectionResult[] | null; score: number | null; passed: boolean | null; reviewed_at: string | null; grading_error: string | null;
};
export const skillNames: Record<string, string> = { listening: 'Слушание', reading: 'Чтение', writing: 'Письмо', speaking: 'Говорение' };
