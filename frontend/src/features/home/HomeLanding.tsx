'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Message } from 'primereact/message';
import { useState, useSyncExternalStore } from 'react';
import type { CourseLevelSummary } from '@/features/course/course-level-progress';
import { apiFetch } from '@/lib/api';
import { clientApi } from '@/lib/client-api';
import { getLearnLangFromCookie, LEARN_LANG_EVENT } from '@/lib/learn-lang';
import type { HomeDictionary, HomeModalKind } from './home-types';
import { HomeIntroDialogs } from './HomeIntroDialogs';
import { HomeTour } from '@/features/home-tour/HomeTour';
import { EnglishHomeLayout } from './layouts/EnglishHomeLayout';
import { LatvianHomeLayout } from './layouts/LatvianHomeLayout';
import { LegacyHomeLayout } from './layouts/LegacyHomeLayout';
import styles from './home.module.css';
import unifiedStyles from './home-unified.module.css';

function subscribeLanguage(onChange: () => void) {
 window.addEventListener(LEARN_LANG_EVENT,onChange);
 return () => window.removeEventListener(LEARN_LANG_EVENT,onChange);
}
const languageSnapshot=()=>getLearnLangFromCookie() ?? 'lv';
const serverLanguageSnapshot=()=> 'lv' as const;

export function HomeLanding({ unified = false }: { unified?: boolean }) {
 const t=useTranslations('Home'), uk=useLocale()==='uk';
 const learnLang=useSyncExternalStore(subscribeLanguage,languageSnapshot,serverLanguageSnapshot);
 const [modal,setModal]=useState<HomeModalKind|null>(null);
 const dictQuery=useQuery({queryKey:['dictionaries',learnLang],queryFn:()=>apiFetch<{data:HomeDictionary[]}>(`/dictionaries?learn_lang=${learnLang}`)});
 const courseQuery=useQuery({queryKey:['course-path',learnLang],queryFn:()=>clientApi<{data:CourseLevelSummary[]}>(`/course?learn_lang=${encodeURIComponent(learnLang)}`),enabled:!unified || learnLang==='lv',retry:false,staleTime:0});
 const content={dictionaries:dictQuery.data?.data??[],loading:dictQuery.isLoading,courseLevels:courseQuery.data?.data??[],courseError:courseQuery.error,uk,onOpenIntro:setModal};
 return <div className={`${styles.root} ${unified ? unifiedStyles.root : ''}`}>
  {dictQuery.isError && <Message severity="error" text={t('loadError')} className="mb-4 w-full" />}
  {unified ? <LegacyHomeLayout {...content} language={learnLang} /> : learnLang==='en' ? <EnglishHomeLayout {...content} /> : <LatvianHomeLayout {...content} />}
  <HomeIntroDialogs modal={modal} onClose={()=>setModal(null)} language={learnLang} uk={uk} unified={unified} />
  {!unified && <HomeTour />}
 </div>;
}
export default HomeLanding;
