'use client';

import { QuestionChoice } from './QuestionChoice';
import { BinaryStatementsTask, type BlockProgress } from './BinaryStatementsTask';
import { ReadingTranslationBlock, type SavedResponse, type TranslationResult } from './ReadingTranslationBlock';
import styles from './blocks.module.css';

export type ReadingBlockConfig = {
  text?: string;
  questions?: Array<
    | { statement: string }
    | { question: string; options: string[]; correct_index?: number }
  >;
  task_kind?: 'reading_binary' | 'lv_to_ru';
  source_text?: string;
  assistance_available?: boolean;
  assistance_active?: boolean;
  assisted_questions?: string[];
};

export function ReadingBlock({ blockId, variantId, config, progress, lastResponse, translationResult, onRetry, onCompletion }: { blockId: number; variantId: number | null; config: ReadingBlockConfig; progress: BlockProgress; lastResponse: SavedResponse; translationResult?: TranslationResult | null; onRetry?: () => Promise<unknown>; onCompletion?: () => Promise<unknown>; repeatVariant?: boolean }) {
  if (config.task_kind === 'lv_to_ru') return <ReadingTranslationBlock blockId={blockId} variantId={variantId} config={config} lastResponse={lastResponse} translationResult={translationResult} progress={progress ?? undefined} onCompletion={onCompletion} />;
  return (
    <div className={styles.block}>
      {config.text && <p className={styles.readingText}>{config.text}</p>}
      {Array.isArray(config.questions) && config.questions.length > 0 && 'statement' in config.questions[0]
        ? <BinaryStatementsTask blockId={blockId} variantId={variantId} questions={config.questions as Array<{ statement: string }>} progress={progress} onRetry={onRetry} onCompletion={onCompletion}
          assistanceAvailable={config.assistance_available} assistanceActive={config.assistance_active} assistedQuestions={config.assisted_questions} />
        : null}
      {(config.questions ?? []).map((item, index) => (
        'question' in item ? <QuestionChoice key={index} question={item.question} options={item.options} correctIndex={item.correct_index ?? 0} /> : null
      ))}
    </div>
  );
}
