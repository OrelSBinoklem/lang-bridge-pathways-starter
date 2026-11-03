'use client';

import { Dialog } from 'primereact/dialog';
import type { ReactNode } from 'react';
import styles from './tutor-settings-dialog.module.css';

export function TutorSettingsDialog({ visible, onHide, children }: {
  visible: boolean;
  onHide: () => void;
  children: ReactNode;
}) {
  return <Dialog header="Настройки бота и расчёт расходов" visible={visible} onHide={onHide}
    className={styles.dialog} contentClassName={styles.content}
    style={{ width: '980px', maxWidth: '96vw', maxHeight: '92dvh' }}
    draggable={false} resizable={false} blockScroll closeOnEscape baseZIndex={5100}>
    {children}
  </Dialog>;
}
