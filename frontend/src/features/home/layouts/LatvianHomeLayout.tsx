import type { HomeLayoutProps } from '../home-types';
import { HomeCourseOverview } from '../HomeCourseOverview';
import { HomeGrammarLinks } from '../HomeGrammarLinks';
import { DictionaryLibrary } from '../DictionaryLibrary';
import { HomeExamsCard } from '../HomeExamsCard';
import { HomeIntroCard } from '../HomeIntroCard';
import { UsefulLinks } from '../UsefulLinks';
import { USEFUL_LINKS } from '../useful-links';
import styles from '../home-learning-hub.module.css';

/** Latvian composition: its module selection and order do not depend on English. */
export function LatvianHomeLayout({ dictionaries, loading, courseLevels, courseError, uk, onOpenIntro }: HomeLayoutProps) {
  return <div data-home-layout="lv">
    <HomeCourseOverview levels={courseLevels} error={courseError} uk={uk} />
    <div className={styles.root} data-home-learning-hub="">
      <HomeExamsCard language="lv" uk={uk} />
      <HomeIntroCard uk={uk} items={['grammar', 'concepts']} onOpenIntro={onOpenIntro} />
      <p className={styles.technicalCaption} data-home-module="technical-caption">{uk ? 'Основний розділ навчання. Розділи нижче — технічні.' : 'Основной раздел обучения. Разделы ниже — технические.'}</p>
      <div className={styles.columns}>
        <HomeGrammarLinks language="lv" uk={uk} />
        <DictionaryLibrary language="lv" dictionaries={dictionaries} loading={loading} uk={uk} />
      </div>
    </div>
    <UsefulLinks links={USEFUL_LINKS.lv ?? []} />
  </div>;
}
