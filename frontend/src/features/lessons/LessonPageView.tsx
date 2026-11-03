'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { clientApi } from '@/lib/client-api';
import { useUserPreview } from '@/features/admin/useUserPreview';
import { setLessonTutorSlot } from '@/features/tutor/lessonContextBridge';
import { renderLessonBlock, type LessonBlockData } from './blockRegistry';
import styles from './lesson-page.module.css';
import { GrammarTopicHeader, type GrammarTopicData } from '@/features/grammar-practice/GrammarTopicHeader';
import { GrammarExtensionBadge } from '@/features/grammar-practice/GrammarExtensionBadge';
import type { BlockProgress } from './blocks/BinaryStatementsTask';
import type { GrammarConfig } from '@/features/grammar-practice/GrammarTask';
import { type PracticeNavigation, type PracticeVariantRank } from './practiceSkills';
import { isVariantSelection, lessonDraftKey, lessonSelectionKey } from './draftStorage';
import { LessonDraftContext, useStoredLessonState } from './useLessonDraft';
import { useLessonProgressRefresh, type LessonCompletionEvent } from './useLessonCompletion';
import { isPracticeSelections, practiceSelectionKey, resolvePracticeSelection, type PracticeSelections } from './practiceSelection';
import { PracticeRankBadge, practiceRankDescription } from './PracticeRankBadge';

type LessonPageData = {
  id: number;
  title: string;
  slug: string;
  course_group_id: number | null;
  level: string | null;
  learn_lang: string;
  description: string | null;
  completed: boolean;
  combined_practice?: boolean;
  skill?: string;
  practice_navigation?: PracticeNavigation[];
  practice_variant_ranks?: PracticeVariantRank[];
  skill_progress?: { additional_variants?: number } | null;
  grammar_topic?: GrammarTopicData | null;
  blocks: LessonBlockData[];
};

export function LessonPageView({ slug }: { slug: string }) {
  return <IdentifiedLessonPage key={slug} slug={slug} />;
}

function IdentifiedLessonPage({ slug }: { slug: string }) {
  const uk = useLocale() === 'uk';
  const [identity, setIdentity] = useState<{ id: number } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let controller: AbortController;
    function identify() {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setFailed(false);
      clientApi<{ user: { id: number } }>('/user', { signal }).then(response => {
        if (!signal.aborted) setIdentity(response.user);
      }).catch(() => { if (!signal.aborted) setFailed(true); });
    }
    identify();
    window.addEventListener('focus', identify);
    return () => { controller.abort(); window.removeEventListener('focus', identify); };
  }, []);
  if (failed) return <p className={styles.status} role="alert">{uk ? 'Не вдалося перевірити акаунт.' : 'Не удалось проверить аккаунт.'} <Link href="/login">{uk ? 'Увійти' : 'Войти'}</Link></p>;
  if (!identity) return <p className={styles.status}>{uk ? 'Завантаження…' : 'Загрузка…'}</p>;
  return <LessonPageContent key={`${identity.id}:${slug}`} userId={identity.id} slug={slug} />;
}

