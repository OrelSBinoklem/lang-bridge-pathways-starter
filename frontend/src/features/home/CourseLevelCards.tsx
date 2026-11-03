'use client';

import { COURSE_LEVEL_IDS, type CourseLevelSummary } from '@/features/course/course-level-progress';
import { CourseLevelCard } from './CourseLevelCard';
import type { LearnLang } from '@/lib/learn-lang';
import styles from './course-level-cards.module.css';

export function CourseLevelCards({ levels, uk, language = 'lv' }: { levels: CourseLevelSummary[]; uk: boolean; language?: LearnLang }) {
 return <div className={styles.grid} data-home-course-cards="">
  {COURSE_LEVEL_IDS.map((id,index)=><CourseLevelCard key={id} id={id} index={index} level={levels.find(item=>item.id===id)} uk={uk} language={language}/>)}
 </div>;
}
