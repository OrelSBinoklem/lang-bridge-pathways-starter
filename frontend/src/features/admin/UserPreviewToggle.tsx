'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from 'next-intl';
import { useUserPreview } from './useUserPreview';
import { setUserPreview } from './user-preview-store';
import styles from './user-preview-toggle.module.css';

const subscribeHydration = () => () => {};
const clientMounted = () => true;
const serverMounted = () => false;

export function UserPreviewToggle({ isAdmin }: { isAdmin: boolean }) {
  const preview = useUserPreview();
  const uk = useLocale() === 'uk';
  const mounted = useSyncExternalStore(subscribeHydration, clientMounted, serverMounted);
  useEffect(() => {
    document.documentElement.toggleAttribute('data-lbp-user-preview', isAdmin && preview);
    return () => document.documentElement.removeAttribute('data-lbp-user-preview');
  }, [isAdmin, preview]);
  if (!mounted || !isAdmin) return null;
  const label = preview
    ? (uk ? 'Повернути адмін-вид' : 'Вернуть админ-вид')
    : (uk ? 'Вид користувача' : 'Вид пользователя');
  return createPortal(<button type="button" className={styles.toggle} data-user-preview-toggle
    aria-pressed={preview} aria-label={label} title={label} onClick={() => setUserPreview(!preview)}>
    <i className={`pi ${preview ? 'pi-shield' : 'pi-user'}`} aria-hidden="true" />
  </button>, document.body);
}
