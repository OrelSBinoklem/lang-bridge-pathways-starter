'use client';
import { useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { SceneParams } from './types';
import { WEEK_BOOK_DAYS, selectWeekBookDay, subscribeWeekBook } from './weekBookState';
import styles from './week-book.module.css';

export function WeekBookChoice({ params, compact, uk }: { params: SceneParams; compact: boolean; uk: boolean }) {
  const subscribe = useCallback((callback: () => void) => subscribeWeekBook(params,callback),[params]);
  const read = useCallback(() => params.weekBookDay,[params]);
  const selected = useSyncExternalStore(subscribe,read,read), day = WEEK_BOOK_DAYS[selected] ?? WEEK_BOOK_DAYS[0];
  const choose = (index: number) => selectWeekBookDay(params,(index+7)%7);
  const controls = <div className={`${styles.controls} ${compact?styles.compact:styles.floating}`} data-effect-toolbar="" data-week-book-controls="" onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
    {!compact && <div className={styles.caption} aria-live="polite"><strong>{day.lv}</strong><span>{day.time} · {uk?day.activityUk:day.activity}</span></div>}
    <div className={styles.row}>
      <button type="button" onClick={()=>choose(selected-1)} aria-label={uk?'Попередній день':'Предыдущий день'}>‹</button>
      {compact?<select aria-label={uk?'День тижня':'День недели'} value={selected} onChange={e=>choose(Number(e.target.value))}>{WEEK_BOOK_DAYS.map((d,i)=><option value={i} key={d.lv}>{uk?d.uk:d.ru} · {d.place}</option>)}</select>
        :<div className={styles.days} role="group" aria-label={uk?'Дні тижня':'Дни недели'}>{WEEK_BOOK_DAYS.map((d,i)=><button type="button" key={d.lv} aria-label={`${uk?d.uk:d.ru}: ${uk?d.activityUk:d.activity}`} title={`${d.lv} · ${d.place}`} aria-pressed={selected===i} onClick={()=>choose(i)}>{uk?d.shortUk:d.shortRu}</button>)}</div>}
      <button type="button" onClick={()=>choose(selected+1)} aria-label={uk?'Наступний день':'Следующий день'}>›</button>
    </div>
  </div>;
  return compact || typeof document === 'undefined' ? controls : createPortal(controls,document.body);
}
