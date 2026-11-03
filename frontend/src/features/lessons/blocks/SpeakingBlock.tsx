'use client';

import { useEffect } from 'react';
import { setLessonContext, clearLessonContext } from '@/features/tutor/lessonContextBridge';
import styles from './blocks.module.css';
import type { PracticeBlockConfig } from './WritingBlock';
import { useLessonCompletion } from '../useLessonCompletion';
import { useLocale } from 'next-intl';
import { ProductiveResult, type ProductiveGrade } from './ProductiveResult';

export function SpeakingBlock({ blockId, variantId, config, botPrompt, initialCompleted: completed = false, result, onCompletion, active = true }: { blockId: number; variantId: number | null; config: PracticeBlockConfig; botPrompt?: string | null; initialCompleted?: boolean; result?: ProductiveGrade | null; onCompletion?: () => Promise<unknown>; active?: boolean }) {
  const uk = useLocale() === 'uk';
  useLessonCompletion(blockId, variantId, onCompletion);
  const lessonText = config.instruction || config.lesson_text || '';
  const goals = config.task_kind === 'roleplay' ? (config.goals?.length ? config.goals : [lessonText].filter(Boolean)) : [];
  const goalText = goals.join('\n');
  const tutorInstructions = [botPrompt, config.tutor_prompt, goals.length ? `Цели ученика:\n${goalText}\nОценивай достижение этих целей по смыслу. Допускай естественные формулировки, открытое обсуждение и обоснованный выбор. Не добавляй скрытые обязательные сведения, точные фразы или число вопросов, которых нет в задании. Не выполняй цели вместо ученика.` : null, result ? `Последняя серверная оценка: ${result.score}%. Цель: ${result.target_score}%. ${result.feedback} ${result.recommendation} Предлагай улучшение добровольно, если меньше 100%; не выставляй собственный процент.` : null].filter(Boolean).join('\n\n');

  useEffect(() => {
    if (!active) return;
    setLessonContext({ topic: config.topic || '', text: lessonText, instructions: tutorInstructions, lessonBlockId: blockId, variantId, format: 'speaking', completed });
    return () => clearLessonContext(blockId);
  }, [active, blockId, variantId, config.topic, lessonText, tutorInstructions, completed]);

  return (
    <div className={styles.block}>
      {config.topic && <p className={styles.topic}>{config.topic}</p>}
      {lessonText && config.goals?.length ? <p className={styles.lessonText}>{lessonText}</p> : null}
      {goals.length ? <div className={styles.conversationGoals}>
        <h3>{uk ? 'Цілі бесіди' : 'Цели беседы'}</h3>
        <ul>{goals.map((goal, index) => <li key={index}>{goal}</li>)}</ul>
      </div> : lessonText && <p className={styles.lessonText}>{lessonText}</p>}
      {config.image_url && <img className={styles.practiceImage} src={config.image_url} alt="Изображение для описания" />}
      <ProductiveResult result={result} completed={completed} uk={uk} />
    </div>
  );
}
