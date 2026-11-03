'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { clientApi } from '@/lib/client-api';
import { TrainingSessionModal } from '@/features/training/TrainingSessionModal';
import { buildItemTrainingQueue, type TrainingItem, type ItemQueueEntry, type TrainingDirection } from '@/features/training/item-training';
import { formatCooldownMs } from '@/features/training/helpers';
import { playAlphabetAudio, stopAlphabetAudio } from '@/features/training/alphabet-audio';
import type { BlockProgress } from '@/features/lessons/blocks/BinaryStatementsTask';
import type { GrammarConfig } from './GrammarTask';
import styles from './grammar-practice.module.css';

type ItemResult = {
  is_correct: boolean; expected: string; items: TrainingItem[]; progress: BlockProgress;
  is_practice: boolean; was_education: boolean;
};
type Feedback = ItemResult & { prompt: string; direction: TrainingDirection; key: string };

export function GrammarItemsTask({ blockId, variantId, config, progress, practice, onProgress, onRetry }: {
  blockId: number; variantId: number | null; config: GrammarConfig; progress: BlockProgress; practice: boolean;
  onProgress?: (next: BlockProgress) => void; onRetry?: () => Promise<unknown>;
}) {
  const uk = useLocale() === 'uk';
  const [items, setItems] = useState<TrainingItem[]>(config.items ?? []);
  const [queue, setQueue] = useState<ItemQueueEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [choiceMode, setChoiceMode] = useState(false);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const startRef = useRef<HTMLButtonElement>(null);
  const pendingRef = useRef(false);
  const refreshedAt = useRef<string | null>(null);
  useEffect(() => setItems(config.items ?? []), [config.items]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearInterval(timer); stopAlphabetAudio(); };
  }, []);
  const current = queue[index];
  const selected = items.find(item => item.key === current?.key);
  const side = selected && current ? selected.directions[current.direction] : null;
  const learned = items.filter(item => item.completed).length;
  const steps = items.reduce((sum, item) => sum + item.steps, 0);
  const score = items.length ? Math.floor(steps * 100 / (items.length * 4)) : 0;
  const available = buildItemTrainingQueue(items, practice);
  const nextReview = items.flatMap(item => Object.values(item.directions)
    .filter(value => !value.available && value.correct_attempts < 2).map(value => value.next_review_at))
    .filter((value): value is string => Boolean(value)).sort()[0];
  useEffect(() => {
    if (!nextReview || Date.parse(nextReview) > now || refreshedAt.current === nextReview || busy || started) return;
    refreshedAt.current = nextReview;
    void onRetry?.().catch(cause => {
      console.error('[grammar-review-refresh]', cause);
      refreshedAt.current = null;
    });
  }, [nextReview, now, busy, started, onRetry]);
  function replay(key: string) {
    void playAlphabetAudio(key).catch(cause => {
      console.error('[alphabet-audio]', cause);
      setError(uk ? 'Не вдалося відтворити аудіо.' : 'Не удалось воспроизвести аудио.');
    });
  }
  useEffect(() => {
    if (started && !retraining && current?.direction === 'direct') replay(current.key);
    return stopAlphabetAudio;
    // Playback follows the queue, never a progress refetch or countdown tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, retraining, index, current?.key, current?.direction]);
  function reset() { setAnswer(''); setFeedback(null); setError(''); }
  function begin() {
    if (!variantId || !available.length) return;
    setChoiceMode(/(?:^|;)\s*lbp_training_answer_mode=select(?:;|$)/.test(document.cookie));
    setQueue(buildItemTrainingQueue(items, practice));
    setIndex(0); reset(); setRetraining(false); setStarted(true);
  }
  function finish() {
    stopAlphabetAudio(); setStarted(false); setRetraining(false); reset();
    window.requestAnimationFrame(() => startRef.current?.focus());
  }
  async function submit(value = answer) {
    if (!selected || !side || !current || !variantId || pendingRef.current || feedback || (!practice && !side.available)) return;
    pendingRef.current = true; setBusy(true); setError(''); setAnswer(value);
    try {
      const tier = /(?:^|;)\s*lbp_cooldown_tier_pref=2(?:;|$)/.test(document.cookie) ? 2 : 0;
      const response = await clientApi<{ data: ItemResult }>(`/lessons/blocks/${blockId}/grammar-item`, {
        method: 'POST', body: JSON.stringify({ variant_id: variantId, item_key: current.key,
          direction: current.direction, answer: value.trim(), cooldown_tier: tier, practice }),
      });
      const result = response.data;
      setItems(result.items);
      setFeedback({ ...result, prompt: side.prompt, direction: current.direction, key: current.key });
      onProgress?.(result.progress);
      if (current.direction === 'reverse') replay(current.key);
    } catch (cause) {
      console.error('[grammar-item]', cause);
      setError(uk ? 'Не вдалося зберегти відповідь. Оновіть блок і спробуйте ще раз.' : 'Не удалось сохранить ответ. Обновите блок и попробуйте ещё раз.');
    } finally { pendingRef.current = false; setBusy(false); }
  }
  function advance() {
    reset();
    if (index + 1 < queue.length) { setIndex(index + 1); return; }
    const next = buildItemTrainingQueue(items, practice);
    if (practice || !next.length) { finish(); return; }
    setQueue(next); setIndex(0); setRetraining(true);
  }
  function cooldown(date: string | null) { return date ? Math.max(0, Date.parse(date) - now) : 0; }
  function renderSide(item: TrainingItem, direction: TrainingDirection) {
    const state = item.directions[direction];
    const remaining = cooldown(state.next_review_at);
    const value = direction === 'direct' ? item.display_hint : item.display_letter;
    return <span className={styles.pairValue}>
      {remaining > 0 ? <span className={styles.pairCooldown} title={new Date(state.next_review_at!).toLocaleString(uk ? 'uk-UA' : 'ru-RU')}>
        <i className="pi pi-clock" aria-hidden="true" />{formatCooldownMs(remaining)}
      </span> : value != null ? <span data-education={state.mode_education}>
        {state.mode_education && <i className="pi pi-book" aria-hidden="true" />} {value}
      </span> : <span className={styles.pairMask} aria-label={uk ? 'Приховано' : 'Скрыто'}><i /><i /></span>}
    </span>;
  }
  if (!variantId || !items.length) return <p role="status">{uk ? 'Завдання готується.' : 'Задание готовится.'}</p>;
  const resultItem = feedback && items.find(item => item.key === feedback.key);
  const resultSide = resultItem && feedback ? resultItem.directions[feedback.direction] : null;
  const wait = resultSide ? cooldown(resultSide.next_review_at) : 0;
  return <div className={styles.itemTask}>
    <div className={styles.itemSummary}>
      <span>{uk ? 'Вивчено' : 'Выучено'}: {learned} / {items.length}</span>
      <span>{steps} / {items.length * 4} · {Math.max(score, progress?.best_score ?? 0)}%</span>
    </div>
    <progress value={steps} max={items.length * 4} aria-label={uk ? 'Прогрес букв' : 'Прогресс букв'} />
    <div className={styles.pairLegend}><span>{uk ? 'Буква' : 'Буква'} ↔ {uk ? 'Читання' : 'Чтение'}</span>
      <span><i className="pi pi-clock" aria-hidden="true" /> {uk ? 'До повторення' : 'До повтора'}</span></div>
    <div className={styles.itemPairGrid} role="list" aria-label={uk ? 'Букви та читання' : 'Буквы и чтение'}>
      {items.map((item, position) => <div key={item.key} role="listitem" className={styles.itemPair}
        data-state={item.completed ? 'complete' : Object.values(item.directions).some(value => value.mode_education) ? 'education' : item.steps ? 'partial' : 'new'}>
        <span className={styles.pairNumber}>{position + 1}</span>
        {renderSide(item, 'reverse')}<span className={styles.pairDivider} aria-hidden="true">–</span>{renderSide(item, 'direct')}
        <span className={styles.pairSteps} aria-label={item.steps + ' / 4'}>
          {(['direct', 'reverse'] as const).flatMap(direction => [0, 1].map(step => <i key={direction + step}
            data-done={step < item.directions[direction].correct_attempts} />))}
        </span>
        {item.display_letter && <button type="button" className={styles.pairAudio} onClick={() => replay(item.key)}
          aria-label={(uk ? 'Назва букви ' : 'Название буквы ') + item.display_letter}
          title={uk ? 'Послухати назву букви' : 'Послушать название буквы'}><i className="pi pi-volume-up" aria-hidden="true" /></button>}
      </div>)}
    </div>
    <div className={styles.itemActions}>
      <button ref={startRef} type="button" className={styles.primary} onClick={begin} disabled={!available.length}>
        <i className="pi pi-play" aria-hidden="true" /> {uk ? 'Почати тренування блоку' : 'Начать тренировку блока'}
      </button>
      {!available.length && nextReview && <span className={styles.muted}>{uk ? 'Повторення через' : 'Повтор через'} {formatCooldownMs(cooldown(nextReview))}</span>}
      <button type="button" className={styles.refreshButton} onClick={() => void onRetry?.()} title={uk ? 'Оновити' : 'Обновить'} aria-label={uk ? 'Оновити' : 'Обновить'}><i className="pi pi-refresh" /></button>
      {error && !started && <p role="alert" className={styles.error}>{error}</p>}
    </div>
    {started && retraining && <TrainingSessionModal prompt={uk ? 'Режим донавчання' : 'Режим дообучения'}
      answer="" onAnswerChange={() => {}} showResult isCorrect isUpdating={false} selectionMode={false} choiceOptions={[]}
      meta={uk ? 'Повторимо букви, в яких були помилки.' : 'Повторим буквы, в которых были ошибки.'}
      nextLabel={uk ? 'Продовжити' : 'Продолжить'} onCheck={() => {}} onNext={() => setRetraining(false)} onFinish={finish} statusOnly />}
    {started && !retraining && selected && side && current && <TrainingSessionModal
      prompt={feedback?.prompt ?? side.prompt} meta={`${index + 1} / ${queue.length} · ${current.direction === 'direct'
        ? (uk ? 'Читання' : 'Чтение') : (uk ? 'Написання' : 'Написание')}`}
      answer={answer} onAnswerChange={setAnswer} showResult={Boolean(feedback)} isCorrect={feedback?.is_correct ?? false}
      isUpdating={busy} selectionMode={choiceMode} choiceOptions={side.choices}
      onCheck={value => void submit(value ?? answer)} onNext={advance} onFinish={finish}
      nextLabel={uk ? 'Далі' : 'Далее'} onReplay={current.direction === 'direct' || feedback ? () => replay(current.key) : undefined}
      notice={side.mode_education ? (uk ? 'Донавчання' : 'Дообучение') : undefined}
      correctAnswer={feedback?.expected} error={error}
      resultNotice={feedback?.is_practice ? (uk ? 'Без зміни прогресу.' : 'Без изменения прогресса.')
        : wait > 0 ? (uk ? 'Повторення через ' : 'Повтор через ') + formatCooldownMs(wait)
        : feedback && !feedback.is_correct ? (uk ? 'Буква повернеться в донавчанні.' : 'Буква вернётся в дообучении.') : undefined}
    />}
  </div>;
}
