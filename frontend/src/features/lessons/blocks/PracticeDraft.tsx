'use client';

import { useId } from 'react';
import { useLocale } from 'next-intl';
import { isDraftText, useLessonDraft } from '../useLessonDraft';
import styles from './blocks.module.css';

export function PracticeDraft({ speaking = false }: { speaking?: boolean }) {
  const uk = useLocale() === 'uk';
  const id = useId();
  const [text, setText] = useLessonDraft('text', '', isDraftText);
  return <div className={styles.practiceDraft}>
    <label htmlFor={id}>{speaking ? (uk ? 'Нотатки' : 'Заметки') : (uk ? 'Чернетка' : 'Черновик')}</label>
    <textarea id={id} value={text} onChange={event => setText(event.target.value)} rows={speaking ? 3 : 6} />
  </div>;
}
