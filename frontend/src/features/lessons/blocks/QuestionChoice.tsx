'use client';

import styles from './blocks.module.css';
import { useLessonDraft } from '../useLessonDraft';

export function QuestionChoice({ question, options, correctIndex }: { question: string; options: string[]; correctIndex: number }) {
  const [pickedIndex, setPickedIndex] = useLessonDraft<number | null>(`choice:${JSON.stringify([question, options])}`, null,
    (value): value is number | null => value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < options.length));
  const answered = pickedIndex !== null;
  return (
    <div className={styles.question}>
      <p className={styles.questionText}>{question}</p>
      <ul className={styles.options}>
        {options.map((option, index) => {
          const state = !answered ? '' : index === correctIndex ? styles.correct : index === pickedIndex ? styles.wrong : '';
          return (
            <li key={index}>
              <button type="button" className={`${styles.option} ${state}`} disabled={answered} onClick={() => setPickedIndex(index)}>
                {option}
              </button>
            </li>
          );
        })}
      </ul>
      {answered && (
        <p className={styles.feedback}>
          {pickedIndex === correctIndex ? '✓ Верно' : `✗ Неверно. Правильный ответ: ${options[correctIndex] ?? '—'}`}
        </p>
      )}
    </div>
  );
}
