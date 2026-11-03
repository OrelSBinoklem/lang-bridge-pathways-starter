'use client';

import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { FilterLevel, ViewMode } from './helpers';
import styles from './grammar-tables-gallery.module.css';

const LEVELS: { value: FilterLevel; label: string; color: string }[] = [
  { value: 'a1', label: 'A1', color: '#C82341' },
  { value: 'a2', label: 'A2', color: '#FC8423' },
  { value: 'b1', label: 'B1', color: '#4A9F14' },
  { value: 'b2', label: 'B2', color: '#018587' },
];

const COLS_OPTIONS = [1, 2, 3, 4] as const;
const subscribeToSlot = () => () => {};
const getSlot = () => document.getElementById('grammar-menu-portal-root');
const getServerSlot = () => null;

type Props = {
  language?: 'lv' | 'en';
  selectedLevel: FilterLevel;
  onLevelChange: (level: FilterLevel) => void;
  cols: number;
  onColsChange: (cols: number) => void;
  viewMode: ViewMode;
  onViewModeToggle: () => void;
};

export function GrammarTablesMenuPortal({
  language = 'lv',
  selectedLevel,
  onLevelChange,
  cols,
  onColsChange,
  viewMode,
  onViewModeToggle,
}: Props) {
  const t = useTranslations('Grammar');
  const slot = useSyncExternalStore(subscribeToSlot, getSlot, getServerSlot);

  if (!slot) return null;

  return createPortal(
    <div className={styles.menuPortal} onClick={(e) => e.stopPropagation()}>
      <Link className={styles.practiceCatalog} href={language === 'en' ? '/grammar/practice?learn_lang=en' : '/grammar/practice'}><i className="pi pi-pencil" aria-hidden="true" /> Грамматические задания</Link>
      <Link className={styles.practiceCatalog} href={language === 'en' ? '/grammar' : '/grammar/english'}><i className="pi pi-language" aria-hidden="true" />{language === 'en' ? 'Латышские таблицы' : 'English · структуры предложений'}</Link>
      <div className={styles.menuBlock}>
        <span className={styles.menuLabel}>{t('level')}</span>
        <div className={styles.levelFilters} data-grammar-tour="level">
          {LEVELS.map((item) => {
            const active = selectedLevel === item.value;
            return (
              <button
                key={item.value}
                type="button"
                className={`${styles.levelFilterBtn} ${active ? styles.levelFilterBtnActive : ''}`}
                style={{
                  color: active ? '#fff' : item.color,
                  backgroundColor: active ? item.color : 'transparent',
                  borderColor: item.color,
                }}
                onClick={() => onLevelChange(item.value)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.menuBlock}>
        <span className={styles.menuLabel}>{t('columns')}</span>
        <div className={styles.colsGroup} role="group" aria-label={t('columnsAria')} data-grammar-tour="columns">
          {COLS_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`${styles.colBtn} ${cols === n ? styles.colBtnActive : ''}`}
              onClick={() => onColsChange(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.menuModeRow} data-grammar-tour="layout">
        <span className={styles.menuLabel}>{t('mode')}</span>
        <button type="button" className={styles.modeBtn} onClick={onViewModeToggle}>
          <span
            className={styles.modeIcon}
            style={viewMode === 'horizontal' ? { transform: 'rotate(-90deg)' } : undefined}
          >
            ▼
          </span>
          {viewMode === 'horizontal' ? t('horizontal') : t('vertical')}
        </button>
      </div>
    </div>,
    slot,
  );
}
