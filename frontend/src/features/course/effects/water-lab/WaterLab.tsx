'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useLocale } from 'next-intl';
import type { PointerState } from '../engine';
import { pointerStateFromEvent } from '../pointerState';
import { SceneEffect } from '../scenes/SceneEffect';
import { FOUNTAIN_YARD } from '../scenes/fountain';
import { createSceneParams } from '../scenes/types';
import { Waterfall, type WaterfallSettings } from './Waterfall';
import type { WaterTool } from './waterfallSimulation';
import styles from './water-lab.module.css';

export function WaterLab() {
  const uk = useLocale() === 'uk';
  const [tab, setTab] = useState<'waterfall' | 'fountain'>('waterfall');
  const [pool, setPool] = useState(1);
  const [reduced, setReduced] = useState(false);
  const [settings, setSettings] = useState<WaterfallSettings>({ paused: false, flow: 1, radius: 52, tool: 'barrier', reset: 0 });
  const host = useRef<HTMLDivElement>(null);
  const pointer = useRef<PointerState>({ x: 0, y: 0, active: false, moved: false });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const params = useMemo(() => createSceneParams({ fntPool: 1, camOn: 0 }), []);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(host.current!);
    return () => observer.disconnect();
  }, []);
  const feed = (e: PointerEvent<HTMLDivElement>) => {
    pointer.current = pointerStateFromEvent(e, e.currentTarget.getBoundingClientRect(), pointer.current);
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId);
    if ((e.type === 'pointerup' || e.type === 'pointercancel') && e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const changePool = (value: number) => {
    // SceneParams is the existing engine's live mutable control channel, not React state.
    // eslint-disable-next-line react-hooks/immutability
    params.fntPool = value;
    setPool(value);
  };
  const changePaused = () => {
    const paused = !settings.paused;
    // eslint-disable-next-line react-hooks/immutability
    params.speed = paused ? 0 : 1;
    setSettings({ ...settings, paused });
  };
  const reset = () => { pointer.current.active = false; setSettings({ ...settings, reset: settings.reset + 1 }); };
  const toolLabels: Record<WaterTool, string> = uk
    ? { barrier: 'Перешкода', push: 'Відштовхування', pull: 'Притягання' }
    : { barrier: 'Преграда', push: 'Отталкивание', pull: 'Притяжение' };
  return <main className={styles.lab}>
    <header className={styles.toolbar}>
      <Link href="/admin-tools" className={styles.icon} title={uk ? 'Карта сторінок' : 'Карта страниц'} aria-label={uk ? 'Карта сторінок' : 'Карта страниц'}><i className="pi pi-arrow-left" aria-hidden="true" /></Link>
      <div className={styles.tabs} role="group" aria-label={uk ? 'Сцена' : 'Сцена'}>
        <button type="button" aria-pressed={tab === 'waterfall'} onClick={() => setTab('waterfall')}>2D · {uk ? 'Водоспад' : 'Водопад'}</button>
        <button type="button" aria-pressed={tab === 'fountain'} onClick={() => setTab('fountain')}>{uk ? 'Фонтан · чаша' : 'Фонтан · чаша'}</button>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.icon} onClick={changePaused} aria-pressed={settings.paused} title={settings.paused ? (uk ? 'Продовжити' : 'Продолжить') : 'Пауза'} aria-label={settings.paused ? (uk ? 'Продовжити' : 'Продолжить') : 'Пауза'}><i className={`pi pi-${settings.paused ? 'play' : 'pause'}`} aria-hidden="true" /></button>
        <button type="button" className={styles.icon} onClick={reset} title={uk ? 'Почати заново' : 'Начать заново'} aria-label={uk ? 'Почати заново' : 'Начать заново'}><i className="pi pi-refresh" aria-hidden="true" /></button>
      </div>
    </header>
    <div className={styles.options}>
      {tab === 'waterfall' ? <>
        <div className={styles.tabs} role="group" aria-label={uk ? 'Дія курсора' : 'Действие курсора'}>{(['barrier', 'push', 'pull'] as const).map(tool => <button key={tool} type="button" aria-pressed={settings.tool === tool} onClick={() => setSettings({ ...settings, tool })}>{toolLabels[tool]}</button>)}</div>
        <label>{uk ? 'Напір' : 'Напор'}<input aria-label={uk ? 'Напір' : 'Напор'} type="range" min="0.4" max="1.5" step="0.1" value={settings.flow} onChange={e => setSettings({ ...settings, flow: Number(e.target.value) })} /><output>{settings.flow.toFixed(1)}</output></label>
        <label>{uk ? 'Радіус' : 'Радиус'}<input aria-label={uk ? 'Радіус' : 'Радиус'} type="range" min="20" max="110" step="2" value={settings.radius} onChange={e => setSettings({ ...settings, radius: Number(e.target.value) })} /></label>
      </> : <div className={styles.tabs} role="group" aria-label={uk ? 'Поверхня води' : 'Поверхность воды'}>
        <button type="button" aria-pressed={pool === 0} onClick={() => changePool(0)}>{uk ? 'Було' : 'Было'}</button>
        <button type="button" aria-pressed={pool === 1} onClick={() => changePool(1)}>{uk ? 'Нова чаша' : 'Новая чаша'}</button>
      </div>}
    </div>
    <div ref={host} className={styles.stage} onPointerMove={tab === 'fountain' ? feed : undefined} onPointerDown={tab === 'fountain' ? feed : undefined} onPointerUp={tab === 'fountain' ? feed : undefined} onPointerCancel={tab === 'fountain' ? feed : undefined} onPointerLeave={() => { pointer.current.active = false; }}>
      {tab === 'waterfall' ? <Waterfall settings={settings} /> : size.width > 0 && <SceneEffect key={`${settings.reset}-${reduced ? pool : 0}`} scene={FOUNTAIN_YARD} width={size.width} height={size.height} pointerRef={pointer} params={params} body />}
    </div>
  </main>;
}
