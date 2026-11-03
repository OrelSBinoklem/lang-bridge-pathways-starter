'use client';

import { useEffect } from 'react';
import { setLessonContext, clearLessonContext } from '@/features/tutor/lessonContextBridge';
import styles from './blocks.module.css';
import { PracticeDraft } from './PracticeDraft';
import { useLessonCompletion } from '../useLessonCompletion';
import { useLocale } from 'next-intl';
import { ProductiveResult, type ProductiveGrade } from './ProductiveResult';

export type PracticeBlockConfig = {
  topic?: string;
  lesson_text?: string;
  task_kind?: 'ru_to_lv' | 'image_description' | 'question_formation' | 'roleplay';
  instruction?: string;
  image_url?: string;
  tutor_prompt?: string;
  goals?: string[];
};

/**
 * Отдаёт тему+текст урока в глобально примонтированного бота (через lessonContextBridge) —
 * он открывается в выделенной области урока в текущем (не новом) диалоге.
 * Прогресс приходит через window-событие tutor.lesson.completed, которое бот шлёт после
 * успешного вызова команды lesson.block.complete.
 */
export function WritingBlock({ blockId, variantId, config, botPrompt, initialCompleted: completed = false, result, onCompletion, active = true }: { blockId: number; variantId: number | null; config: PracticeBlockConfig; botPrompt?: string | null; initialCompleted?: boolean; result?: ProductiveGrade | null; onCompletion?: () => Promise<unknown>; active?: boolean }) {
  const uk = useLocale() === 'uk';
  useLessonCompletion(blockId, variantId, onCompletion);
  const lessonText = config.instruction || config.lesson_text || '';
  const tutorInstructions = [botPrompt, config.tutor_prompt, result ? `Последняя серверная оценка: ${result.score}%. Цель: ${result.target_score}%. ${result.feedback} ${result.recommendation} Предлагай улучшение добровольно, если меньше 100%; не выставляй собственный процент.` : null].filter(Boolean).join('\n\n');

  useEffect(() => {
    if (!active) return;
    setLessonContext({ topic: config.topic || '', text: lessonText, instructions: tutorInstructions, lessonBlockId: blockId, variantId, format: 'writing', completed });
    return () => clearLessonContext(blockId);
  }, [active, blockId, variantId, config.topic, lessonText, tutorInstructions, completed]);

  return (
    <div className={styles.block}>
      {config.topic && <p className={styles.topic}>{config.topic}</p>}
      {lessonText && <p className={styles.lessonText}>{lessonText}</p>}
      {config.image_url && <img className={styles.practiceImage} src={config.image_url} alt="Изображение для описания" />}
      <PracticeDraft />
      <ProductiveResult result={result} completed={completed} uk={uk} />
    </div>
  );
}
