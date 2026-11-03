'use client';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Dialog } from 'primereact/dialog';
import type { LearnLang } from '@/lib/learn-lang';
import type { HomeModalKind } from './home-types';
import LangModalConceptsContent from './LangModalConceptsContent';
import LangModalConceptsContentUk from './LangModalConceptsContent.uk';
import LangModalGrammarContent from './LangModalGrammarContent';
import LangModalGrammarContentUk from './LangModalGrammarContent.uk';
import unifiedStyles from './home-unified.module.css';
const EnglishGrammarOverview = dynamic(() => import('@/features/english-grammar/overview/EnglishGrammarOverview'), { loading: () => <p role="status">Загрузка обзора…</p> });
const EnglishConcepts = dynamic(() => import('@/features/english-grammar/overview/EnglishConcepts'), { loading: () => <p role="status">Загрузка понятий…</p> });

export function HomeIntroDialogs({ modal, onClose, language: learnLang, uk, unified }: { modal: HomeModalKind | null; onClose: () => void; language: LearnLang; uk: boolean; unified: boolean }) {
 const t=useTranslations('Home'), locale=uk?'uk':'ru';
 return <>
      <Dialog
        header={`${t('grammarDialog')}${learnLang === 'en' ? (uk ? ' · Англійська' : ' · Английский') : ''}`}
        className={unified ? unifiedStyles.dialog : undefined}
        visible={modal === 'grammar'}
        onHide={() => onClose()}
        modal
        dismissableMask
        maximizable
        blockScroll
        style={{ width: 'min(1440px, 97vw)', maxHeight: '94dvh' }}
        breakpoints={{ '960px': '96vw' }}
        contentStyle={{ maxHeight: 'calc(94dvh - 80px)', overflow: 'auto' }}
      >
        {modal === 'grammar' && (learnLang === 'en' ? <EnglishGrammarOverview locale={uk ? 'uk' : 'ru'} /> : locale === 'uk' ? <LangModalGrammarContentUk /> : <LangModalGrammarContent />)}
      </Dialog>

      <Dialog
        header={`${t('conceptsDialog')}${learnLang === 'en' ? (uk ? ' · Англійська' : ' · Английский') : ''}`}
        className={unified ? unifiedStyles.dialog : undefined}
        visible={modal === 'concepts'}
        onHide={() => onClose()}
        modal
        dismissableMask
        maximizable
        blockScroll
        style={{ width: 'min(1440px, 97vw)', maxHeight: '94dvh' }}
        breakpoints={{ '960px': '96vw' }}
        contentStyle={{ maxHeight: 'calc(94dvh - 80px)', overflow: 'auto' }}
      >
        {modal === 'concepts' && (learnLang === 'en' ? <EnglishConcepts locale={locale} /> : locale === 'uk' ? <LangModalConceptsContentUk /> : <LangModalConceptsContent />)}
      </Dialog>
 </>;
}
