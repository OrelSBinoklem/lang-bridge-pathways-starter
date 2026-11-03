'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { clientApi } from '@/lib/client-api';
import { ApiError } from '@/lib/api';
import styles from './blocks.module.css';
import { useLessonDraft } from '../useLessonDraft';
import { useLocale } from 'next-intl';

export type ReadingTranslationConfig = {
  source_text?: string;
};

export type SavedResponse = { lesson_block_variant_id: number | null; answer_text: string | null; status: string } | null;
export type TranslationResult = { attempt_id: number; variant_id: number; answer_text: string; score: number; feedback: string; is_practice: boolean; completed: boolean };

export function ReadingTranslationBlock({ blockId, variantId, config, lastResponse, translationResult, progress, onCompletion }: {
  blockId: number; variantId: number | null; config: ReadingTranslationConfig; lastResponse: SavedResponse;
  translationResult?: TranslationResult | null; progress?: { next_scored_at?: string | null }; onCompletion?: () => Promise<unknown>;
}) {
  const uk = useLocale() === 'uk';
  const inputId = useId();
  const previous = lastResponse?.lesson_block_variant_id === variantId ? lastResponse : null;
  const previousResult = translationResult?.variant_id === variantId ? translationResult : null;
  const [draft, setDraft] = useLessonDraft(`translation:${config.source_text ?? ''}`, { answer: previousResult?.answer_text ?? previous?.answer_text ?? '', submitted: false },
    (value): value is { answer: string; submitted: boolean } => typeof value === 'object' && value !== null
      && 'answer' in value && typeof value.answer === 'string' && 'submitted' in value && typeof value.submitted === 'boolean');
  const { answer } = draft;
  const [result, setResult] = useState<TranslationResult | null>(previousResult);
  const submission = useRef<{ answer: string; id: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const checked = result?.answer_text === answer.trim();
  const cooldown = progress?.next_scored_at && new Date(progress.next_scored_at).getTime() > now;

  async function submit() {
    if (!answer.trim() || saving || variantId === null) return;
    setSaving(true);
    setError('');
    try {
      if (submission.current?.answer !== answer.trim()) submission.current = { answer: answer.trim(), id: crypto.randomUUID() };
      const response = await clientApi<{ data: TranslationResult }>(`/lessons/blocks/${blockId}/translation-check`, {
        method: 'POST', body: JSON.stringify({ variant_id: variantId, answer_text: answer.trim(), submission_id: submission.current.id }),
      });
      setResult(response.data);
      submission.current = null;
      setDraft({ answer, submitted: true });
      setRefreshError('');
      try { await onCompletion?.(); }
      catch { setRefreshError(uk ? 'Оцінку збережено, але прогрес не оновився. Оновіть сторінку.' : 'Оценка сохранена, но прогресс не обновился. Обновите страницу.'); }
    } catch (error) {
      setError(error instanceof ApiError ? error.message : uk ? 'Не вдалося перевірити переклад. Спробуйте ще раз.' : 'Не удалось проверить перевод. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.translationTask}>
      <label htmlFor={inputId} className={styles.translationInstruction}>{uk ? 'Переклади текст з латиської російською своїми словами.' : 'Переведи текст с латышского на русский своими словами.'}</label>
      {config.source_text && <blockquote className={styles.translationSource}>{config.source_text}</blockquote>}
      <textarea id={inputId} value={answer} onChange={(event) => setDraft({ answer: event.target.value, submitted: false })} rows={5} maxLength={10000} placeholder={uk ? 'Напиши переклад…' : 'Напиши перевод…'} disabled={saving} />
      {checked && result && <div role="status">
        <p className={styles.scoreResult}><strong>{result.score}%</strong> · {result.is_practice ? (uk ? 'Тренування: рекорд не змінюється' : 'Тренировка: рекорд не меняется') : result.completed ? (uk ? 'Зараховано' : 'Зачтено') : (uk ? 'Не зараховано: потрібно 60%' : 'Не зачтено: нужно 60%')}</p>
        <p>{result.feedback}</p>
      </div>}
      {cooldown && <p>{uk ? 'Наступний залік' : 'Следующий зачёт'}: {new Date(progress!.next_scored_at!).toLocaleString(uk ? 'uk-UA' : 'ru-RU', { dateStyle: 'short', timeStyle: 'short' })}. {uk ? 'Зараз перевірка тренувальна.' : 'Сейчас проверка тренировочная.'}</p>}
      <button type="button" className={styles.submitAnswers} disabled={!answer.trim() || saving || variantId === null} onClick={checked ? () => { setResult(null); submission.current = null; } : submit}>{saving ? (uk ? 'Бот перевіряє…' : 'Бот проверяет…') : checked ? (uk ? 'Повторити' : 'Повторить') : (uk ? 'Перевірити переклад' : 'Проверить перевод')}</button>
      {error && <p className={styles.taskError} role="alert">{error}</p>}
      {refreshError && <p className={styles.taskError} role="alert">{refreshError}</p>}
    </div>
  );
}
