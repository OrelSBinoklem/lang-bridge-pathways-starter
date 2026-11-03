import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { LayoutProps } from './types';
import styles from './paper-atlas-ribbons.module.css';
import { MasteryMark } from './MasteryMark';
import { getMasteryTier } from './mastery';
import masteryStyles from './mastery.module.css';

export function PaperCatalog({ groups, uk, mastery = false }: LayoutProps) {
  return <div className={styles.catalog}>
    {groups.map((group) => <section className={styles.folder} id={`category-group-${group.id}`} data-level={group.level} key={group.id} aria-label={group.title}>
      <header className={styles.folderHeader}>
        <span className={styles.folderTab}>{group.level}</span>
        <div><span className={styles.eyebrow}>{uk ? 'ОСОБИСТА КАРТОТЕКА' : 'ЛИЧНАЯ КАРТОТЕКА'}</span><h2>{group.title}</h2></div>
        <div className={styles.folderSummary}><strong>{group.wordCount}</strong><span>{uk ? 'слів у колекції' : 'слов в коллекции'}</span></div>
      </header>
      <div className={styles.fileGrid}>
        {group.items.map((item) => <Link href={item.href} prefetch={false} key={item.id} className={`${styles.file}${mastery ? ` ${masteryStyles.card} ${masteryStyles.paper}` : ''}`} data-mastery-tier={mastery ? getMasteryTier(item.percent) : undefined} style={mastery ? { '--mastery-progress': `${item.percent ?? 0}%` } as CSSProperties : undefined} aria-label={`${item.title}, ${item.wordCount} ${uk ? 'слів' : 'слов'}${item.percent === null ? '' : `, ${item.percent}%`}`}>
          {mastery && <span className={masteryStyles.paint} aria-hidden="true" />}
          <span className={styles.fileTop}><span className={styles.fileIndex}>{item.number || '—'}</span><span className={styles.fileCode}>LV / {group.level}</span></span>
          {mastery && item.percent !== null && item.percent >= 50 ? <MasteryMark percent={item.percent} uk={uk} prominent /> : <span className={styles.postmark} aria-hidden="true"><span>LATVIJA</span><span>LV · {group.level}</span></span>}
          {item.art && <Image className={styles.fileArt} src={item.art} width={132} height={132} loading={item === groups[0]?.items[0] ? 'eager' : 'lazy'} alt="" unoptimized />}
          <span className={`${styles.fileTitle}${mastery ? ` ${masteryStyles.paperTitle}` : ''}`}>{item.label}</span>
          <span className={styles.fileBottom}><span>{item.wordCount} {uk ? 'слів' : 'слов'}</span>{item.percent !== null && <span>{item.percent}%</span>}</span>
          {item.percent !== null && <span className={styles.fileProgress} style={{ '--fill': `${item.percent}%` } as CSSProperties}><span /></span>}
          {!mastery && item.percent === 100 && <span className={styles.completedStamp}>{uk ? 'ВИВЧЕНО' : 'ИЗУЧЕНО'}</span>}
          <span className={styles.fileOpen} aria-hidden="true">↗</span>
        </Link>)}
      </div>
      <div className={styles.folderFooter}><span>{uk ? 'Кожна тема — нова історія' : 'Каждая тема — новая история'}</span><span>{group.level} · LV</span></div>
    </section>)}
  </div>;
}
