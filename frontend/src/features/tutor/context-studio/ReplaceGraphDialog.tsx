import { useEffect, useRef } from 'react';
import styles from './context-studio.module.css';

export function ReplaceGraphDialog({ onAnswer }: { onAnswer: (replace: boolean) => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    cancel.current?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return <div className={styles.confirmBackdrop}>
    <div className={styles.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="flow-replace-title" aria-describedby="flow-replace-description"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onAnswer(false); }
        if (event.key === 'Tab') {
          const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <span className={styles.eyebrow}>Несохранённые изменения</span>
      <h2 id="flow-replace-title">Заменить текущий черновик?</h2>
      <p id="flow-replace-description">Изменения текущей схемы будут потеряны. Сохранённые серверные версии останутся доступны.</p>
      <div className={styles.confirmActions}><button ref={cancel} type="button" onClick={() => onAnswer(false)}>Оставить черновик</button><button type="button" className={styles.primary} onClick={() => onAnswer(true)}>Заменить черновик</button></div>
    </div>
  </div>;
}
