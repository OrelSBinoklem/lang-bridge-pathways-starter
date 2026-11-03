import type { Question } from './types';
import styles from './exams.module.css';

export function ExamChoiceOptions({ question, value, disabled, onChange }: {
  question: Question;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return <fieldset className={styles.choiceOptions} disabled={disabled}>
    <legend>{question.prompt}</legend>
    {question.options?.map(option => <label key={option.id}>
      <input type="radio" name={question.id} value={option.id} checked={value === option.id}
        onChange={() => onChange(option.id)} />
      <span lang="lv">{option.text}</span>
    </label>)}
  </fieldset>;
}
