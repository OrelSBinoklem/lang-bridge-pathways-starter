'use client';

import type { HomeDictionary, HomeModalKind } from './home-types';
import { DictionaryLibrary } from './DictionaryLibrary';
import { HomeGrammarLinks } from './HomeGrammarLinks';
import { HomeExamsCard } from './HomeExamsCard';
import { HomeIntroCard } from './HomeIntroCard';
import styles from './home-learning-hub.module.css';

/** Compatibility entry point for existing Latvian consumers. Page layouts compose the same modules directly. */
export function HomeLearningHub({ dictionaries, loading, uk, onOpenIntro }: { dictionaries: HomeDictionary[]; loading: boolean; uk: boolean; onOpenIntro: (kind: HomeModalKind) => void }) {
 return <div className={styles.root} data-home-learning-hub="">
  <div className={styles.columns}><HomeGrammarLinks language="lv" uk={uk}/><DictionaryLibrary language="lv" dictionaries={dictionaries} loading={loading} uk={uk}/></div>
  <HomeExamsCard language="lv" uk={uk}/><HomeIntroCard uk={uk} items={['grammar','concepts']} onOpenIntro={onOpenIntro}/>
 </div>;
}
