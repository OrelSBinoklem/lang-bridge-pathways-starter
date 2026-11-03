'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { clientApi } from '@/lib/client-api';
import { GrammarTask, type GrammarConfig } from './GrammarTask';
import { GrammarItemsTask } from './GrammarItemsTask';
import { LessonDraftContext, useStoredLessonState } from '@/features/lessons/useLessonDraft';
import { lessonDraftKey, lessonSelectionKey, isVariantSelection } from '@/features/lessons/draftStorage';
import type { LessonBlockData } from '@/features/lessons/blockRegistry';
import type { BlockProgress } from '@/features/lessons/blocks/BinaryStatementsTask';
import styles from './inline-grammar.module.css';

export type InlineGrammarTarget = { slug: string; blockId: number; title: string };
type GrammarPage = { skill: string; blocks: LessonBlockData[] };

/** Same lesson endpoint, variant assignment and server scoring as the full lesson page. */
export default function InlineGrammarLesson({ target, active }: { target: InlineGrammarTarget; active: boolean }) {
  const identity = useQuery({ queryKey: ['inline-grammar-user'], enabled: active,
    queryFn: () => clientApi<{ user: { id: number } }>('/user'), staleTime: 0, gcTime: 0, retry: false });
  if (identity.isError) return <p role="alert">Не удалось проверить аккаунт. <Link href="/login">Войти</Link></p>;
  if (!identity.data || identity.isFetching) return <p role="status">Загрузка задания…</p>;
  return <IdentifiedGrammarLesson key={`${identity.data.user.id}:${target.slug}:${target.blockId}`} target={target} userId={identity.data.user.id} active={active} />;
}

function IdentifiedGrammarLesson({ target, userId, active }: { target: InlineGrammarTarget; userId: number; active: boolean }) {
  const queryClient = useQueryClient();
  const [selectedVariants, setSelectedVariants] = useStoredLessonState<Record<number, number>>(lessonSelectionKey(userId, target.slug), {}, isVariantSelection);
  const variant = selectedVariants[target.blockId] ?? null;
  const [practice, setPractice] = useState(false);
  const [liveProgress, setLiveProgress] = useState<BlockProgress | null>(null);
  const lesson = useQuery({ queryKey: ['inline-grammar-lesson', userId, target.slug, target.blockId, variant], enabled: active,
    queryFn: ({ signal }) => clientApi<{ data: GrammarPage }>(`/lessons/${encodeURIComponent(target.slug)}${variant ? `?variants[${target.blockId}]=${variant}` : ''}`, { signal }),
    refetchOnWindowFocus: false, staleTime: Infinity, gcTime: 0, retry: false });
  if (lesson.isError) return <p role="alert">Не удалось загрузить задание. <button type="button" onClick={() => void lesson.refetch()}>Повторить</button></p>;
  if (!lesson.data || lesson.isFetching) return <p role="status">Загрузка задания…</p>;
  const block = lesson.data.data.blocks.find(item => item.id === target.blockId && item.type === 'grammar');
  if (!block || lesson.data.data.skill !== 'grammar') return <p role="alert">Это задание сейчас недоступно.</p>;
  const config = block.config as GrammarConfig;
  const onProgress = (progress: BlockProgress) => {
    setLiveProgress(progress);
    // Refresh indicators without replacing the just-graded variant and its feedback.
    void queryClient.invalidateQueries({ queryKey: ['grammar-topics'] });
    void queryClient.invalidateQueries({ queryKey: ['course-path'], refetchType: 'none' });
  };
  const retry = async () => { await lesson.refetch({ throwOnError: true }); setLiveProgress(null); };
  return <div className={styles.lesson} data-inline-grammar-block={block.id}>
    <div className={styles.controls}>
      <div role="group" aria-label="Режим задания"><button type="button" aria-pressed={!practice} onClick={() => setPractice(false)}>Зачёт</button><button type="button" aria-pressed={practice} onClick={() => setPractice(true)}>Тренировка</button></div>
      {block.variants && block.variants.length > 1 && <label>Вариант <select value={variant ?? ''} onChange={event => { setLiveProgress(null); const next = { ...selectedVariants }; if (event.target.value) next[target.blockId] = Number(event.target.value); else delete next[target.blockId]; setSelectedVariants(next); }}>
        <option value="">Автоматически</option>{block.variants.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select></label>}
    </div>
    <LessonDraftContext.Provider key={`${block.id}:${block.variant_id}:${practice}`} value={lessonDraftKey(userId, block.source_block_id ?? block.id, block.variant_id)}>
      {config.task_kind === 'grammar_items'
        ? <GrammarItemsTask blockId={block.id} variantId={block.variant_id} config={config} progress={liveProgress ?? block.progress} practice={practice} onProgress={onProgress} onRetry={retry} />
        : <GrammarTask blockId={block.id} variantId={block.variant_id} config={config} progress={liveProgress ?? block.progress} practice={practice} layout="table" onProgress={onProgress} onRetry={retry} />}
    </LessonDraftContext.Provider>
  </div>;
}
