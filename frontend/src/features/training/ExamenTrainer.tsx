'use client';
import { fetchProgress } from '@/features/training/progress-api';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { CategoryWordReorderModal } from '@/features/admin/CategoryWordReorderModal';
import { WordAdminPanel } from '@/features/admin/WordAdminPanel';
import {
  AdminModeProvider,
  getCustomCategoryComponent,
  readForceDefaultExamenView,
  usesInlineFieldTraining,
} from '@/features/custom-categories';
import ExamenViewModeSwitch from '@/features/custom-categories/components/ExamenViewModeSwitch';
import { formatTime as formatCooldownTime } from '@/features/custom-categories/utils/helpers';
import '@/features/custom-categories/custom-categories.css';
import { playWordAudio } from '@/features/training/audio';
import { generateChoiceOptions } from '@/features/training/choiceOptions';
import { DenseHardestPickerModal } from '@/features/training/DenseHardestPickerModal';
import { HelpModal } from '@/features/training/HelpModal';
import { MatchGame } from '@/features/training/MatchGame';
import { RetrainingNoticeModal, TrainingEmptyModal, TrainingModal } from '@/features/training/TrainingModal';
import {
  closeTrainingSocket,
  ensureTrainingSocket,
  submitAttempt,
} from '@/features/training/trainingSocket';
import { WordEducationRow } from '@/features/training/WordEducationRow';
import {
  buildDenseQueue,
  buildTrainingQueue,
  countPhraseWords,
  DictWord,
  evaluateAnswer,
  getWordDisplayStatusExamen,
  getNextAvailableQueueIndex,
  isGarumOnlyMismatch,
  PHRASE_WORD_MIN_COUNT,
  ProgressRow,
  QueueItem,
  stripParenthesesAndPunctuation,
} from '@/features/training/helpers';
import styles from '@/features/training/examen-trainer.module.css';
import { clientApi } from '@/lib/client-api';

type DenseState = {
  exists: boolean;
  attempts_left: number;
  waiting_remaining_sec: number;
  dense_word_ids_direct: number[];
  dense_word_ids_revert: number[];
  active_word_ids: number[];
};

type SubCategory = { id: number; name: string };

function getCooldownTierPref(): number {
  if (typeof document === 'undefined') return 0;
  const m = document.cookie.match(/(?:^|; )lbp_cooldown_tier_pref=([^;]+)/);
  const v = Number(m?.[1] ?? 0);
  return Number.isFinite(v) ? Math.max(0, Math.min(2, v)) : 0;
}

function getAnswerMode(): 'type' | 'select' {
  if (typeof document === 'undefined') return 'type';
  const m = document.cookie.match(/(?:^|; )lbp_training_answer_mode=([^;]+)/);
  return m?.[1] === 'select' ? 'select' : 'type';
}

function wordInCategory(word: DictWord, catId: number) {
  return word.category_ids.includes(catId);
}

function wordInAny(word: DictWord, catIds: number[]) {
  return catIds.some((id) => wordInCategory(word, id));
}

/** Нормализуем ответ API attempts → ProgressRow для патча кеша */
function toProgressRow(row: Partial<ProgressRow> & { dict_word_id: number }): ProgressRow {
  return {
    dict_word_id: row.dict_word_id,
    attempts: Number(row.attempts) || 0,
    correct_attempts: Number(row.correct_attempts) || 0,
    attempts_revert: Number(row.attempts_revert) || 0,
    correct_attempts_revert: Number(row.correct_attempts_revert) || 0,
    last_shown: row.last_shown ?? null,
    last_shown_revert: row.last_shown_revert ?? null,
    mode_education: !!row.mode_education,
    mode_education_revert: !!row.mode_education_revert,
    cooldown_tier: Number(row.cooldown_tier) || 0,
    cooldown_tier_revert: Number(row.cooldown_tier_revert) || 0,
    easy_correct: !!row.easy_correct,
    easy_correct_revert: !!row.easy_correct_revert,
  };
}

