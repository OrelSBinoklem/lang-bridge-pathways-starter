'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from 'next-intl';
import { LIQUID_DROPS_SCENE_LABELS, type LiquidDropsParams } from './params';
import { selectDropsScene, setDropsImage, subscribeDropsScene } from './sceneSelection';
import styles from '../liquid-drops.module.css';

const UK_LABELS: Record<string, string> = {
  'mountain-pools': 'Басейни в горах', sauna: 'Сауна / лазня', 'spa-leaves': 'Тропічний спа', grotto: 'Грот-басейн',
  'photo-sauna': 'Фото · Сауна', 'photo-hot-spring': 'Фото · Джерело', 'photo-forest-pool': 'Фото · Тропіки',
  'photo-mountain-pool': 'Фото · Гори', 'photo-monstera': 'Фото · Монстера', 'photo-cave-pool': 'Фото · Грот', custom: 'Своя картинка',
};

export function LiquidDropsScenePicker({ params }: { params: LiquidDropsParams }) {
  const uk = useLocale() === 'uk';
  const input = useRef<HTMLInputElement>(null);
  const subscribe = useCallback((listener: () => void) => subscribeDropsScene(params, listener), [params]);
  const snapshot = useCallback(() => params.scene, [params]);
  const scene = useSyncExternalStore(subscribe, snapshot, snapshot);
  const [target, setTarget] = useState<Element | null>(() => typeof document === 'undefined' ? null : document.fullscreenElement ?? document.body);
  useEffect(() => {
    const sync = () => setTarget(document.fullscreenElement ?? document.body);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  if (!target) return null;
  return createPortal(<div className={styles.scenePicker} data-effect-toolbar="" data-liquid-drops-scene-picker=""
    onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    role="group" aria-label={uk ? 'Фон ефекту крапель' : 'Фон эффекта капель'}>
    <label className={styles.sceneLabel}>
      <span>Сцена</span>
      <select value={scene} onChange={event => {
        if (event.target.value === 'custom' && !params.customImage) input.current?.click();
        else selectDropsScene(params, event.target.value);
      }}>
        {Object.entries(LIQUID_DROPS_SCENE_LABELS).map(([id, label]) => <option key={id} value={id}>{uk ? UK_LABELS[id] ?? label : label}</option>)}
      </select>
    </label>
    <button type="button" onClick={() => input.current?.click()}>Своя картинка…</button>
    <input ref={input} type="file" accept="image/*" hidden aria-label={uk ? 'Завантажити свою картинку' : 'Загрузить свою картинку'} onChange={event => {
      const file = event.target.files?.[0];
      if (file && file.type.startsWith('image/')) setDropsImage(params, URL.createObjectURL(file));
      event.target.value = '';
    }} />
  </div>, target);
}
