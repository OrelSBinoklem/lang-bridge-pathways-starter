'use client';

import { useMemo, useState } from 'react';
import { clientApi } from '@/lib/client-api';
import styles from './blocks.module.css';
import { useLessonDraft } from '../useLessonDraft';
import { useQueryClient } from '@tanstack/react-query';

export type BinaryQuestion = { statement: string };

export type BlockProgress = {
  best_score: number | null;
  best_rank: string | null;
  best_rank_label: string | null;
  cooldown_tier: number;
  next_scored_at: string | null;
  is_training: boolean;
} | null;

type AttemptResult = {
  score: number;
  rank: string | null;
  rank_label: string | null;
  is_practice: boolean;
  completed: boolean;
  feedback: Array<{ statement: string; correct: boolean; selected: boolean; is_correct: boolean; explanation: string }>;
  progress: BlockProgress;
  transcript?: string | null;
  support_mode?: 'normal' | 'translated_questions';
  score_multiplier?: number;
};

function cooldownTierFromCookie() {
  const matched = document.cookie.match(/(?:^|;)\s*lbp_cooldown_tier_pref=([^;]+)/);
  return matched?.[1]?.trim() === '2' ? 2 : 0;
}

function remainingTime(nextScoredAt: string | null) {
  if (!nextScoredAt) return null;
  const remaining = new Date(nextScoredAt).getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.ceil((remaining % 3_600_000) / 60_000);
  return hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}

