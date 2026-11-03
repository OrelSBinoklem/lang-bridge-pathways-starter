import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { LayoutProps } from './types';
import styles from './paper-atlas-ribbons.module.css';

export function EditorialAtlas({ groups, uk }: LayoutProps) {
  return <div className={styles.atlas}>
    {groups.map((group) => <section className={styles.atlasChapter} id={`category-group-${group.id}`} data-level={group.level} key={group.id} aria-label={group.title}>
      <header className={styles.chapterMargin}>
        <span className={styles.eyebrow}>{uk ? 'РОЗДІЛ' : 'РАЗДЕЛ'} / {group.level}</span>
        <h2 className={styles.chapterLevel}>{group.level}</h2>
        <p>{group.description}</p>
        <div className={styles.chapterMetric}><strong>{group.wordCount}</strong><span>{uk ? 'слів для твого світу' : 'слов для твоего мира'}</span></div>
        {group.percent !== null && <div className={styles.chapterProgress}><span>{uk ? 'Твій прогрес' : 'Твой прогресс'}<strong>{group.percent}%</strong></span><span className={styles.chapterTrack} style={{ '--fill': `${group.percent}%` } as CSSProperties}><span /></span></div>}
        <span className={styles.chapterEdition}>LANGBRIDGE / LATVIEŠU</span>
      </header>
      <div className={styles.chapterContent}>
        <div className={styles.chapterHeading}><h3>{group.title}</h3><span>{String(group.items.length).padStart(2, '0')} {uk ? 'тем' : 'тем'}</span></div>
        <div className={styles.atlasRows}>
          {group.items.map((item, index) => <Link className={styles.atlasEntry} data-featured={index === 0 ? 'true' : undefined} key={item.id} href={item.href} prefetch={false}>
            <span className={styles.entryNumber}>{item.number || '—'}</span>
            <span className={styles.entryCopy}>{index === 0 && <span className={styles.entryKicker}>{uk ? 'ВІДКРИЙ РОЗДІЛ' : 'ОТКРОЙ РАЗДЕЛ'}</span>}<span className={styles.entryTitle}>{item.label}</span><span className={styles.entryWords}>{item.wordCount} {uk ? 'слів' : 'слов'}{item.percent === 100 && <span> · {uk ? 'Вивчено' : 'Изучено'}</span>}</span></span>
            {item.art && <Image className={styles.entryArt} src={item.art} width={160} height={160} loading={item === groups[0]?.items[0] ? 'eager' : 'lazy'} alt="" unoptimized />}
            <span className={styles.entryEnd}>{item.percent !== null && <span>{item.percent}%</span>}<span className={styles.entryArrow} aria-hidden="true">↗</span></span>
            {item.percent !== null && <span className={styles.entryTrack} style={{ '--fill': `${item.percent}%` } as CSSProperties}><span /></span>}
          </Link>)}
        </div>
      </div>
    </section>)}
  </div>;
}
