'use client';

import { QuestionChoice } from './QuestionChoice';
import { BinaryStatementsTask, type BlockProgress } from './BinaryStatementsTask';
import styles from './blocks.module.css';

export type ListeningBlockConfig = {
  audio_url?: string | null;
  transcript?: string;
  question?: string;
  options?: string[];
  correct_index?: number;
  task_kind?: 'listening';
  questions?: { statement: string }[];
  assistance_available?: boolean;
  assistance_active?: boolean;
  assisted_questions?: string[];
};

export function ListeningBlock({ blockId, variantId, config, progress, onRetry, onCompletion }: { blockId: number; variantId: number | null; config: ListeningBlockConfig; progress: BlockProgress; onRetry?: () => Promise<unknown>; onCompletion?: () => Promise<unknown> }) {
  const options = config.options ?? [];
  const audioReady = Boolean(config.audio_url && config.audio_url !== '/audio/synthesis/en/audio/hello.mp3');
  return (
    <div className={styles.block}>
      {audioReady ? <audio className={styles.audio} controls src={config.audio_url ?? undefined} /> : <p>Аудио для этого диалога готовится.</p>}
      {config.transcript && <details className={styles.transcript}><summary>Транскрипт</summary><p>{config.transcript}</p></details>}
      {audioReady && config.questions?.length ? <BinaryStatementsTask blockId={blockId} variantId={variantId} questions={config.questions} progress={progress} onRetry={onRetry} onCompletion={onCompletion}
        assistanceAvailable={config.assistance_available} assistanceActive={config.assistance_active} assistedQuestions={config.assisted_questions} /> : null}
      {config.question && options.length > 0 && (
        <QuestionChoice question={config.question} options={options} correctIndex={config.correct_index ?? 0} />
      )}
    </div>
  );
}
