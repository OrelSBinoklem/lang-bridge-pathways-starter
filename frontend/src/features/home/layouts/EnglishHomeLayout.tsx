import type { HomeLayoutProps } from '../home-types';
import { HomeGrammarLinks } from '../HomeGrammarLinks';
import { DictionaryLibrary } from '../DictionaryLibrary';
import { HomeExamsCard } from '../HomeExamsCard';
import { HomeIntroCard } from '../HomeIntroCard';
import { HomeCourseOverview } from '../HomeCourseOverview';
import { UsefulLinks } from '../UsefulLinks';
import { USEFUL_LINKS } from '../useful-links';
import styles from '../home-learning-hub.module.css';

/** English composition: reorder, add or remove modules here independently of Latvian. */
export function EnglishHomeLayout({ dictionaries, loading, courseLevels, courseError, uk, onOpenIntro }: HomeLayoutProps) {
  return <div data-home-layout="en">
    <HomeCourseOverview language="en" levels={courseLevels} error={courseError} uk={uk} />
    <div className={styles.root} data-home-learning-hub="">
      <HomeExamsCard language="en" uk={uk} />
      <HomeIntroCard uk={uk} items={['grammar', 'concepts']} onOpenIntro={onOpenIntro} />
      <p className={styles.technicalCaption} data-home-module="technical-caption">{uk ? 'Основний розділ навчання. Розділи нижче — технічні.' : 'Основной раздел обучения. Разделы ниже — технические.'}</p>
      <div className={styles.columns}>
        <HomeGrammarLinks language="en" uk={uk} />
        <DictionaryLibrary language="en" dictionaries={dictionaries} loading={loading} uk={uk} />
      </div>
    </div>
    <UsefulLinks links={USEFUL_LINKS.en ?? []} />
  </div>;
}
