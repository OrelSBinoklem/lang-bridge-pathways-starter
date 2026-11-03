'use client';

import { useTranslations } from 'next-intl';
import type { HomeModalKind } from './home-types';
import styles from './home-learning-hub.module.css';

export function HomeIntroCard({ uk, items, onOpenIntro }: { uk: boolean; items: readonly HomeModalKind[]; onOpenIntro: (kind: HomeModalKind) => void }) {
  const t = useTranslations('Home');
  return <section className={styles.intro} aria-label={uk ? 'Знайомство з мовою без страху' : 'Знакомство с языком без страха'} data-home-module="intro">
    <div className={styles.introButtons} data-single={items.length === 1 || undefined}>
      {items.map(kind => <button key={kind} type="button" className={kind === 'grammar' ? styles.overviewButton : styles.conceptsButton} aria-haspopup="dialog" onClick={() => onOpenIntro(kind)}><i className={`pi ${kind === 'grammar' ? 'pi-compass' : 'pi-lightbulb'}`} aria-hidden="true" /><span>{t(kind === 'grammar' ? 'grammarBtn' : 'conceptsBtn')}</span><i className="pi pi-plus" aria-hidden="true" /></button>)}
    </div>
    <p><strong>{uk ? 'Вивчати мову не страшно, коли розумієш, що попереду.' : 'Учить язык не страшно, когда понимаешь, что впереди.'}</strong>{uk ? 'Цей розділ допоможе розібратися, як влаштована мова, познайомитися з основними поняттями та дізнатися, що чекає на вас під час навчання.' : 'Этот раздел поможет разобраться, как устроен язык, познакомиться с основными понятиями и узнать, что вас ждёт в процессе обучения.'}</p>
  </section>;
}