function LessonPageContent({ slug, userId }: { slug: string; userId: number }) {
  const uk = useLocale() === 'uk';
  const userPreview = useUserPreview();
  const refreshCompletion = useLessonProgressRefresh(userId);
  const [storedVariants, storeVariants] = useStoredLessonState<Record<number, number>>(lessonSelectionKey(userId, slug), {}, isVariantSelection);
  const [selectedVariants, setSelectedVariants] = useState(storedVariants);
  const [practiceSelections, storePracticeSelections] = useStoredLessonState<PracticeSelections>(practiceSelectionKey(userId), {}, isPracticeSelections);
  const [practice, setPractice] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);
  const [liveProgress, setLiveProgress] = useState<Record<string, BlockProgress>>({});
  const [activeTutorId, setActiveTutorId] = useState<number | null>(null);
  const query = useQuery<{ data: LessonPageData }>({
    refetchOnWindowFocus: false,
    staleTime: 0,
    queryKey: ['lesson-page', userId, slug, selectedVariants, practiceSelections],
    placeholderData: previous => previous,
    queryFn: async ({ signal }) => {
      const load = (variants: Record<number, number>) => {
        const params = new URLSearchParams();
        params.set('combined', '1');
        for (const [blockId, variantId] of Object.entries(variants)) params.set(`variants[${blockId}]`, String(variantId));
        const suffix = params.size ? `?${params.toString()}` : '';
        return clientApi<{ data: LessonPageData }>(`/lessons/${encodeURIComponent(slug)}${suffix}`, { signal });
      };
      const initial = await load(selectedVariants);
      const selection = resolvePracticeSelection(initial.data, practiceSelections);
      // Resolve each block's actual retained IDs; ordinal 2 is not necessarily its old variant 2.
      if (selection && initial.data.blocks.some(block => selection.variants[block.id] != null
        && selection.variants[block.id] !== block.variant_id)) {
        return load(selection.variants);
      }
      return initial;
    },
  });
  const loadedPage = query.data?.data;
  useEffect(() => {
    function onCompleted(event: Event) {
      const detail = (event as CustomEvent<LessonCompletionEvent>).detail;
      if (!detail?.endpoint || !/^\/tutor\/lesson-blocks\/\d+\/complete$/.test(detail.endpoint)) return;
      void refreshCompletion().catch(() => console.warn('Lesson progress could not be refreshed.'));
    }
    window.addEventListener('tutor.lesson.completed', onCompleted);
    return () => window.removeEventListener('tutor.lesson.completed', onCompleted);
  }, [refreshCompletion]);
  const course = useQuery({
    enabled: Boolean(loadedPage?.course_group_id),
    queryKey: ['lesson-course-prerequisites', userId, loadedPage?.course_group_id, loadedPage?.learn_lang],
    queryFn: () => clientApi<{ data: { id: string; steps: { group_id: number | null; kind: string; status: string }[];
      groups: { id: number; skills?: { grammar?: { progress?: { completed: boolean } | null } } }[] }[] }>(
        `/course?learn_lang=${encodeURIComponent(loadedPage?.learn_lang ?? 'lv')}`),
  });

  useEffect(() => {
    if (!query.data) return;
    const revealBlock = () => {
      const id = window.location.hash.slice(1);
      if (/^lesson-block-\d+$/.test(id)) {
        const blockId = Number(id.replace('lesson-block-', ''));
        if (query.data.data.blocks.some(block => block.id === blockId && ['writing', 'speaking'].includes(block.type))) setActiveTutorId(blockId);
        document.getElementById(id)?.scrollIntoView({ block: 'start' });
      }
    };
    revealBlock();
    window.addEventListener('hashchange', revealBlock);
    return () => window.removeEventListener('hashchange', revealBlock);
  }, [query.data]);

  if (query.isLoading) return <p className={styles.status}>{uk ? 'Завантаження…' : 'Загрузка…'}</p>;
  if (query.isError) {
    return (
      <div className={styles.status} role="alert">
        {uk ? 'Не вдалося завантажити урок.' : 'Не удалось загрузить урок.'} <Link href="/course">{uk ? 'До курсу' : 'К курсу'}</Link>
        {Object.keys(selectedVariants).length > 0 && <button type="button" onClick={() => { storeVariants({}); setSelectedVariants({}); }}>
          {uk ? 'Відкрити початковий варіант' : 'Открыть исходный вариант'}
        </button>}
      </div>
    );
  }

  const page = query.data!.data;
  const groupSelection = resolvePracticeSelection(page, practiceSelections);
  const courseLevel = course.data?.data.find(level => level.groups.some(group => group.id === page.course_group_id));
  const laterSkill = ['listening', 'reading', 'writing', 'speaking'].includes(page.skill ?? '');
  const isGrammar = page.skill === 'grammar';
  const required = page.blocks.filter(block => block.is_required);
  const requiredScores = required.map(block => (liveProgress[`${block.id}:${block.variant_id}`] ?? block.progress)?.best_score ?? 0);
  const allScores = page.blocks.map(block => (liveProgress[`${block.id}:${block.variant_id}`] ?? block.progress)?.best_score ?? 0);
  const score = allScores.length ? Math.round(allScores.reduce((sum, value) => sum + value, 0) / allScores.length) : 0;
  const summary = { total: requiredScores.length, passed: requiredScores.filter(value => value >= 60).length, score,
    rank_label: requiredScores.length > 0 && requiredScores.every(value => value >= 60) ? (score === 100 ? 'Бриллиант' : score >= 90 ? 'Золото' : score >= 80 ? 'Серебро' : score >= 60 ? 'Бронза' : null) : null };
  const hasTutor = page.blocks.some((block) => block.type === 'writing' || block.type === 'speaking');
  const combined = page.combined_practice === true;
  const activeTutorIndex = combined ? page.blocks.findIndex(block => block.id === activeTutorId && ['writing', 'speaking'].includes(block.type)) : -1;
  const tutorRow = activeTutorIndex >= 0 ? activeTutorIndex * 2 + 1 : undefined;
  const courseParams = new URLSearchParams();
  if (page.level ?? courseLevel?.id) courseParams.set('level', (page.level ?? courseLevel?.id)!);
  if (page.course_group_id != null) {
    courseParams.set('group', String(page.course_group_id));
    courseParams.set('skill', isGrammar ? 'grammar' : page.skill ?? 'listening');
  }
  const courseHref = `${page.learn_lang === 'en' ? '/course/english' : '/course'}${courseParams.size ? `?${courseParams}` : ''}`;
  const showCompletion = isGrammar ? summary.total > 0 && summary.passed === summary.total : page.completed;
  return (
    <section aria-label={isGrammar ? page.title : undefined} className={`${styles.root} ${groupSelection ? styles.practiceRoot : ''} ${hasTutor && !combined ? styles.withTutor : ''} ${combined ? styles.combinedPractice : ''} ${isGrammar ? styles.grammar : ''}`}>
      {laterSkill && <div className={styles.practiceToolbar}>
      <h1 className={styles.practiceHeading}>{page.title}</h1>
      {groupSelection && <fieldset className={styles.practiceVariantToggle}>
        <legend>{uk ? 'Варіант практики' : 'Вариант практики'}</legend>
        <div className={styles.practiceVariantOptions}>
          {[1, 2, 3].map(number => <label key={number}>
            <input type="radio" name="practice-variant" value={number} checked={groupSelection.number === number}
              aria-label={`${uk ? 'Варіант' : 'Вариант'} ${number}`} aria-describedby={`practice-variant-rank-${number}`}
              onChange={() => storePracticeSelections(current => ({ ...current, [groupSelection.scope]: number }))} />
            <span className={styles.practiceVariantOption}>
              <span><span className={styles.practiceVariantWord}>{uk ? 'Варіант' : 'Вариант'} </span>{number}</span>
              <span id={`practice-variant-rank-${number}`} aria-label={practiceRankDescription(page.practice_variant_ranks?.find(summary => summary.number === number), uk)}><PracticeRankBadge summary={page.practice_variant_ranks?.find(summary => summary.number === number)} uk={uk} /></span>
            </span>
          </label>)}
        </div>
      </fieldset>}
      </div>}
      <div className={styles.lessonContent}>
      {((!isGrammar && !laterSkill) || page.description || showCompletion || (laterSkill && (page.skill_progress?.additional_variants ?? 0) > 0)) && (
      <header className={styles.header}>
        {!isGrammar && !laterSkill && <h1>{page.title}</h1>}
        {page.description && <p className={styles.description}>{page.description}</p>}
        {showCompletion && <p className={styles.completedBanner}>{uk ? '✓ Урок зарахований' : '✓ Урок зачтён'}</p>}
        {laterSkill && (page.skill_progress?.additional_variants ?? 0) > 0 && <p className={styles.additionalVariants}>
          {uk ? 'Додаткових варіантів завершено' : 'Дополнительных вариантов завершено'}: {page.skill_progress!.additional_variants}
        </p>}
      </header>
      )}
      {isGrammar && <GrammarTopicHeader courseHref={courseHref} topic={page.grammar_topic ?? null} summary={summary} practice={practice} busy={switchingMode} onPractice={async value => {
        if (value === practice || switchingMode) return;
        setSwitchingMode(true);
        try {
          const refreshed = await query.refetch();
          if (!refreshed.isError) setPractice(value);
        } finally { setSwitchingMode(false); }
      }} />}
      <div className={`${styles.blocks} ${combined ? styles.combinedBlocks : ''}`} aria-busy={query.isPlaceholderData}>
        {query.isPlaceholderData ? <p className={styles.status} role="status">{uk ? 'Завантаження варіанта…' : 'Загрузка варианта…'}</p> : page.blocks.map((block, index) => {
          const config = block.config as Partial<GrammarConfig>;
          const showVariantPicker = !groupSelection && page.slug !== 'grammar-a1-alphabet' && config.task_kind !== 'grammar_items'
            && Boolean(block.variants && block.variants.length > 1);
          const compact = isGrammar && block.type === 'grammar'
            && (!config.instruction || ['grammar_set', 'grammar_select'].includes(config.task_kind ?? ''))
            && ['grammar_gap', 'grammar_select', 'grammar_correct', 'grammar_set'].includes(config.task_kind ?? '')
            && config.questions?.length === 1 && !showVariantPicker;
          const active = combined && block.id === activeTutorId;
          return <section key={block.id} id={`lesson-block-${block.id}`} className={`${styles.block} ${compact ? styles.compactBlock : ''} ${active ? styles.activePracticeBlock : ''}`}
            style={{ scrollMarginTop: 90, ...(combined ? { gridRow: index * 2 + 1, gridColumn: active ? '1' : '1 / -1' } : {}) }}>
            {combined && <p className={styles.skillLabel}>{({ listening: uk ? 'Слухання' : 'Слушание', reading: uk ? 'Читання' : 'Чтение', writing: uk ? 'Письмо' : 'Письмо', speaking: uk ? 'Говоріння' : 'Говорение' } as Record<string, string>)[block.type]}</p>}
            {(block.title || (block.audit_url && !userPreview)) && <h2 className={styles.blockTitle}>
              <span className={styles.blockTitleText}>{block.title}</span>
              {block.is_extension && <GrammarExtensionBadge />}
              {block.audit_url && !userPreview && <a href={block.audit_url} target="_blank" rel="noreferrer" className={styles.auditLink}
                title={uk ? 'Статистика лексики' : 'Статистика лексики'} aria-label={uk ? 'Статистика лексики' : 'Статистика лексики'}>
                <i className="pi pi-chart-bar" aria-hidden="true" />
              </a>}
            </h2>}
            {showVariantPicker && block.variants && (
              <label className={styles.variantPicker}>
                <span>{uk ? 'Варіант' : 'Вариант'}</span>
                <select
                  value={block.practice_variants && !isGrammar ? block.variant_id ?? '' : selectedVariants[block.id] ?? ''}
                  onChange={(event) => {
                    const next = { ...selectedVariants };
                    if (event.target.value) next[block.id] = Number(event.target.value);
                    else delete next[block.id];
                    if ((block.practice_variants && laterSkill) || isGrammar) storeVariants(next);
                    setSelectedVariants(next);
                  }}
                >
                  {(!block.practice_variants || isGrammar) && <option value="">Автоматически: {block.assigned_variant_title ?? `№${block.variant_id}`}</option>}
                  {block.variants.map((variant, index) => (
                    <option key={variant.id} value={variant.id}>{variant.title || `${uk ? 'Варіант' : 'Вариант'} ${index + 1}`}{block.practice_variants && !isGrammar && variant.completed ? ' ✓' : ''}</option>
                  ))}
                </select>
              </label>
            )}
            {groupSelection && block.practice_variants && !block.variants?.[groupSelection.number - 1]
              ? <p role="status">{uk ? 'Цей варіант завдання ще не опублікований.' : 'Этот вариант задания ещё не опубликован.'}</p>
              : <LessonDraftContext.Provider key={`${block.id}:${block.variant_id}`} value={laterSkill || isGrammar ? lessonDraftKey(userId, block.source_block_id ?? block.id, block.variant_id) : null}>
            {renderLessonBlock({ ...block, progress: liveProgress[`${block.id}:${block.variant_id}`] ?? block.progress }, () => query.refetch({ throwOnError: true }), {
              practice, compact, onProgress: progress => setLiveProgress(current => ({ ...current, [`${block.id}:${block.variant_id}`]: progress })),
            }, refreshCompletion, !combined || active)}
            </LessonDraftContext.Provider>}
            {combined && ['writing', 'speaking'].includes(block.type) && <button type="button" className={styles.activateTutor}
              aria-pressed={active} aria-controls="practice-tutor" onClick={() => setActiveTutorId(block.id)}>
              <i className={`pi ${block.type === 'speaking' ? 'pi-microphone' : 'pi-comments'}`} aria-hidden="true" />
              {active ? (uk ? 'Поточне завдання' : 'Текущее задание') : (uk ? 'Працювати з репетитором' : 'Работать с репетитором')}
            </button>}
          </section>;
        })}
        {!page.blocks.length && <p className={styles.status}>{uk ? 'У цьому уроці поки немає блоків.' : 'В этом уроке пока нет блоков.'}</p>}
        {combined && hasTutor && <aside id="practice-tutor" className={styles.practiceTutor} hidden={tutorRow == null}
          style={{ '--tutor-row': tutorRow, '--mobile-tutor-row': tutorRow != null ? tutorRow + 1 : undefined } as CSSProperties} aria-label="AI Tutor"><div ref={setLessonTutorSlot} /></aside>}
      </div>
      </div>
      {hasTutor && !combined && <aside className={styles.tutorColumn} aria-label="AI Tutor"><div ref={setLessonTutorSlot} /></aside>}
    </section>
  );
}