export function ExamenTrainer({
  dictionaryId,
  categoryId,
  categoryName,
  learnLang,
  subcategories = [],
  words,
  isAuthenticated,
  adminMode = false,
}: {
  dictionaryId: number;
  categoryId: number;
  categoryName?: string;
  /** Fallback, если у слова нет learn_lang */
  learnLang?: string | null;
  subcategories?: SubCategory[];
  words: DictWord[];
  isAuthenticated: boolean;
  adminMode?: boolean;
}) {
  const t = useTranslations('Training');
  const locale = useLocale();
  const qc = useQueryClient();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [phraseRetryUsed, setPhraseRetryUsed] = useState(false);
  const [started, setStarted] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [denseAddMode, setDenseAddMode] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [waitMsg, setWaitMsg] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  /** Окно «режим дообучения» между циклами (как WP showRetrainingNotice) */
  const [showRetrainingNotice, setShowRetrainingNotice] = useState(false);
  const [pendingQueue, setPendingQueue] = useState<QueueItem[] | null>(null);
  /** Дополнительная админ-панель остаётся доступной, но не раскрывается сама. */
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    if (!adminMode) setAdminOpen(false);
  }, [adminMode]);
  const [trainingScopeId, setTrainingScopeId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [hardestOpen, setHardestOpen] = useState(false);
  const [hardestPercentInit, setHardestPercentInit] = useState(15);
  /** Тренировка в ячейках кастомной таблицы (как WP inlineFieldTrainingActive) */
  const [inlineFieldTrainingActive, setInlineFieldTrainingActive] = useState(false);
  /** Номер цикла стека inline-тренировки (после окна дообучения) */
  const [inlineStackEpoch, setInlineStackEpoch] = useState(0);
  const [inlineRetrainingNotice, setInlineRetrainingNotice] = useState(false);
  const [forceDefaultView, setForceDefaultView] = useState(false);

  useEffect(() => {
    setForceDefaultView(readForceDefaultExamenView());
    const onPop = () => setForceDefaultView(readForceDefaultExamenView());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [dictionaryId, categoryId]);

  const progressQuery = useQuery({
    queryKey: ['progress', dictionaryId],
    enabled: isAuthenticated,
    queryFn: () => fetchProgress(dictionaryId),
  });

  const denseQuery = useQuery({
    queryKey: ['dense', categoryId],
    enabled: isAuthenticated,
    retry: 1,
    // поллим только пока реально ждём интервал плотного — не при ошибке и не «всегда»
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false;
      const wait = query.state.data?.data?.waiting_remaining_sec ?? 0;
      if (wait > 0) return 5000;
      return false;
    },
    queryFn: () => clientApi<{ data: DenseState }>(`/training/dense?category_id=${categoryId}`),
  });

  const progressById = useMemo(() => {
    const map: Record<number, ProgressRow> = {};
    for (const row of progressQuery.data?.data ?? []) map[row.dict_word_id] = row;
    return map;
  }, [progressQuery.data]);

  const wordsById = useMemo(() => {
    const map: Record<number, DictWord> = {};
    for (const w of words) map[w.id] = w;
    return map;
  }, [words]);

  const allCategoryIds = useMemo(
    () => [categoryId, ...subcategories.map((s) => s.id)],
    [categoryId, subcategories],
  );

  const categoryWords = useMemo(
    () => words.filter((w) => wordInAny(w, allCategoryIds)),
    [words, allCategoryIds],
  );

  const scopeWords = useMemo(() => {
    if (trainingScopeId == null) return categoryWords;
    return words.filter((w) => wordInCategory(w, trainingScopeId));
  }, [words, categoryWords, trainingScopeId]);

  const directWords = useMemo(
    () => words.filter((w) => wordInCategory(w, categoryId)),
    [words, categoryId],
  );

  const hasSubs = subcategories.length > 0;
  const dense = denseQuery.data?.data;
  const denseActiveIds = new Set(dense?.active_word_ids ?? []);
  const current = queue[index] ?? null;

  function resolveLearnLang(word?: DictWord | null): string {
    return word?.learn_lang || learnLang || 'LV';
  }

  // Прямой режим: автоплей при показе слова (как WP Examen)
  useEffect(() => {
    if (!started || !current || current.mode) return;
    playWordAudio(current.word.word, resolveLearnLang(current.word), current.word.sound_url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, current?.word.id, current?.mode, current?.phase, index]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  function buildQueue(denseState?: DenseState | null, scope: DictWord[] = scopeWords): QueueItem[] {
    if (
      denseState?.exists &&
      denseState.dense_word_ids_direct.length + denseState.dense_word_ids_revert.length > 0
    ) {
      return buildDenseQueue(
        wordsById,
        denseState.dense_word_ids_direct,
        denseState.dense_word_ids_revert,
      );
    }
    return buildTrainingQueue(scope, progressById);
  }

  function resetCardState() {
    setAnswer('');
    setShowResult(false);
    setIsCorrect(false);
    setPhraseRetryUsed(false);
  }

  function rebuildQueue(denseState?: DenseState | null, scope: DictWord[] = scopeWords) {
    setQueue(buildQueue(denseState, scope));
    setIndex(0);
    resetCardState();
  }

  useEffect(() => {
    if (!started) return;
    rebuildQueue(dense, scopeWords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, trainingScopeId]);

  function patchProgressRow(row: ProgressRow) {
    qc.setQueryData<{ data: ProgressRow[] }>(['progress', dictionaryId], (old) => {
      if (!old?.data) return { data: [row] };
      const i = old.data.findIndex((r) => r.dict_word_id === row.dict_word_id);
      if (i < 0) return { ...old, data: [...old.data, row] };
      const data = old.data.slice();
      data[i] = { ...data[i], ...row };
      return { ...old, data };
    });
  }

  const attemptMutation = useMutation({
    mutationFn: async (payload: {
      word_id: number;
      is_revert: boolean;
      is_correct: boolean;
      is_first_attempt: boolean;
      /** Последнее слово текущего цикла → полный refetch прогресса словаря */
      refreshAllProgress: boolean;
    }) => {
      const { refreshAllProgress, ...body } = payload;
      if (dense?.exists) {
        const res = await clientApi<{ data: DenseState }>('/training/dense/answer', {
          method: 'POST',
          body: JSON.stringify({
            category_id: categoryId,
            word_id: body.word_id,
            is_revert: body.is_revert,
            is_correct: body.is_correct,
          }),
        });
        return { kind: 'dense' as const, dense: res.data, refreshAllProgress };
      }

      // Обычный цикл: HTTP /training/attempt (default) или WS при TRANSPORT=ws
      const row = await submitAttempt({
        ...body,
        cooldown_tier: getCooldownTierPref(),
      });
      return {
        kind: 'attempts' as const,
        row: toProgressRow(row),
        refreshAllProgress,
      };
    },
    onSuccess: async (result) => {
      if (result.kind === 'dense') {
        qc.setQueryData(['dense', categoryId], { data: result.dense });
        return;
      }

      patchProgressRow(result.row);
      if (result.refreshAllProgress) {
        await qc.invalidateQueries({ queryKey: ['progress', dictionaryId] });
      }
    },
  });

  const denseAddMutation = useMutation({
    mutationFn: (wordIds: number[]) =>
      clientApi('/training/dense/words', {
        method: 'POST',
        body: JSON.stringify({
          dictionary_id: dictionaryId,
          category_id: categoryId,
          word_ids: wordIds,
          use_random: true,
        }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['dense', categoryId] });
      setDenseAddMode(false);
    },
  });

  const denseRemoveMutation = useMutation({
    mutationFn: (wordId: number) =>
      clientApi('/training/dense/remove-word', {
        method: 'POST',
        body: JSON.stringify({ category_id: categoryId, word_id: wordId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dense', categoryId] }),
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      clientApi('/training/reset-category', {
        method: 'POST',
        body: JSON.stringify({
          category_id: categoryId,
          word_ids: categoryWords.map((w) => w.id),
        }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['progress', dictionaryId] });
      await qc.invalidateQueries({ queryKey: ['dense', categoryId] });
    },
  });

  function openHardestPicker(pct = 15) {
    if (!isAuthenticated) return;
    setHardestPercentInit(pct);
    setHardestOpen(true);
    setMoreOpen(false);
  }

  async function confirmHardestToDense(_percent: number, wordIds: number[]) {
    if (wordIds.length === 0) return;
    await denseAddMutation.mutateAsync(wordIds);
    setHardestOpen(false);
  }

  async function startTraining(subcategoryId: number | null = null) {
    if (!isAuthenticated) return;
    const state = denseQuery.data?.data;
    if (state?.exists && state.waiting_remaining_sec > 0) {
      setWaitMsg(t('denseWait', { sec: state.waiting_remaining_sec }));
      return;
    }

    // Плотный режим — HTTP dense; обычный — HTTP attempt или WS (TRANSPORT=ws)
    if (!state?.exists) {
      try {
        await ensureTrainingSocket();
      } catch {
        setWaitMsg(t('wsUnavailable'));
        return;
      }
    }

    setWaitMsg(null);
    setSelectionMode(getAnswerMode() === 'select');
    setTrainingScopeId(subcategoryId);

    const scope =
      subcategoryId == null
        ? categoryWords
        : words.filter((w) => wordInCategory(w, subcategoryId));
    if (buildQueue(state, scope).length === 0) {
      window.alert(t('noAvailableWords'));
      return;
    }

    if (
      usesInlineFieldTraining(dictionaryId, categoryId) &&
      !forceDefaultView &&
      subcategoryId == null &&
      !state?.exists
    ) {
      setInlineStackEpoch(0);
      setInlineRetrainingNotice(false);
      setInlineFieldTrainingActive(true);
      return;
    }

    setStarted(true);
    rebuildQueue(state, scope);
  }

  function finishTraining() {
    setStarted(false);
    setInlineFieldTrainingActive(false);
    setInlineRetrainingNotice(false);
    setInlineStackEpoch(0);
    setShowRetrainingNotice(false);
    setPendingQueue(null);
    resetCardState();
    setIndex(0);
    setQueue([]);
    closeTrainingSocket();
  }

  function completeTraining() {
    finishTraining();
    window.alert(t('availableWordsComplete'));
  }

  function continueInlineRetraining() {
    setInlineRetrainingNotice(false);
    setInlineStackEpoch((e) => e + 1);
  }

  function continueRetraining() {
    if (!pendingQueue?.length) {
      setShowRetrainingNotice(false);
      setPendingQueue(null);
      return;
    }
    setQueue(pendingQueue);
    setIndex(0);
    setPendingQueue(null);
    setShowRetrainingNotice(false);
    resetCardState();
  }

  async function onCheck(overrideAnswer?: string) {
    if (!current || !isAuthenticated || attemptMutation.isPending || showResult) return;
    const toCheck =
      overrideAnswer != null && String(overrideAnswer).trim()
        ? String(overrideAnswer).trim()
        : answer.trim();
    if (overrideAnswer != null) setAnswer(toCheck);

    const { correct, correctAnswers, allAcceptableVariants } = evaluateAnswer(
      current.word,
      toCheck,
      current.mode,
      locale,
    );

    const isManualTyped = !selectionMode && overrideAnswer == null;
    const maxPhraseWords = correctAnswers.length
      ? Math.max(...correctAnswers.map((a) => countPhraseWords(stripParenthesesAndPunctuation(a))))
      : 0;
    const canPhraseRetry =
      isManualTyped &&
      !!toCheck &&
      !correct &&
      !phraseRetryUsed &&
      maxPhraseWords >= PHRASE_WORD_MIN_COUNT &&
      allAcceptableVariants.length > 0 &&
      !isGarumOnlyMismatch(toCheck, allAcceptableVariants);

    if (canPhraseRetry) {
      setPhraseRetryUsed(true);
      return;
    }

    const p = progressById[current.word.id];
    const easy = current.mode ? !!p?.mode_education_revert : !!p?.mode_education;

    try {
      await attemptMutation.mutateAsync({
        word_id: current.word.id,
        is_revert: current.mode,
        is_correct: correct,
        is_first_attempt: !phraseRetryUsed && !easy,
        refreshAllProgress: index >= queue.length - 1,
      });
    } catch (e) {
      setWaitMsg(e instanceof Error ? e.message : t('saveError'));
      return;
    }

    if (current.mode) {
      playWordAudio(current.word.word, resolveLearnLang(current.word), current.word.sound_url);
    }

    setIsCorrect(correct);
    setShowResult(true);
    if (correct) setDenseAddMode(false);
  }

  function onNextWord() {
    resetCardState();
    const denseState = denseQuery.data?.data;
    const next = denseState?.exists
      ? index + 1
      : getNextAvailableQueueIndex(queue, index, progressById);
    if (next >= 0 && next < queue.length) {
      setIndex(next);
      return;
    }

    const fresh = buildQueue(denseState, scopeWords);

    // Плотное дообучение — сразу новый стек, без окна дообучения
    if (
      denseState?.exists &&
      denseState.dense_word_ids_direct.length + denseState.dense_word_ids_revert.length > 0
    ) {
      setQueue(fresh);
      setIndex(0);
      return;
    }

    if (fresh.length === 0) {
      completeTraining();
      return;
    }

    // Конец цикла direct+revert → окно «режим дообучения», затем новый цикл
    setPendingQueue(fresh);
    setShowRetrainingNotice(true);
  }

  function toggleDenseWord(wordId: number) {
    if (!denseAddMode || !isAuthenticated) return;
    if (denseActiveIds.has(wordId)) {
      denseRemoveMutation.mutate(wordId);
    } else {
      denseAddMutation.mutate([wordId]);
    }
  }

  function renderWordRow(w: DictWord) {
    return (
      <WordEducationRow
        key={w.id}
        dictionaryId={dictionaryId}
        word={w}
        progress={progressById[w.id]}
        dense={denseActiveIds.has(w.id)}
        denseAttemptsLeft={dense?.attempts_left}
        denseWaitSec={dense?.waiting_remaining_sec}
        denseAddMode={denseAddMode}
        adminMode={adminMode}
        translationLang={locale}
        onDenseToggle={toggleDenseWord}
        now={now}
      />
    );
  }

  const choiceOptions = useMemo(() => {
    if (!selectionMode || !current || showResult) return [];
    return generateChoiceOptions({
      word: current.word,
      mode: current.mode,
      categoryId,
      dictionaryWords: words,
      progressById,
      learnLang: resolveLearnLang(current.word),
      translationLang: locale,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionMode, current?.word.id, current?.mode, showResult, categoryId]);

  const busy = started && !!current;

  const CustomCategoryComponent = useMemo(
    () =>
      getCustomCategoryComponent(dictionaryId, categoryId) as ComponentType<
        Record<string, unknown>
      > | null,
    [dictionaryId, categoryId],
  );
  const useCustomTemplate = Boolean(CustomCategoryComponent) && !forceDefaultView;

  const displayStatuses = useMemo(() => {
    const map: Record<number, ReturnType<typeof getWordDisplayStatusExamen>> = {};
    for (const w of categoryWords) {
      map[w.id] = getWordDisplayStatusExamen(progressById[w.id], now);
    }
    return map;
  }, [categoryWords, progressById, now]);

  async function refreshUserData() {
    await qc.invalidateQueries({ queryKey: ['progress', dictionaryId] });
  }

  return (
    <AdminModeProvider active={adminMode} isAdmin={adminMode}>
    <div className={styles.wrapper}>
      {!started && !inlineFieldTrainingActive && (
        <div className={styles.toolbar}>
          <div className={styles.startActions}>
            <button
              type="button"
              className={styles.startBtn}
              data-word-tour="start"
              disabled={!isAuthenticated || busy}
              onClick={() => startTraining(null)}
              title={!isAuthenticated ? t('authTitle') : undefined}
            >
              {t('startBtn')}
            </button>
            <button
              type="button"
              className={styles.denseAutoBtn}
              data-word-tour="dense"
              disabled={!isAuthenticated || denseAddMutation.isPending}
              onClick={() => openHardestPicker(15)}
            >
              {t('denseHardestBtn')}
            </button>
          </div>
          <span className={styles.toolbarSpacer} />
          <button
            type="button"
            className={styles.helpBtn}
            data-word-tour="help"
            onClick={() => setShowHelp(true)}
            title={t('helpTitle')}
          >
            {t('helpButton')}
          </button>
          <div className={styles.burgerWrap}>
            <button
              type="button"
              className={`${styles.burgerBtn} ${moreOpen ? styles.burgerBtnOpen : ''}`}
              aria-label={t('moreActions')}
              data-word-tour="more"
              onClick={() => setMoreOpen((v) => !v)}
            >
              <span className={styles.burgerLine} />
              <span className={styles.burgerLine} />
              <span className={styles.burgerLine} />
            </button>
            <div className={`${styles.burgerMenu} ${moreOpen ? styles.burgerMenuOpen : ''}`}>
              <button
                type="button"
                className={`${styles.burgerItem} ${styles.burgerItemHelp}`}
                onClick={() => {
                  setShowHelp(true);
                  setMoreOpen(false);
                }}
              >
                {t('helpButton')}
              </button>
              <button
                type="button"
                className={`${styles.burgerItem} ${styles.burgerItemGreen}`}
                disabled={!isAuthenticated}
                onClick={() => {
                  clientApi('/training/set-easy-mode', {
                    method: 'POST',
                    body: JSON.stringify({ category_id: categoryId }),
                  }).then(() => qc.invalidateQueries({ queryKey: ['progress', dictionaryId] }));
                  setMoreOpen(false);
                }}
              >
                {t('easyMode')}
              </button>
              <button
                type="button"
                className={`${styles.burgerItem} ${styles.burgerItemPurple}`}
                disabled={!isAuthenticated}
                onClick={() => {
                  clientApi('/training/demote-scores', {
                    method: 'POST',
                    body: JSON.stringify({ category_id: categoryId }),
                  }).then(() => qc.invalidateQueries({ queryKey: ['progress', dictionaryId] }));
                  setMoreOpen(false);
                }}
              >
                {t('demoteScores')}
              </button>
              <button
                type="button"
                className={`${styles.burgerItem} ${styles.burgerItemGame}`}
                onClick={() => {
                  setShowMatch(true);
                  setMoreOpen(false);
                }}
              >
                {t('game')}
              </button>
              <button
                type="button"
                className={`${styles.burgerItem} ${styles.burgerItemDense} ${
                  denseAddMode ? styles.burgerItemDenseActive : ''
                }`}
                disabled={!isAuthenticated}
                onClick={() => {
                  setDenseAddMode((v) => !v);
                  setMoreOpen(false);
                }}
              >
                {denseAddMode
                  ? t('exitDensePick')
                  : t('denseWords', { count: denseActiveIds.size })}
              </button>
              {adminMode && (
                <button
                  type="button"
                  className={`${styles.burgerItem} ${styles.burgerItemReorder}`}
                  onClick={() => {
                    setReorderOpen(true);
                    setMoreOpen(false);
                  }}
                >
                  {t('showAdminPanel')}
                </button>
              )}
              <button
                type="button"
                className={`${styles.burgerItem} ${styles.burgerItemClear}`}
                disabled={!isAuthenticated}
                onClick={() => {
                  resetMutation.mutate();
                  setMoreOpen(false);
                }}
              >
                {t('resetProgress')}
              </button>
            </div>
          </div>
        </div>
      )}

      {adminMode && !started && (
        <div className={styles.adminStrip}>
          <button type="button" className={styles.adminStripBtn} onClick={() => setAdminOpen((v) => !v)}>
            {adminOpen ? t('hideAdminWords') : t('showAdminWords')}
          </button>
          {adminOpen && <span className={styles.adminStripHint}>{t('adminStripHint')}</span>}
        </div>
      )}

      {!isAuthenticated && <div className={styles.authHint}>{t('authHint')}</div>}
      {waitMsg && <div className={styles.waitBanner}>{waitMsg}</div>}
      {denseAddMode && (
        <div className={styles.denseHint}>
          <span>{t('denseHint')}</span>
          <button type="button" className={styles.denseHintClose} onClick={() => setDenseAddMode(false)}>
            ×
          </button>
        </div>
      )}

      {CustomCategoryComponent && forceDefaultView && adminMode && !started && (
        <ExamenViewModeSwitch forceDefaultView />
      )}

      {inlineFieldTrainingActive && !inlineRetrainingNotice && (
        <div className="verb-inline-training-bar">
          <span>🎯 Тренировка в таблице — вводите слово в подсвеченное поле</span>
          <button
            type="button"
            className="verb-inline-training-bar__finish"
            onClick={finishTraining}
          >
            <span className="verb-inline-training-bar__finish-x" aria-hidden="true">
              ×
            </span>
            Завершить
          </button>
        </div>
      )}

      {useCustomTemplate && CustomCategoryComponent && (!started || inlineFieldTrainingActive) && (
        <CustomCategoryComponent
          category={{ id: categoryId, category_name: categoryName || `Категория ${categoryId}` }}
          categoryId={categoryId}
          words={categoryWords}
          dictionaryId={dictionaryId}
          dictionaryWords={words}
          dictionaryWordsById={wordsById}
          userWordsData={progressById}
          displayStatuses={displayStatuses}
          editingWordId={null}
          onToggleEdit={() => {}}
          onRefreshDictionaryWords={() =>
            void qc.invalidateQueries({ queryKey: ['dictionary-words', dictionaryId] })
          }
          onRefreshUserData={refreshUserData}
          formatTime={formatCooldownTime}
          mode="examen"
          currentTime={now}
          translationLang={locale}
          inlineTrainingActive={inlineFieldTrainingActive && !inlineRetrainingNotice}
          inlineStackEpoch={inlineStackEpoch}
          onInlineTrainingComplete={completeTraining}
          onInlineStackExhausted={() => {
            void (async () => {
              await refreshUserData();
              setInlineRetrainingNotice(true);
            })();
          }}
        />
      )}

      {!started &&
        !useCustomTemplate &&
        (hasSubs ? (
          <>
            {subcategories.map((sub) => {
              const subWords = words.filter((w) => wordInCategory(w, sub.id));
              if (subWords.length === 0) return null;
              return (
                <section key={sub.id} className={styles.subBlock}>
                  <h4 className={styles.subTitle} data-word-tour="subgroup">
                    <span className={styles.subTitleLabel}>{sub.name}</span>
                    <button
                      type="button"
                      className={styles.startBtn}
                      disabled={!isAuthenticated}
                      onClick={() => startTraining(sub.id)}
                    >
                      {t('startBtn')}
                    </button>
                  </h4>
                  <ul className={styles.wordList}>{subWords.map(renderWordRow)}</ul>
                </section>
              );
            })}
            {directWords.length > 0 && (
              <section className={styles.subBlock}>
                <h4 className={styles.subTitle}>
                  <span className={styles.subTitleLabel}>{t('remainingWords')}</span>
                </h4>
                <ul className={styles.wordList}>{directWords.map(renderWordRow)}</ul>
              </section>
            )}
          </>
        ) : (
          <ul className={styles.wordList}>{categoryWords.map(renderWordRow)}</ul>
        ))}

      {((started && showRetrainingNotice) || inlineRetrainingNotice) && (
        <RetrainingNoticeModal
          onContinue={inlineRetrainingNotice ? continueInlineRetraining : continueRetraining}
          onReview={finishTraining}
        />
      )}

      {started &&
        !showRetrainingNotice &&
        (current ? (
          <TrainingModal
            word={current.word}
            mode={current.mode}
            learnLang={resolveLearnLang(current.word)}
            translationLang={locale}
            meta={`${categoryName ? `${categoryName} · ` : ''}${index + 1}/${queue.length} · ${
              current.phase === 'direct' ? t('direct') : t('reverse')
            }`}
            answer={answer}
            onAnswerChange={setAnswer}
            showResult={showResult}
            isCorrect={isCorrect}
            isUpdating={attemptMutation.isPending}
            phraseRetryTooltip={phraseRetryUsed && !showResult}
            selectionMode={selectionMode}
            choiceOptions={choiceOptions}
            onCheck={(override) => void onCheck(override)}
            onNext={onNextWord}
            onFinish={finishTraining}
          />
        ) : (
          <TrainingEmptyModal onFinish={finishTraining} />
        ))}

      {adminMode && adminOpen && !started && (
        <WordAdminPanel
          dictionaryId={dictionaryId}
          categoryId={categoryId}
          words={categoryWords}
          allDictionaryWords={words}
        />
      )}

      {adminMode && reorderOpen && !started && (
        <CategoryWordReorderModal
          dictionaryId={dictionaryId}
          categoryId={categoryId}
          subcategories={subcategories}
          words={categoryWords}
          onClose={() => setReorderOpen(false)}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ['dictionary-words', dictionaryId] });
            await qc.invalidateQueries({ queryKey: ['progress', dictionaryId] });
          }}
        />
      )}

      {showMatch && (
        <MatchGame
          words={categoryWords}
          categoryId={categoryId}
          translationLang={locale}
          onClose={() => setShowMatch(false)}
        />
      )}

      <DenseHardestPickerModal
        open={hardestOpen}
        onClose={() => setHardestOpen(false)}
        words={categoryWords}
        progressById={progressById}
        activeDenseIds={[...denseActiveIds]}
        initialPercent={hardestPercentInit}
        translationLang={locale}
        submitting={denseAddMutation.isPending}
        onConfirm={confirmHardestToDense}
      />

      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
    </AdminModeProvider>
  );
}
