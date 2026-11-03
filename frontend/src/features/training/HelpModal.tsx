'use client';

import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import styles from '@/features/training/help-modal.module.css';

export function HelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const t = useTranslations('Training');
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-label={t('helpTitle')}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.close} onClick={onClose} aria-label={t('close')}>
          ×
        </button>
        <h2 className={styles.title}>{t('helpTitle')}</h2>
        <div className={styles.content} dangerouslySetInnerHTML={{ __html: t.raw('helpContentHtml') }} />
      </div>
    </div>,
    document.body,
  );
}
