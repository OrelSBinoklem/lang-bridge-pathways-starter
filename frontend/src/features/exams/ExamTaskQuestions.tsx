import type { ReactNode } from 'react';
import type { ExamTask, Question } from './types';
import { readingPassages } from './readingPassages';
import styles from './exams.module.css';

export function ExamTaskQuestions({ task, interleave = false, language = 'lv', renderQuestion }: {
  task: ExamTask;
  interleave?: boolean;
  language?: 'lv' | 'en';
  renderQuestion: (question: Question, inlineChoices?: boolean) => ReactNode;
}) {
  if (task.reading_groups?.length) return <>{task.reading_groups.map((group, index) => <section
    key={`${task.id}-${index}`} className={styles.matchingGroup} aria-label={group.title}>
    <h4>{group.title}</h4>
    <div className={styles.announcementGrid}>{group.announcements.map(announcement => <article key={announcement.label} className={styles.announcement}>
      <strong>{announcement.label}</strong><p lang={language}>{announcement.text}</p>
    </article>)}</div>
    {group.question_ids.map(id => task.questions.find(question => question.id === id)).map(question =>
      question ? renderQuestion(question) : null)}
  </section>)}</>;
  const passages = interleave ? readingPassages(task) : null;
  return passages ? <>{passages.map(({ text, question }) => <div key={question.id}>
    <p lang={language} className={styles.passage}>{text}</p>{renderQuestion(question, true)}
  </div>)}</> : <>{task.questions.map(question => renderQuestion(question))}</>;
}
