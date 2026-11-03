'use client';

import { useEffect } from 'react';
import styles from '@/components/webgl-gui.module.css';

/** Shows or hides every dat.gui panel on the page (the «⋯» button; also the full-window previews, which cover it). */
export function toggleWebglGui() {
  const visible = document.body.classList.contains('webgl-gui-visible');
  document.body.classList.toggle('webgl-gui-visible', !visible);
  document.body.classList.toggle('webgl-gui-hidden', visible);
}

/** Кнопка «⋯» — открывает/скрывает dat.gui, как в WP WaterLogo. */
export function WebglGuiToggle() {
  useEffect(() => {
    document.body.classList.add('webgl-gui-active', 'webgl-gui-hidden');
    document.body.classList.remove('webgl-gui-visible');
    return () => {
      document.body.classList.remove('webgl-gui-active', 'webgl-gui-hidden', 'webgl-gui-visible');
    };
  }, []);

  return (
    <button
      type="button"
      id="webgl-gui-toggle-button"
      className={styles.toggle}
      aria-label="WebGL controls"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWebglGui();
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <circle cx="12" cy="6" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="18" r="2" />
      </svg>
    </button>
  );
}
