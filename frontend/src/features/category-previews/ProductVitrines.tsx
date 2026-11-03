import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { LayoutProps } from './types';
import styles from './glass-vitrines.module.css';
import { MasteryMark } from './MasteryMark';
import { getMasteryTier } from './mastery';
import masteryStyles from './mastery.module.css';

export function ProductVitrines({ groups, uk, mastery = false }: LayoutProps) {
  return <div className={styles.vitrines}>
    {groups.map((group) => <section className={styles.gallery} data-level={group.level} id={`category-group-${group.id}`} key={group.id} aria-labelledby={`gallery-${group.id}`}>
      <header className={styles.galleryHeader}>
        <div className={styles.galleryTitle}><span className={styles.galleryLevel}>{group.level}</span><div><span className={styles.micro}>{uk ? 'КОЛЕКЦІЯ ТЕМ' : 'КОЛЛЕКЦИЯ ТЕМ'}</span><h2 id={`gallery-${group.id}`}>{group.description}</h2></div></div>
        <p className={styles.galleryCount}>{group.wordCount} {uk ? 'слів у колекції' : 'слов в коллекции'}<span>{group.percent === null ? (uk ? 'Прогрес недоступний' : 'Прогресс недоступен') : `${uk ? 'Прогрес' : 'Прогресс'} ${group.percent}%`}</span></p>
      </header>
      <ul className={styles.galleryGrid}>
        {group.items.map((item, index) => <li key={item.id} data-featured={index === 0 ? 'true' : undefined}>
          <Link href={item.href} prefetch={false} className={`${styles.vitrine}${mastery ? ` ${masteryStyles.card} ${masteryStyles.vitrine}` : ''}`} data-mastery-tier={mastery ? getMasteryTier(item.percent) : undefined} style={mastery ? { '--mastery-progress': `${item.percent ?? 0}%` } as CSSProperties : undefined}>
            {mastery && <span className={masteryStyles.paint} aria-hidden="true" />}
            <div className={styles.exhibit} aria-hidden="true">
              <span className={styles.exhibitHalo} />
              <span className={styles.exhibitPlinth} />
              {item.art ? <Image src={item.art} alt="" width={220} height={220} loading={group === groups[0] && index === 0 ? 'eager' : 'lazy'} unoptimized className={styles.exhibitImage} /> : <span className={styles.exhibitFallback}>{group.level}<small>{item.number}</small></span>}
              <span className={styles.exhibitReflection} />
            </div>
            <div className={styles.exhibitText}>
              <span className={styles.exhibitIndex}>{group.level}<span aria-hidden="true"> / </span>{item.number}</span>
              <h3>{item.label}</h3>
              {mastery && <MasteryMark percent={item.percent} uk={uk} prominent />}
            </div>
            <span className={styles.exhibitFooter}><span>{item.wordCount} {uk ? 'слів' : 'слов'}</span><span>{item.percent === null ? '—' : `${item.percent}%`}</span><span className={styles.openExhibit} aria-hidden="true">↗</span></span>
            {item.percent !== null && <span className={styles.exhibitTrack} role="progressbar" aria-label={`${uk ? 'Прогрес' : 'Прогресс'}: ${item.title}`} aria-valuenow={item.percent} aria-valuemin={0} aria-valuemax={100} style={{ '--progress': `${item.percent}%` } as CSSProperties}><span /></span>}
          </Link>
        </li>)}
      </ul>
    </section>)}
  </div>;
}
