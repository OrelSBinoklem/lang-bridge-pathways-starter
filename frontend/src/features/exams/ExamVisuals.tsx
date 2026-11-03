'use client';

import Image from 'next/image';
import { useRef } from 'react';
import type { ExamVisual } from './types';
import styles from './exam-visuals.module.css';

export function ExamPhoto({ src, label = 'Eksāmena attēls' }: { src: string; label?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <div className={styles.photo}>
    <button type="button" className={styles.enlarge} title="Увеличить изображение" aria-label={`Увеличить: ${label}`} onClick={() => dialog.current?.showModal()}>
      <Image unoptimized src={src} width={1400} height={1000} alt={label} />
      <i className="pi pi-search-plus" aria-hidden />
    </button>
    <dialog ref={dialog} className={styles.dialog} aria-label={label}>
      <button type="button" className={styles.close} title="Закрыть" aria-label="Закрыть изображение" onClick={() => dialog.current?.close()}><i className="pi pi-times" aria-hidden /></button>
      <Image unoptimized src={src} width={1400} height={1000} alt={label} />
    </dialog>
  </div>;
}

export default function ExamVisuals({ visuals }: { visuals: ExamVisual[] }) {
  return <div className={styles.grid} data-count={visuals.length} lang="lv">
    {visuals.map((visual, index) => <figure className={styles.visual} key={index}>
      <figcaption>{visual.title}</figcaption>
      {visual.image && <ExamPhoto src={visual.image} label={visual.title} />}
      {visual.credit && <small className={styles.credit}>{visual.credit} / Pexels</small>}
      {visual.text && <p>{visual.text}</p>}
      {visual.bars && <dl className={styles.chart}>
        {visual.bars.map(bar => <div key={bar.label}>
          <dt>{bar.label}</dt><dd><span className={styles.track}><span style={{ width: `${bar.value}%` }} /></span><strong>{bar.value}%</strong></dd>
        </div>)}
      </dl>}
      {visual.chart_note && <small>{visual.chart_note}</small>}
    </figure>)}
  </div>;
}
