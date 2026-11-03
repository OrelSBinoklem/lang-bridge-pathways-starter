import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { LayoutProps } from './types';
import styles from './paper-atlas-ribbons.module.css';

export function ColorRibbons({ groups, uk }: LayoutProps) {
  return <div className={styles.ribbons}>
    {groups.map((group) => <section className={styles.ribbon} id={`category-group-${group.id}`} data-level={group.level} key={group.id} aria-label={group.title}>
      <header className={styles.ribbonStart}>
        <span className={styles.ribbonLabel}>{uk ? 'ТВІЙ СЛОВНИК' : 'ТВОЙ СЛОВАРЬ'}</span>
        <h2>{group.level}</h2><p>{group.description}</p>
        <span className={styles.ribbonTotal}>{group.wordCount}<small>{uk ? 'слів' : 'слов'}</small></span>
        <span className={styles.ribbonRoll} aria-hidden="true" />
      </header>
      <div className={styles.ribbonBody}>
        <div className={styles.ribbonHeading}><h3>{group.title}</h3><span>{group.percent === null ? 'LV' : `${group.percent}%`}</span></div>
        <div className={styles.ribbonCells}>
          {group.items.map((item) => <Link href={item.href} prefetch={false} className={styles.ribbonCell} key={item.id}>
            <span className={styles.cellHeader}><span className={styles.cellNumber}>{item.number || '—'}</span><span aria-hidden="true" className={styles.cellArrow}>↗</span></span>
            <span className={styles.cellTitle}>{item.label}</span>
            {item.art && <Image className={styles.cellArt} src={item.art} width={86} height={86} loading={item === groups[0]?.items[0] ? 'eager' : 'lazy'} alt="" unoptimized />}
            <span className={styles.cellFooter}><span>{item.wordCount} {uk ? 'слів' : 'слов'}</span><span>{item.percent === 100 ? '✓ 100%' : item.percent === null ? '' : `${item.percent}%`}</span></span>
            {item.percent !== null && <span className={styles.cellTrack} style={{ '--fill': `${item.percent}%` } as CSSProperties}><span /></span>}
          </Link>)}
        </div>
      </div>
    </section>)}
  </div>;
}
