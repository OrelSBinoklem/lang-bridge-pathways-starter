'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from 'next-intl';
import type { SceneParams } from './types';
import { LIFELONG_CATALOG } from './cinematic/catalog';
import { selectLifeStory, subscribeLifeStory } from './lifelongSelection';
import styles from './lifelong-settings.module.css';

/** Visitor settings are separate from administrator diagnostics and never modify course progress. */
export function LifelongSettings({ params, onChange }: { params: SceneParams; onChange: () => void }) {
  const uk = useLocale() === 'uk';
  const subscribe = useCallback((listener: () => void) => subscribeLifeStory(params, listener), [params]);
  const snapshot = useCallback(() => params.lifeStory, [params]);
  const selected = useSyncExternalStore(subscribe, snapshot, snapshot);
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => {
    const update = () => setHost(document.fullscreenElement ?? document.body);
    update(); document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  if (!host) return null;
  return createPortal(<details className={styles.settings} data-effect-toolbar="" data-lifelong-settings=""
    onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    <summary>{uk ? '⚙ Налаштування' : '⚙ Настройки'}</summary>
    <div className={styles.panel}>
      <label>
        <span>{uk ? 'Картинка та історія' : 'Картинка и история'}</span>
        <select value={selected} onChange={event => { if (selectLifeStory(params, Number(event.target.value))) onChange(); }}>
          {selected < 0 && <option value={-1}>{uk ? 'Обираємо…' : 'Выбираем…'}</option>}
          {LIFELONG_CATALOG.map((story, index) => <option key={story.id} value={index}>{uk ? story.uk : story.ru}</option>)}
        </select>
      </label>
      <small>{uk ? 'Нова активація групи — випадкова історія.' : 'Новая активация группы — случайная история.'}</small>
    </div>
  </details>, host);
}