export function BinaryStatementsTask({ blockId, variantId, questions, progress, onRetry, onCompletion, assistanceAvailable = false, assistanceActive = false, assistedQuestions = [] }: {
  blockId: number;
  variantId: number | null;
  questions: BinaryQuestion[];
  progress: BlockProgress;
  onRetry?: () => Promise<unknown>;
  onCompletion?: () => Promise<unknown>;
  assistanceAvailable?: boolean;
  assistanceActive?: boolean;
  assistedQuestions?: string[];
}) {
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useLessonDraft<Array<boolean | null>>(`answers:${JSON.stringify(questions)}`, questions.map(() => null),
    (value): value is Array<boolean | null> => Array.isArray(value) && value.length === questions.length && value.every(answer => answer === null || typeof answer === 'boolean'));
  const [result, setResult] = useLessonDraft<AttemptResult | null>(`result:${JSON.stringify(questions)}`, null,
    (value): value is AttemptResult | null => value === null || (typeof value === 'object' && 'score' in value && typeof value.score === 'number'
      && 'feedback' in value && Array.isArray(value.feedback) && value.feedback.length === questions.length
      && value.feedback.every((item, index) => item && item.statement === questions[index].statement && typeof item.is_correct === 'boolean')));
  const transcript = result?.transcript;
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');
  const [assisted, setAssisted] = useLessonDraft('assisted', assistanceActive, (value): value is boolean => typeof value === 'boolean');
  const [translations, setTranslations] = useLessonDraft('translations', assistedQuestions,
    (value): value is string[] => Array.isArray(value) && (value.length === 0 || value.length === questions.length) && value.every(item => typeof item === 'string'));
  const [loadingAssistance, setLoadingAssistance] = useState(false);
  const allAnswered = questions.length > 0 && answers.length === questions.length && answers.every((answer) => answer !== null);
  const currentProgress = result?.progress ?? progress;
  const remaining = useMemo(() => remainingTime(currentProgress?.next_scored_at ?? null), [currentProgress?.next_scored_at]);
  const training = currentProgress?.is_training ?? false;

  async function enableAssistance() {
    if (assisted || loadingAssistance || submitting || result) return;
    setLoadingAssistance(true);
    setError('');
    try {
      const response = await clientApi<{ data: { questions: string[]; score_multiplier: number } }>(`/lessons/blocks/${blockId}/assistance`, {
        method: 'POST', body: JSON.stringify({ variant_id: variantId }),
      });
      if (!Array.isArray(response.data.questions) || response.data.questions.length !== questions.length) throw new Error('Invalid assistance response');
      setTranslations(response.data.questions);
      setAssisted(true);
      setAnswers(questions.map(() => null));
    } catch {
      setError('Не удалось загрузить облегчённый режим. Обнови страницу перед продолжением.');
    } finally {
      setLoadingAssistance(false);
    }
  }

  async function submit() {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await clientApi<{ data: AttemptResult }>(`/lessons/blocks/${blockId}/attempt`, {
        method: 'POST',
        body: JSON.stringify({ variant_id: variantId, answers, cooldown_tier: cooldownTierFromCookie() }),
      });
      setResult(response.data);
      void queryClient.invalidateQueries({ queryKey: ['lesson-page'], refetchType: 'none' });
      void queryClient.invalidateQueries({ queryKey: ['course-path'], refetchType: 'none' });
      void onCompletion?.().catch(() => console.warn('Practice ranks could not be refreshed.'));
    } catch {
      setError('Не удалось сохранить попытку. Проверь соединение и попробуй ещё раз.');
    } finally {
      setSubmitting(false);
    }
  }

  async function retryPractice() {
    setRetrying(true);
    setError('');
    try {
      await onRetry?.();
      setAnswers(questions.map(() => null));
      setResult(null);
      setAssisted(false);
      setTranslations([]);
    } catch {
      setError('Не удалось загрузить следующий вариант. Попробуй ещё раз.');
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className={styles.binaryTask}>
      {assistanceAvailable && <div className={styles.assistanceMode} role="group" aria-label="Режим задания">
        <button type="button" aria-pressed={!assisted} disabled={assisted || submitting || loadingAssistance || Boolean(result)}>Обычный</button>
        <button type="button" aria-pressed={assisted} disabled={assisted || submitting || loadingAssistance || Boolean(result)} onClick={enableAssistance}>
          {loadingAssistance ? 'Загрузка…' : 'Облегчённый · 80%'}</button>
        <span>{assisted ? 'Максимум 80%' : 'Максимум 100%'}</span>
      </div>}
      {training && !result && remaining && <p className={styles.trainingNotice}>Сейчас тренировочный режим. Зачётная попытка станет доступна через {remaining}; максимум не изменится.</p>}
      <table className={styles.binaryQuestions} aria-label="Утверждения">
        <colgroup><col /><col className={styles.binaryAnswer} /></colgroup>
        <tbody>
        {questions.map((question, index) => {
          const feedback = result?.feedback[index];
          return (
            <tr key={`${index}:${question.statement}`} className={`${styles.binaryQuestion} ${feedback ? (feedback.is_correct ? styles.binaryCorrect : styles.binaryWrong) : ''}`}>
              <th scope="row">
                <p>{assisted ? translations[index] ?? question.statement : question.statement}</p>
                {feedback && !feedback.is_correct && <p className={styles.binaryFeedback}>Верный ответ: {feedback.correct ? 'да' : 'нет'}{feedback.explanation ? `. ${feedback.explanation}` : ''}</p>}
              </th>
              <td>
                <div className={styles.binaryControls} role="group" aria-label={`Ответ на утверждение ${index + 1}`}>
                  <button type="button" aria-pressed={answers[index] === true} className={answers[index] === true ? styles.binarySelected : ''} disabled={Boolean(result) || submitting || loadingAssistance} onClick={() => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? true : answer))}>Да</button>
                  <button type="button" aria-pressed={answers[index] === false} className={answers[index] === false ? styles.binarySelected : ''} disabled={Boolean(result) || submitting || loadingAssistance} onClick={() => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? false : answer))}>Нет</button>
                </div>
              </td>
            </tr>
          );
        })}
        </tbody>
      </table>
      {result ? (
        <div className={styles.scoreResult}>
          <strong>{result.score}%{result.rank_label ? ` - ${result.rank_label}` : ''}</strong>
          {result.support_mode === 'translated_questions' && <span>Облегчённый · ×0,8</span>}
          <span>{result.is_practice ? 'Тренировка: результат не меняет личный максимум.' : result.completed ? 'Зачётная попытка сохранена.' : 'Для ранга нужно не менее 60%.'}</span>
          <button type="button" disabled={retrying} onClick={retryPractice}>{retrying ? 'Загрузка…' : 'Попробовать ещё раз'}</button>
        </div>
      ) : (
        <button type="button" className={styles.submitAnswers} disabled={!allAnswered || submitting || loadingAssistance} onClick={submit}>
          {submitting ? 'Проверяю…' : training ? 'Потренироваться' : 'Проверить'}
        </button>
      )}
      {transcript && <details className={styles.transcript}><summary>Транскрипт</summary><p>{transcript}</p></details>}
      {error && <p className={styles.taskError} role="alert">{error}</p>}
    </div>
  );
}
