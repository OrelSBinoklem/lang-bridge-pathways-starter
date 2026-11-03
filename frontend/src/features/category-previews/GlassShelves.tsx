'use client';

import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { LayoutProps } from './types';
import styles from './glass-vitrines.module.css';
import { MasteryMark } from './MasteryMark';
import { getMasteryTier } from './mastery';
import masteryStyles from './mastery.module.css';
import { DiamondDecoration } from './DiamondDecoration';

export function GlassShelves({ groups, uk, mastery = false, diamondTreatment = 'setting' }: LayoutProps) {
  const light = useRef<{ frame: number; card: HTMLElement | null; x: number; y: number }>({ frame: 0, card: null, x: 0, y: 0 });
  const resetLight = useCallback(() => {
    const state = light.current;
    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = 0;
    for (const key of ['--gem-x', '--gem-y', '--gem-angle', '--gem-lit']) state.card?.style.removeProperty(key);
    state.card = null;
  }, []);
  useEffect(() => resetLight, [resetLight]);
  function moveLight(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch' || !diamondTreatment || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const card = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-diamond-treatment]') : null;
    if (!card) { resetLight(); return; }
    if (light.current.card !== card) { resetLight(); light.current.card = card; }
    light.current.x = event.clientX; light.current.y = event.clientY;
    if (light.current.frame) return;
    light.current.frame = requestAnimationFrame(() => {
      const state = light.current; state.frame = 0;
      if (!state.card?.isConnected) return;
      const rect = state.card.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, (state.x - rect.left) / rect.width * 100));
      const y = Math.max(0, Math.min(100, (state.y - rect.top) / rect.height * 100));
      state.card.style.setProperty('--gem-x', `${x.toFixed(1)}%`);
      state.card.style.setProperty('--gem-y', `${y.toFixed(1)}%`);
      state.card.style.setProperty('--gem-angle', `${(Math.atan2(y - 50, x - 50) * 180 / Math.PI + 180).toFixed(1)}deg`);
      state.card.style.setProperty('--gem-lit', '1');
    });
  }
  return <div className={styles.shelves} onPointerMove={mastery ? moveLight : undefined} onPointerLeave={resetLight}>
    {groups.map((group) => <section className={styles.shelf} data-level={group.level} data-single={group.items.length === 1 || undefined} id={`category-group-${group.id}`} key={group.id} aria-labelledby={`shelf-${group.id}`}>
      <header className={styles.shelfCover}>
        <span className={styles.micro}>{group.level ? (uk ? 'МОВНА ПОЛИЦЯ' : 'ЯЗЫКОВАЯ ПОЛКА') : (uk ? 'ДОБІРКА СЛІВ' : 'ПОДБОРКА СЛОВ')}</span>
        <h2 id={`shelf-${group.id}`} className={group.level ? styles.level : styles.collectionTitle}>{group.level || group.title}</h2>
        {group.level && <p className={styles.shelfDescription}>{group.description}</p>}
        <div className={styles.coverArt} aria-hidden="true">
          <span className={styles.artDisc} />
          {group.art ? <Image src={group.art} alt="" width={180} height={180} loading={group === groups[0] ? 'eager' : 'lazy'} unoptimized /> : <span className={styles.artFallback}>{group.level}</span>}
          <span className={styles.glassBase} />
        </div>
        <div className={styles.coverBottom}>
          <span>{group.wordCount} {uk ? 'слів' : 'слов'}</span>
          <span>{group.percent === null ? '—' : `${group.percent}%`}</span>
        </div>
      </header>
      <div className={styles.shelfBody}>
        <div className={styles.shelfCaption}><span>{group.level ? group.title : `${uk ? 'Тем' : 'Тем'}: ${group.items.length}`}</span><span>{uk ? 'ОБЕРИ ТЕМУ' : 'ВЫБЕРИ ТЕМУ'} <span aria-hidden="true">↗</span></span></div>
        <ul className={styles.shelfGrid}>
          {group.items.map((item) => <li key={item.id}>
            <Link href={item.href} prefetch={false} className={`${styles.shelfTile}${mastery ? ` ${masteryStyles.card} ${masteryStyles.glass}` : ''}`} data-unnumbered={!item.number || undefined} data-illustrated={!!item.art || undefined} data-icon={!item.art && !!item.icon || undefined} data-mastery-tier={mastery ? getMasteryTier(item.percent) : undefined} data-diamond-treatment={mastery && item.percent === 100 ? diamondTreatment : undefined} style={mastery ? { '--mastery-progress': `${item.percent ?? 0}%` } as CSSProperties : undefined}>
              {mastery && <span className={masteryStyles.paint} aria-hidden="true" />}
              {mastery && item.percent === 100 && diamondTreatment && <DiamondDecoration treatment={diamondTreatment} uk={uk} />}
              {item.number && <span className={styles.tileNumber}>{item.number}</span>}
              <span className={styles.tileLabel}>{item.label}</span>
              {item.art && <span className={styles.tileArt} aria-hidden="true"><Image src={item.art} alt="" width={64} height={64} sizes="64px" loading="lazy" unoptimized /></span>}
              {!item.art && item.icon && <span className={styles.tileIcon} aria-hidden="true"><i className={`pi ${item.icon}`} /></span>}
              <span className={styles.tileArrow} aria-hidden="true">↗</span>
              <span className={`${styles.tileMeta}${mastery ? ` ${masteryStyles.meta}` : ''}`}><span>{item.wordCount} {uk ? 'слів' : 'слов'}</span>{mastery && <MasteryMark percent={item.percent} uk={uk} />}<span>{item.percent === null ? (uk ? 'Прогрес недоступний' : 'Прогресс недоступен') : `${item.percent}%`}</span></span>
              {item.percent !== null && <span className={styles.tileTrack} role="progressbar" aria-label={`${uk ? 'Прогрес' : 'Прогресс'}: ${item.title}`} aria-valuenow={item.percent} aria-valuemin={0} aria-valuemax={100} style={{ '--progress': `${item.percent}%` } as CSSProperties}><span /></span>}
            </Link>
          </li>)}
        </ul>
      </div>
    </section>)}
  </div>;
}
