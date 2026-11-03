'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { clientApi } from '@/lib/client-api';

export type LessonCompletionEvent = { endpoint?: string; variantId?: number | null };

export function useLessonProgressRefresh(userId: number) {
  const queryClient = useQueryClient();
  const pending = useRef<Promise<unknown> | null>(null);
  return useCallback(() => {
    if (pending.current) return pending.current;
    pending.current = clientApi<{ user: { id: number } }>('/user').then(async response => {
      if (response.user.id !== userId) return;
      await queryClient.invalidateQueries({ queryKey: ['lesson-page', userId] });
      await queryClient.invalidateQueries({ queryKey: ['course-path'], refetchType: 'none' });
      await queryClient.invalidateQueries({ queryKey: ['grammar-topics'], refetchType: 'none' });
    }).finally(() => { pending.current = null; });
    return pending.current;
  }, [queryClient, userId]);
}

export function useLessonCompletion(blockId: number, variantId: number | null, refresh?: () => Promise<unknown>) {
  useEffect(() => {
    function onCompleted(event: Event) {
      const detail = (event as CustomEvent<LessonCompletionEvent>).detail;
      if (detail?.endpoint !== `/tutor/lesson-blocks/${blockId}/complete` || detail.variantId !== variantId) return;
      // Only the refreshed server payload can mark this variant complete.
      void refresh?.().catch(() => console.warn('Lesson completion could not be refreshed.'));
    }
    window.addEventListener('tutor.lesson.completed', onCompleted);
    return () => window.removeEventListener('tutor.lesson.completed', onCompleted);
  }, [blockId, variantId, refresh]);
}
